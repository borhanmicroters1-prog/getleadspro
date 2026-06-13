import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func
from datetime import datetime, timezone

from app.database import get_db
from app.models import User, EmailAccount, WarmupLog
from app.utils.auth import get_current_user

logger = logging.getLogger("warmup")
router = APIRouter(prefix="/api/warmup", tags=["Email Warm-up"])

@router.post("/start/{account_id}")
async def start_warmup(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Starts the email warm-up for the specified connected mailbox."""
    # 1. Fetch user to check subscription plan
    q_user = await db.execute(select(User).where(User.id == current_user["id"]))
    user = q_user.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    plan_upper = user.plan.strip().upper()
    if plan_upper == "FREE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email warm-up is not available on the Free plan. Please upgrade to Starter or Pro."
        )

    # 2. Fetch target email account
    q_acc = await db.execute(
        select(EmailAccount).where(
            and_(
                EmailAccount.id == account_id,
                EmailAccount.user_id == user.id
            )
        )
    )
    account = q_acc.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found or unauthorized.")

    # 3. If plan is Starter, verify they don't already have another account warming up
    if plan_upper == "STARTER":
        q_warming_count = await db.execute(
            select(func.count(EmailAccount.id)).where(
                and_(
                    EmailAccount.user_id == user.id,
                    EmailAccount.warmup_status == "warming",
                    EmailAccount.id != account_id
                )
            )
        )
        warming_count = q_warming_count.scalar() or 0
        if warming_count >= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Starter plan is limited to 1 warming mailbox. Upgrade to Pro for unlimited warming."
            )

    # 4. Turn on warmup status
    account.warmup_enabled = True
    account.warmup_status = "warming"
    if not account.warmup_started_at:
        account.warmup_started_at = datetime.now(timezone.utc).replace(tzinfo=None)
    
    await db.commit()
    await db.refresh(account)
    return account.to_dict()

@router.post("/pause/{account_id}")
async def pause_warmup(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pauses the email warm-up for the specified mailbox."""
    q_acc = await db.execute(
        select(EmailAccount).where(
            and_(
                EmailAccount.id == account_id,
                EmailAccount.user_id == current_user["id"]
            )
        )
    )
    account = q_acc.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found or unauthorized.")

    account.warmup_status = "paused"
    await db.commit()
    await db.refresh(account)
    return account.to_dict()

@router.get("/status/{account_id}")
async def get_warmup_status(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns aggregated warm-up details and health metric totals."""
    q_acc = await db.execute(
        select(EmailAccount).where(
            and_(
                EmailAccount.id == account_id,
                EmailAccount.user_id == current_user["id"]
            )
        )
    )
    account = q_acc.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found or unauthorized.")

    # Calculate days warming
    days_warming = 0
    if account.warmup_started_at:
        started_dt = account.warmup_started_at.replace(tzinfo=timezone.utc)
        days_warming = (datetime.now(timezone.utc) - started_dt).days + 1

    # Fetch totals across all logs
    q_totals = await db.execute(
        select(
            func.sum(WarmupLog.emails_sent).label("sent"),
            func.sum(WarmupLog.emails_received).label("received"),
            func.sum(WarmupLog.replies_sent).label("replies"),
            func.sum(WarmupLog.inbox_moved).label("inbox"),
            func.sum(WarmupLog.spam_found).label("spam")
        ).where(WarmupLog.email_account_id == account.id)
    )
    totals = q_totals.first()
    
    # Check current reputation level
    reputation = "Good"
    if account.warmup_health_score < 40:
        reputation = "Poor"
    elif account.warmup_health_score < 75:
        reputation = "Medium"

    return {
        "account_id": account.id,
        "from_email": account.from_email,
        "warmup_enabled": account.warmup_enabled,
        "warmup_status": account.warmup_status,
        "health_score": account.warmup_health_score,
        "reputation": reputation,
        "days_warming": days_warming,
        "totals": {
            "emails_sent": totals.sent or 0,
            "emails_received": totals.received or 0,
            "replies_sent": totals.replies or 0,
            "inbox_moved": totals.inbox or 0,
            "spam_found": totals.spam or 0
        }
    }

@router.get("/logs/{account_id}")
async def get_warmup_logs(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns the history of daily warmup activity logs for graphing."""
    # Ensure ownership
    q_acc = await db.execute(
        select(EmailAccount).where(
            and_(
                EmailAccount.id == account_id,
                EmailAccount.user_id == current_user["id"]
            )
        )
    )
    account = q_acc.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found or unauthorized.")

    q_logs = await db.execute(
        select(WarmupLog)
        .where(WarmupLog.email_account_id == account.id)
        .order_by(WarmupLog.date.asc())
    )
    logs = q_logs.scalars().all()
    return [log.to_dict() for log in logs]
