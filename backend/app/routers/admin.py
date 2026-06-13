import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func, desc
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.models import User, CampaignLead, Lead, EmailAccount, CreditsLog, Campaign
from app.utils.auth import get_current_user
from app.config import settings

logger = logging.getLogger("admin")
router = APIRouter(prefix="/api/admin", tags=["Super Admin"])

class UserAdminUpdate(BaseModel):
    plan: str
    credits: int
    is_admin: bool

async def verify_admin_status(user_id: str, db: AsyncSession) -> User:
    """Verifies if the current user is a super admin."""
    q_user = await db.execute(select(User).where(User.id == user_id))
    user = q_user.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user profile not found."
        )
    
    is_admin_email = user.email.strip().lower() == settings.SUPER_ADMIN_EMAIL.strip().lower()
    if not (user.is_admin or is_admin_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super admin privileges required."
        )
    return user

@router.get("/stats")
async def get_system_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches system-wide aggregated metrics for the admin dashboard."""
    await verify_admin_status(current_user["id"], db)

    # 1. Total Registered Users
    q_users_count = await db.execute(select(func.count(User.id)))
    total_users = q_users_count.scalar() or 0

    # 2. Plan Distribution & MRR
    q_starter = await db.execute(select(func.count(User.id)).where(User.plan == "Starter"))
    starter_count = q_starter.scalar() or 0

    q_pro = await db.execute(select(func.count(User.id)).where(User.plan == "Pro"))
    pro_count = q_pro.scalar() or 0

    system_mrr = (starter_count * 490) + (pro_count * 1490)

    # 3. Total Campaign Emails Sent System-wide
    q_sent_count = await db.execute(select(func.sum(CampaignLead.sent_count)))
    total_sent = q_sent_count.scalar() or 0

    # 4. Total Leads Scraped System-wide
    q_leads_count = await db.execute(select(func.count(Lead.id)))
    total_leads = q_leads_count.scalar() or 0

    # 5. Warm-up Pool Size (Active Warming Mailboxes)
    q_pool_count = await db.execute(
        select(func.count(EmailAccount.id)).where(EmailAccount.warmup_status == "warming")
    )
    warmup_pool_size = q_pool_count.scalar() or 0

    # 6. Fetch 5 Recent Transactions
    q_txns = await db.execute(
        select(CreditsLog, User)
        .join(User, CreditsLog.user_id == User.id)
        .where(CreditsLog.action == "purchase")
        .order_by(CreditsLog.created_at.desc())
        .limit(5)
    )
    
    recent_transactions = []
    for log, user in q_txns.all():
        # Map credit packages back to BDT
        amount_bdt = 0
        if log.amount == 2500:
            amount_bdt = 490
        elif log.amount == 10000:
            amount_bdt = 1490
        elif log.amount == 25000:
            amount_bdt = 2950
            
        recent_transactions.append({
            "id": log.id,
            "user_email": user.email,
            "action": log.action,
            "credits_credited": log.amount,
            "amount_bdt": amount_bdt,
            "reference": log.reference,
            "created_at": log.created_at.isoformat()
        })

    # 7. System Health Status Checklist (Checks for configured API keys)
    keys_configured = {
        "google_maps": bool(settings.GOOGLE_MAPS_API_KEY),
        "facebook_ads": bool(settings.META_ACCESS_TOKEN),
        "claude_ai": bool(settings.ANTHROPIC_API_KEY),
        "chatgpt_ai": bool(settings.OPENAI_API_KEY),
        "gemini_ai": bool(settings.GEMINI_API_KEY),
        "sslcommerz": bool(settings.SSLCOMMERZ_STORE_ID and settings.SSLCOMMERZ_STORE_PASSWORD)
    }

    return {
        "total_users": total_users,
        "starter_users": starter_count,
        "pro_users": pro_count,
        "system_mrr": system_mrr,
        "total_sent": total_sent,
        "total_leads": total_leads,
        "warmup_pool_size": warmup_pool_size,
        "recent_transactions": recent_transactions,
        "system_keys": keys_configured
    }

@router.get("/users")
async def list_all_users(
    search: Optional[str] = None,
    plan: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns directory of all users in the system."""
    await verify_admin_status(current_user["id"], db)

    query = select(User)
    conditions = []

    if plan:
        conditions.append(User.plan == plan.strip())
        
    if search:
        search_val = f"%{search.strip().lower()}%"
        conditions.append(
            func.lower(User.email).like(search_val) | 
            func.lower(User.name).like(search_val)
        )

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(User.created_at.desc())
    q_res = await db.execute(query)
    users = q_res.scalars().all()
    
    users_data = []
    for u in users:
        # Fetch statistics
        q_leads = await db.execute(select(func.count(Lead.id)).where(Lead.user_id == u.id))
        leads_count = q_leads.scalar() or 0
        
        q_campaigns = await db.execute(select(func.count(Campaign.id)).where(Campaign.user_id == u.id))
        campaigns_count = q_campaigns.scalar() or 0
        
        q_accounts = await db.execute(select(func.count(EmailAccount.id)).where(EmailAccount.user_id == u.id))
        accounts_count = q_accounts.scalar() or 0
        
        d = u.to_dict()
        d["leads_count"] = leads_count
        d["campaigns_count"] = campaigns_count
        d["accounts_count"] = accounts_count
        users_data.append(d)
        
    return users_data

@router.post("/users/{user_id}/update-profile")
async def admin_update_user(
    user_id: str,
    payload: UserAdminUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows admin to override a user's subscription, credits, and admin role status."""
    await verify_admin_status(current_user["id"], db)

    q_user = await db.execute(select(User).where(User.id == user_id))
    user = q_user.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    # Validation checks
    plan_clean = payload.plan.strip()
    if plan_clean not in ["Free", "Starter", "Pro"]:
        raise HTTPException(status_code=400, detail="Invalid plan level selection.")

    if payload.credits < 0:
        raise HTTPException(status_code=400, detail="User credits cannot be negative.")

    # Track credits difference for logging
    old_credits = user.credits
    diff = payload.credits - old_credits

    user.plan = plan_clean
    user.credits = payload.credits
    user.is_admin = payload.is_admin

    if diff != 0:
        log = CreditsLog(
            user_id=user.id,
            action="bonus" if diff > 0 else "scrape", # Represent audit adjustment
            amount=abs(diff),
            balance_after=payload.credits,
            reference="Admin manual adjustment override"
        )
        db.add(log)

    await db.commit()
    await db.refresh(user)
    return user.to_dict()

@router.get("/warmup-pool")
async def get_system_warmup_pool(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns a list of all accounts currently active in the warm-up pool."""
    await verify_admin_status(current_user["id"], db)

    q_accounts = await db.execute(
        select(EmailAccount, User)
        .join(User, EmailAccount.user_id == User.id)
        .where(EmailAccount.warmup_status == "warming")
        .order_by(EmailAccount.warmup_health_score.desc())
    )
    
    pool = []
    for acc, user in q_accounts.all():
        pool.append({
            "account_id": acc.id,
            "user_email": user.email,
            "from_email": acc.from_email,
            "provider": acc.provider,
            "health_score": acc.warmup_health_score,
            "emails_sent_today": acc.emails_sent_today,
            "daily_limit": acc.daily_limit,
            "warmup_started_at": acc.warmup_started_at.isoformat() if acc.warmup_started_at else None
        })
    return pool

@router.get("/transactions")
async def get_system_transactions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all successful SSLCommerz purchase logs across the platform."""
    await verify_admin_status(current_user["id"], db)

    q_logs = await db.execute(
        select(CreditsLog, User)
        .join(User, CreditsLog.user_id == User.id)
        .where(CreditsLog.action == "purchase")
        .order_by(CreditsLog.created_at.desc())
    )
    
    transactions = []
    for log, user in q_logs.all():
        # Map credit packages back to BDT
        amount_bdt = 0
        if log.amount == 2500:
            amount_bdt = 490
        elif log.amount == 10000:
            amount_bdt = 1490
        elif log.amount == 25000:
            amount_bdt = 2950
            
        transactions.append({
            "id": log.id,
            "user_email": user.email,
            "action": log.action,
            "credits_credited": log.amount,
            "amount_bdt": amount_bdt,
            "reference": log.reference,
            "created_at": log.created_at.isoformat()
        })
    return transactions

@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows admin to delete a user account and all their data."""
    await verify_admin_status(current_user["id"], db)

    q_user = await db.execute(select(User).where(User.id == user_id))
    user = q_user.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    await db.delete(user)
    await db.commit()
    return {"message": "User and all associated data deleted successfully."}

