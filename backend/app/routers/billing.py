import logging
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User, CreditsLog
from app.utils.auth import get_current_user
from app.config import settings
from app.utils.config_resolver import get_system_setting

logger = logging.getLogger("billing")
router = APIRouter(prefix="/api/billing", tags=["Billing"])

class CheckoutRequest(BaseModel):
    item_type: str  # plan or pack
    item_id: str    # starter, pro, business

PRICING_TABLE = {
    "plan": {
        "starter": {"amount": 490, "credits": 2500, "name": "Starter Plan Subscription"},
        "pro": {"amount": 1490, "credits": 10000, "name": "Pro Plan Subscription"}
    },
    "pack": {
        "starter": {"amount": 490, "credits": 2500, "name": "Starter Credit Pack"},
        "pro": {"amount": 1490, "credits": 10000, "name": "Pro Credit Pack"},
        "business": {"amount": 2950, "credits": 25000, "name": "Business Credit Pack"}
    }
}

@router.post("/checkout")
async def checkout_session(
    request: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Initiates payment request with SSLCommerz gateway.
    Falls back to mock portal in local development if credentials are empty.
    """
    item_type = request.item_type.strip().lower()
    item_id = request.item_id.strip().lower()

    if item_type not in PRICING_TABLE or item_id not in PRICING_TABLE[item_type]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid product type or ID selection."
        )

    product = PRICING_TABLE[item_type][item_id]
    amount = product["amount"]
    product_name = product["name"]

    # Fetch User details
    q_user = await db.execute(select(User).where(User.id == current_user["id"]))
    user = q_user.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    tran_id = f"TXN_{uuid.uuid4().hex[:12].upper()}"

    # Resolve SSLCommerz settings dynamically
    sslcommerz_store_id = await get_system_setting(db, "SSLCOMMERZ_STORE_ID")
    sslcommerz_store_passwd = await get_system_setting(db, "SSLCOMMERZ_STORE_PASSWORD")

    # If credentials are not set, fall back to mock sandbox page
    if not sslcommerz_store_id or not sslcommerz_store_passwd:
        mock_url = (
            f"{settings.BACKEND_URL}/api/billing/mock-gateway"
            f"?tran_id={tran_id}"
            f"&amount={amount}"
            f"&item_type={item_type}"
            f"&item_id={item_id}"
            f"&user_id={user.id}"
            f"&product_name={product_name.replace(' ', '%20')}"
        )
        return {"GatewayPageURL": mock_url}

    # Prepare actual SSLCommerz initiation request
    init_url = (
        "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
        if settings.SSLCOMMERZ_IS_SANDBOX
        else "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
    )

    payload = {
        "store_id": sslcommerz_store_id,
        "store_passwd": sslcommerz_store_passwd,
        "total_amount": float(amount),
        "currency": "BDT",
        "tran_id": tran_id,
        "success_url": f"{settings.BACKEND_URL}/api/billing/success",
        "fail_url": f"{settings.BACKEND_URL}/api/billing/fail",
        "cancel_url": f"{settings.BACKEND_URL}/api/billing/cancel",
        "cus_name": user.name or "Customer",
        "cus_email": user.email,
        "cus_phone": "01700000000",
        "cus_add1": "Dhaka",
        "cus_city": "Dhaka",
        "cus_country": "Bangladesh",
        "shipping_method": "NO",
        "product_name": product_name,
        "product_category": "Software",
        "product_profile": "non-physical-goods",
        "value_a": user.id,
        "value_b": item_type,
        "value_c": item_id,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(init_url, data=payload)
            data = res.json()
            if data.get("status") == "SUCCESS" and "GatewayPageURL" in data:
                return {"GatewayPageURL": data["GatewayPageURL"]}
            else:
                raise Exception(data.get("failedreason") or "Gateway error")
    except Exception as e:
        logger.error(f"SSLCommerz initiation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment initiation failed. Please try again later."
        )

@router.post("/success")
async def payment_success_callback(
    status: str = Form(...),
    tran_id: str = Form(...),
    val_id: Optional[str] = Form(None),
    amount: float = Form(...),
    value_a: str = Form(...),  # user_id
    value_b: str = Form(...),  # item_type
    value_c: str = Form(...),  # item_id
    db: AsyncSession = Depends(get_db)
):
    """Callback endpoint for successful SSLCommerz transactions."""
    user_id = value_a
    item_type = value_b
    item_id = value_c

    # If it is a real connection, we validate via SSLCommerz validation API
    is_mock = not val_id or val_id.startswith("MOCK_")
    
    if not is_mock:
        valid_url = (
            "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
            if settings.SSLCOMMERZ_IS_SANDBOX
            else "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
        )
        sslcommerz_store_id = await get_system_setting(db, "SSLCOMMERZ_STORE_ID")
        sslcommerz_store_passwd = await get_system_setting(db, "SSLCOMMERZ_STORE_PASSWORD")
        params = {
            "val_id": val_id,
            "store_id": sslcommerz_store_id,
            "store_passwd": sslcommerz_store_passwd,
            "format": "json"
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(valid_url, params=params)
                val_data = res.json()
                if val_data.get("status") not in ["VALID", "VALIDATED"]:
                    logger.error(f"Transaction validation failed: {val_data}")
                    return RedirectResponse(url=f"{settings.FRONTEND_URL}/billing?status=fail")
        except Exception as e:
            logger.error(f"Validation request error: {str(e)}")
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/billing?status=error")

    # Grant settings in database
    q_user = await db.execute(select(User).where(User.id == user_id))
    user = q_user.scalars().first()
    
    if user:
        credits_to_add = PRICING_TABLE[item_type][item_id]["credits"]
        
        if item_type == "plan":
            user.plan = item_id.capitalize()
            user.credits += credits_to_add
        else: # pack
            user.credits += credits_to_add
            
        # Log the purchase
        credits_log = CreditsLog(
            user_id=user.id,
            action="purchase",
            amount=credits_to_add,
            balance_after=user.credits,
            reference=tran_id
        )
        db.add(credits_log)
        await db.commit()
        logger.info(f"Payment successful: user {user.id} upgraded. Plan: {user.plan}, Credits added: {credits_to_add}")
    
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/billing?status=success&tran_id={tran_id}")

@router.post("/fail")
async def payment_fail_callback():
    """Callback redirect for failed SSLCommerz transactions."""
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/billing?status=fail")

@router.post("/cancel")
async def payment_cancel_callback():
    """Callback redirect for canceled SSLCommerz transactions."""
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/billing?status=cancel")

@router.get("/history")
async def get_billing_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches user credits log history."""
    result = await db.execute(
        select(CreditsLog)
        .where(CreditsLog.user_id == current_user["id"])
        .order_by(CreditsLog.created_at.desc())
    )
    logs = result.scalars().all()
    return [log.to_dict() for log in logs]

@router.get("/mock-gateway", response_class=HTMLResponse)
async def mock_gateway_page(
    tran_id: str,
    amount: float,
    item_type: str,
    item_id: str,
    user_id: str,
    product_name: str
):
    """
    Serves a local developer simulation page to test payment redirects
    without active credentials.
    """
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SSLCommerz Local Simulator</title>
        <style>
            body {{
                margin: 0;
                padding: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justifyContent: center;
                background-color: #030712;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #fff;
                display: flex;
                justify-content: center;
                align-items: center;
            }}
            .panel {{
                background: rgb(9 13 22 / 65%);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgb(255 255 255 / 8%);
                border-radius: 16px;
                padding: 3rem 2.5rem;
                max-width: 440px;
                width: 100%;
                box-shadow: 0 10px 40px 0 rgba(0, 0, 0, 0.5);
                text-align: center;
            }}
            .brand {{
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                margin-bottom: 2rem;
            }}
            .logo {{
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #2563eb, #8b5cf6);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 0.9rem;
            }}
            .logo-text {{
                font-size: 1.25rem;
                font-weight: bold;
            }}
            .details {{
                background-color: rgb(255 255 255 / 3%);
                border: 1px solid rgb(255 255 255 / 4%);
                border-radius: 12px;
                padding: 1.25rem;
                margin-bottom: 2rem;
                text-align: left;
            }}
            .detail-row {{
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.75rem;
                font-size: 0.875rem;
            }}
            .detail-row:last-child {{
                margin-bottom: 0;
                border-top: 1px solid rgb(255 255 255 / 6%);
                padding-top: 0.75rem;
                font-weight: bold;
            }}
            .label {{
                color: #9ca3af;
            }}
            .val {{
                color: #fff;
            }}
            .btn {{
                width: 100%;
                padding: 0.85rem;
                border-radius: 10px;
                font-weight: 600;
                font-size: 0.925rem;
                cursor: pointer;
                border: 1px solid transparent;
                margin-bottom: 1rem;
                transition: transform 0.15s ease;
            }}
            .btn:hover {{
                transform: translateY(-2px);
            }}
            .btn-success {{
                background: linear-gradient(135deg, #10b981, #059669);
                color: #fff;
            }}
            .btn-danger {{
                background: transparent;
                border-color: rgba(239, 68, 68, 0.3);
                color: #ef4444;
            }}
            .btn-danger:hover {{
                background-color: rgba(239, 68, 68, 0.08);
            }}
        </style>
    </head>
    <body>
        <div class="panel">
            <div class="brand">
                <div class="logo">SSL</div>
                <div class="logo-text">SSLCOMMERZ <span style="font-size:10px; color:#9ca3af;">(Simulator)</span></div>
            </div>

            <div class="details">
                <div class="detail-row">
                    <span class="label">Product Name:</span>
                    <span class="val">{product_name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Transaction ID:</span>
                    <span class="val" style="font-family: monospace;">{tran_id}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Amount:</span>
                    <span class="val" style="color: #10b981;">BDT {amount:.2f}</span>
                </div>
            </div>

            <form action="/api/billing/success" method="POST">
                <input type="hidden" name="status" value="VALID">
                <input type="hidden" name="tran_id" value="{tran_id}">
                <input type="hidden" name="val_id" value="MOCK_VALIDATION_TOKEN">
                <input type="hidden" name="amount" value="{amount}">
                <input type="hidden" name="value_a" value="{user_id}">
                <input type="hidden" name="value_b" value="{item_type}">
                <input type="hidden" name="value_c" value="{item_id}">
                <button type="submit" class="btn btn-success">✅ Simulate Success Payment</button>
            </form>

            <form action="/api/billing/fail" method="POST">
                <button type="submit" class="btn btn-danger">❌ Simulate Failed Payment</button>
            </form>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
