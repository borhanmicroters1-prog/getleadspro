import logging
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func, desc, case, or_
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.models import User, CampaignLead, Lead, EmailAccount, CreditsLog, Campaign, SystemSetting, PaymentLog, Announcement, AuditLog, PromoCode, GlobalBlacklist, SupportTicket, TicketReply
from app.utils.auth import get_current_user
from app.config import settings
from app.utils.config_resolver import get_system_setting

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
    
    is_admin_email = user.email.strip().lower() in [
        settings.SUPER_ADMIN_EMAIL.strip().lower(),
        "borhan.seoexpert@gmail.com",
        "admin@getleads.com"
    ]
    if not (user.is_admin or is_admin_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super admin privileges required."
        )
    return user

@router.get("/overview")
async def get_system_overview(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetches system-wide aggregated metrics for the admin dashboard."""
    await verify_admin_status(current_user["id"], db)

    # Combine all system-wide count and sum queries into a single select of subqueries
    stmt = select(
        select(func.count(User.id)).scalar_subquery(),
        select(func.count(User.id)).where(User.plan == "Starter").scalar_subquery(),
        select(func.count(User.id)).where(User.plan == "Pro").scalar_subquery(),
        select(func.sum(CampaignLead.sent_count)).scalar_subquery(),
        select(func.count(Lead.id)).scalar_subquery(),
        select(func.count(EmailAccount.id)).where(EmailAccount.warmup_status == "warming").scalar_subquery(),
        select(func.sum(PaymentLog.amount)).where(PaymentLog.status == "success").scalar_subquery(),
        select(func.count(Campaign.id)).where(Campaign.status == "active").scalar_subquery(),
        select(func.count(SupportTicket.id)).where(SupportTicket.status.in_(["open", "in_progress"])).scalar_subquery(),
        select(func.count(PaymentLog.id)).where(
            and_(
                PaymentLog.status == "success",
                PaymentLog.promo_code != None,
                PaymentLog.promo_code != ""
            )
        ).scalar_subquery()
    )
    
    res = await db.execute(stmt)
    row = res.first()
    
    total_users = row[0] or 0
    starter_count = row[1] or 0
    pro_count = row[2] or 0
    total_sent = row[3] or 0
    total_leads = row[4] or 0
    warmup_pool_size = row[5] or 0
    total_revenue = row[6] or 0.0
    active_campaigns = row[7] or 0
    pending_tickets = row[8] or 0
    promo_uses = row[9] or 0

    system_mrr = (starter_count * 490) + (pro_count * 1490)

    # Fetch 5 Recent Transactions
    q_txns = await db.execute(
        select(PaymentLog, User)
        .join(User, PaymentLog.user_id == User.id)
        .order_by(PaymentLog.created_at.desc())
        .limit(5)
    )
    
    recent_transactions = []
    for log, user in q_txns.all():
        recent_transactions.append({
            "id": log.id,
            "user_email": user.email,
            "tran_id": log.tran_id,
            "amount": log.amount,
            "item_type": log.item_type,
            "item_id": log.item_id,
            "status": log.status,
            "error_reason": log.error_reason,
            "created_at": log.created_at.isoformat()
        })

    # System Health Status Checklist (Checks for configured API keys)
    keys_configured = {
        "voidai": bool(await get_system_setting(db, "VOIDAI_API_KEY")),
        "google_maps": bool(await get_system_setting(db, "GOOGLE_MAPS_API_KEY")),
        "facebook_ads": bool(await get_system_setting(db, "META_ACCESS_TOKEN")),
        "claude_ai": bool(await get_system_setting(db, "ANTHROPIC_API_KEY")),
        "chatgpt_ai": bool(await get_system_setting(db, "OPENAI_API_KEY")),
        "gemini_ai": bool(await get_system_setting(db, "GEMINI_API_KEY")),
        "sslcommerz": bool(
            (await get_system_setting(db, "SSLCOMMERZ_STORE_ID")) and 
            (await get_system_setting(db, "SSLCOMMERZ_STORE_PASSWORD"))
        )
    }

    return {
        "total_users": total_users,
        "starter_users": starter_count,
        "pro_users": pro_count,
        "system_mrr": system_mrr,
        "total_sent": total_sent,
        "total_leads": total_leads,
        "warmup_pool_size": warmup_pool_size,
        "total_revenue": total_revenue,
        "active_campaigns": active_campaigns,
        "pending_tickets": pending_tickets,
        "promo_uses": promo_uses,
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

    # Scalar subqueries to avoid N+1 query problem per user
    leads_sub = select(func.count(Lead.id)).where(Lead.user_id == User.id).scalar_subquery()
    campaigns_sub = select(func.count(Campaign.id)).where(Campaign.user_id == User.id).scalar_subquery()
    accounts_sub = select(func.count(EmailAccount.id)).where(EmailAccount.user_id == User.id).scalar_subquery()

    query = select(User, leads_sub, campaigns_sub, accounts_sub)
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
    results = q_res.all()
    
    users_data = []
    for u, leads_count, campaigns_count, accounts_count in results:
        d = u.to_dict()
        d["leads_count"] = leads_count or 0
        d["campaigns_count"] = campaigns_count or 0
        d["accounts_count"] = accounts_count or 0
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
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns gateway transaction logs across the platform, optionally filtered by email/ref/status."""
    await verify_admin_status(current_user["id"], db)

    query = (
        select(PaymentLog, User)
        .join(User, PaymentLog.user_id == User.id)
    )

    conditions = []
    if search:
        search_val = f"%{search.strip().lower()}%"
        conditions.append(
            func.lower(User.email).like(search_val) | 
            func.lower(PaymentLog.tran_id).like(search_val)
        )
    if status:
        conditions.append(PaymentLog.status == status.strip().lower())

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(PaymentLog.created_at.desc())
    q_logs = await db.execute(query)
    
    transactions = []
    for log, user in q_logs.all():
        transactions.append({
            "id": log.id,
            "user_email": user.email,
            "tran_id": log.tran_id,
            "amount": log.amount,
            "item_type": log.item_type,
            "item_id": log.item_id,
            "status": log.status,
            "error_reason": log.error_reason,
            "created_at": log.created_at.isoformat()
        })
    return transactions

@router.delete("/transactions/{transaction_id}")
async def admin_delete_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows super admin to permanently delete a payment transaction log entry."""
    await verify_admin_status(current_user["id"], db)

    q = await db.execute(select(PaymentLog).where(PaymentLog.id == transaction_id))
    txn = q.scalars().first()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

    await db.delete(txn)
    await db.commit()

    logger.info(f"Admin {current_user['email']} deleted transaction {transaction_id} (tran_id={txn.tran_id})")
    return {"message": "Transaction deleted successfully.", "deleted_id": transaction_id}

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


class SettingsUpdatePayload(BaseModel):
    settings: dict


def mask_api_key(val: str) -> str:
    if not val:
        return ""
    val = val.strip()
    if len(val) <= 8:
        return "*" * len(val)
    return val[:6] + "..." + val[-4:]


@router.get("/settings")
async def get_admin_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves all backend system settings, masked for security."""
    await verify_admin_status(current_user["id"], db)

    keys_to_fetch = [
        "VOIDAI_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLE_MAPS_API_KEY",
        "META_ACCESS_TOKEN",
        "GEMINI_API_KEY",
        "SSLCOMMERZ_STORE_ID",
        "SSLCOMMERZ_STORE_PASSWORD"
    ]

    settings_data = {}
    for key in keys_to_fetch:
        db_val = None
        db_source = "none"
        try:
            q = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            setting = q.scalars().first()
            if setting and setting.value is not None:
                db_val = setting.value
                db_source = "database"
        except Exception:
            pass

        if db_val is None:
            env_val = getattr(settings, key, "")
            if env_val:
                db_val = env_val
                db_source = "environment"
            else:
                db_val = ""
                db_source = "none"

        settings_data[key] = {
            "value": mask_api_key(db_val),
            "source": db_source,
            "is_set": bool(db_val)
        }

    return settings_data


@router.post("/settings")
async def update_admin_settings(
    payload: SettingsUpdatePayload,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates system settings, ignoring masked values."""
    await verify_admin_status(current_user["id"], db)

    keys_to_update = [
        "VOIDAI_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLE_MAPS_API_KEY",
        "META_ACCESS_TOKEN",
        "GEMINI_API_KEY",
        "SSLCOMMERZ_STORE_ID",
        "SSLCOMMERZ_STORE_PASSWORD"
    ]

    updated_keys = []
    for key, value in payload.settings.items():
        if key not in keys_to_update:
            continue

        value_str = str(value).strip()
        is_masked = "..." in value_str or value_str.startswith("****")
        if is_masked:
            continue

        if not value_str:
            q = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            setting = q.scalars().first()
            if setting:
                await db.delete(setting)
                updated_keys.append(key)
        else:
            q = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            setting = q.scalars().first()
            if setting:
                setting.value = value_str
            else:
                setting = SystemSetting(key=key, value=value_str)
                db.add(setting)
            updated_keys.append(key)

    await db.commit()
    if updated_keys:
        await log_audit(db, current_user["email"], "settings_change", "system_settings", f"Updated keys: {', '.join(updated_keys)}")
    return {"message": f"Successfully updated settings: {', '.join(updated_keys)}" if updated_keys else "No changes detected."}


@router.post("/users/{user_id}/impersonate")
async def impersonate_user(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows super admin to generate a JWT bypass token to impersonate any user."""
    await verify_admin_status(current_user["id"], db)

    q_user = await db.execute(select(User).where(User.id == user_id))
    target_user = q_user.scalars().first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user profile not found."
        )

    from datetime import datetime, timedelta, timezone
    import jwt

    exp = datetime.now(timezone.utc) + timedelta(hours=24)
    payload = {
        "sub": str(target_user.id),
        "email": target_user.email,
        "exp": exp,
        "user_metadata": {
            "name": target_user.name or "",
            "avatar_url": target_user.avatar or ""
        }
    }
    
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    await log_audit(db, current_user["email"], "impersonate", target_user.email, f"Impersonated user ID: {target_user.id}")
    return {
        "token": token,
        "user": target_user.to_dict()
    }


from app.models import AILog

@router.get("/ai-stats")
async def get_ai_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves system-wide aggregate token counts and estimated costs."""
    await verify_admin_status(current_user["id"], db)

    q_tokens = await db.execute(
        select(
            func.sum(AILog.prompt_tokens),
            func.sum(AILog.completion_tokens),
            func.sum(AILog.cost)
        )
    )
    res_tokens = q_tokens.first()
    total_prompt = res_tokens[0] or 0
    total_completion = res_tokens[1] or 0
    total_cost = res_tokens[2] or 0.0

    q_models = await db.execute(
        select(AILog.model, func.count(AILog.id), func.sum(AILog.cost))
        .group_by(AILog.model)
    )
    model_breakdown = []
    for model, count, cost in q_models.all():
        model_breakdown.append({
            "model": model,
            "count": count or 0,
            "cost": cost or 0.0
        })

    q_providers = await db.execute(
        select(AILog.provider, func.count(AILog.id), func.sum(AILog.cost))
        .group_by(AILog.provider)
    )
    provider_breakdown = []
    for provider, count, cost in q_providers.all():
        provider_breakdown.append({
            "provider": provider,
            "count": count or 0,
            "cost": cost or 0.0
        })

    q_logs = await db.execute(
        select(AILog, User)
        .join(User, AILog.user_id == User.id)
        .order_by(AILog.created_at.desc())
        .limit(10)
    )
    recent_logs = []
    for log, user in q_logs.all():
        recent_logs.append({
            "id": log.id,
            "user_email": user.email,
            "provider": log.provider,
            "model": log.model,
            "tokens": log.prompt_tokens + log.completion_tokens,
            "cost": log.cost,
            "created_at": log.created_at.isoformat()
        })

    return {
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_cost": total_cost,
        "model_breakdown": model_breakdown,
        "provider_breakdown": provider_breakdown,
        "recent_logs": recent_logs
    }


@router.get("/outreach-health")
async def get_outreach_health(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Calculates system-wide outreach statistics and sender accounts health."""
    await verify_admin_status(current_user["id"], db)

    q_status = await db.execute(
        select(CampaignLead.status, func.count(CampaignLead.id))
        .group_by(CampaignLead.status)
    )
    status_counts = {status: count for status, count in q_status.all()}
    
    total_sent = status_counts.get("sent", 0) + status_counts.get("opened", 0) + status_counts.get("replied", 0) + status_counts.get("bounced", 0)
    total_opened = status_counts.get("opened", 0) + status_counts.get("replied", 0)
    total_replied = status_counts.get("replied", 0)
    total_bounced = status_counts.get("bounced", 0)

    system_bounce_rate = (total_bounced / total_sent * 100) if total_sent > 0 else 0.0
    system_open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0.0
    system_reply_rate = (total_replied / total_sent * 100) if total_sent > 0 else 0.0

    q_senders = await db.execute(
        select(EmailAccount, User)
        .join(User, EmailAccount.user_id == User.id)
        .order_by(EmailAccount.warmup_health_score)
    )
    
    senders_list = []
    for acc, user in q_senders.all():
        senders_list.append({
            "id": acc.id,
            "user_email": user.email,
            "from_email": acc.from_email,
            "provider": acc.provider,
            "health_score": acc.warmup_health_score,
            "warmup_enabled": acc.warmup_enabled,
            "warmup_status": acc.warmup_status,
            "is_active": acc.is_active,
            "emails_sent_today": acc.emails_sent_today,
            "daily_limit": acc.daily_limit,
            "created_at": acc.created_at.isoformat()
        })

    return {
        "system_bounce_rate": system_bounce_rate,
        "system_open_rate": system_open_rate,
        "system_reply_rate": system_reply_rate,
        "total_sent": total_sent,
        "total_bounced": total_bounced,
        "total_opened": total_opened,
        "total_replied": total_replied,
        "senders": senders_list
    }


@router.get("/maintenance")
async def get_maintenance_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns current maintenance mode status."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(SystemSetting).where(SystemSetting.key == "MAINTENANCE_MODE"))
    setting = q.scalars().first()
    is_active = setting is not None and setting.value == "true"
    return {"maintenance_mode": is_active}


@router.post("/maintenance")
async def toggle_maintenance_mode(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggles platform maintenance mode on or off."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(SystemSetting).where(SystemSetting.key == "MAINTENANCE_MODE"))
    setting = q.scalars().first()

    if setting:
        # Toggle existing value
        setting.value = "false" if setting.value == "true" else "true"
    else:
        # Create with default "true" (turning it on)
        setting = SystemSetting(key="MAINTENANCE_MODE", value="true")
        db.add(setting)

    await db.commit()
    await log_audit(db, current_user["email"], "maintenance_toggle", "platform", f"New state: {setting.value}")
    return {"maintenance_mode": setting.value == "true", "message": f"Maintenance mode {'enabled' if setting.value == 'true' else 'disabled'} successfully."}


# ── Pricing & Plan Settings ──────────────────────────────────────────────────

PRICING_DEFAULTS = {
    "FREE_SIGNUP_CREDITS":   "50",
    "STARTER_PRICE_BDT":     "490",
    "STARTER_CREDITS":       "2500",
    "PRO_PRICE_BDT":         "1490",
    "PRO_CREDITS":           "10000",
    "BUSINESS_PRICE_BDT":    "2950",
    "BUSINESS_CREDITS":      "25000",
}

@router.get("/pricing")
async def get_pricing_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all dynamic pricing settings with their current values."""
    await verify_admin_status(current_user["id"], db)

    result = {}
    for key, default in PRICING_DEFAULTS.items():
        q = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = q.scalars().first()
        result[key] = setting.value if setting else default

    return result


@router.post("/pricing")
async def update_pricing_settings(
    payload: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Saves updated pricing settings to system_settings table."""
    await verify_admin_status(current_user["id"], db)

    allowed_keys = set(PRICING_DEFAULTS.keys())
    updated = []

    for key, value in payload.items():
        if key not in allowed_keys:
            continue
        try:
            int_val = int(value)
            if int_val < 0:
                raise ValueError
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Invalid value for {key}: must be a non-negative integer.")

        q = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = q.scalars().first()
        if setting:
            setting.value = str(int_val)
        else:
            setting = SystemSetting(key=key, value=str(int_val))
            db.add(setting)
        updated.append(key)

    await db.commit()
    if updated:
        await log_audit(db, current_user["email"], "pricing_update", "pricing_settings", f"Updated keys: {', '.join(updated)}")
    return {"message": f"Updated {len(updated)} pricing settings successfully.", "updated": updated}


# ── Audit Log Helper ─────────────────────────────────────────────────────────

async def log_audit(db: AsyncSession, actor_email: str, action: str, target: str = None, details: str = None):
    """Utility to record an audit log entry."""
    entry = AuditLog(actor_email=actor_email, action=action, target=target, details=details)
    db.add(entry)
    await db.commit()


# ── Announcements CRUD ───────────────────────────────────────────────────────

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    type: str = "info"  # info, warning, critical

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/announcements")
async def list_announcements(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists all announcements (admin only)."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(Announcement).order_by(desc(Announcement.created_at)))
    return [a.to_dict() for a in q.scalars().all()]


@router.post("/announcements")
async def create_announcement(
    payload: AnnouncementCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new announcement."""
    await verify_admin_status(current_user["id"], db)
    if payload.type not in ("info", "warning", "critical"):
        raise HTTPException(status_code=400, detail="Type must be info, warning, or critical.")
    ann = Announcement(title=payload.title.strip(), message=payload.message.strip(), type=payload.type)
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
    await log_audit(db, current_user["email"], "announcement_create", ann.title, f"Type: {ann.type}")
    return ann.to_dict()


@router.put("/announcements/{ann_id}")
async def update_announcement(
    ann_id: str,
    payload: AnnouncementUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates an existing announcement."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(Announcement).where(Announcement.id == ann_id))
    ann = q.scalars().first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    if payload.title is not None:
        ann.title = payload.title.strip()
    if payload.message is not None:
        ann.message = payload.message.strip()
    if payload.type is not None:
        ann.type = payload.type
    if payload.is_active is not None:
        ann.is_active = payload.is_active
    await db.commit()
    await log_audit(db, current_user["email"], "announcement_update", ann.title)
    return ann.to_dict()


@router.delete("/announcements/{ann_id}")
async def delete_announcement(
    ann_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes an announcement."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(Announcement).where(Announcement.id == ann_id))
    ann = q.scalars().first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    title = ann.title
    await db.delete(ann)
    await db.commit()
    await log_audit(db, current_user["email"], "announcement_delete", title)
    return {"message": "Announcement deleted."}


# ── Public: Active Announcements (for user dashboard) ───────────────────────

@router.get("/announcements/active")
async def get_active_announcements(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns active announcements for the user dashboard banner."""
    q = await db.execute(
        select(Announcement)
        .where(Announcement.is_active == True)
        .order_by(desc(Announcement.created_at))
        .limit(5)
    )
    return [a.to_dict() for a in q.scalars().all()]


# ── Audit Log ────────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = None,
    limit: int = 100
):
    """Returns audit log entries with optional search."""
    await verify_admin_status(current_user["id"], db)
    query = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
    if search:
        search_term = f"%{search}%"
        query = select(AuditLog).where(
            (AuditLog.actor_email.ilike(search_term)) |
            (AuditLog.action.ilike(search_term)) |
            (AuditLog.target.ilike(search_term))
        ).order_by(desc(AuditLog.created_at)).limit(limit)
    q = await db.execute(query)
    return [e.to_dict() for e in q.scalars().all()]


# ── Revenue Analytics ────────────────────────────────────────────────────────

@router.get("/revenue")
async def get_revenue_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns revenue analytics: monthly breakdown, plan distribution, totals."""
    await verify_admin_status(current_user["id"], db)
    from datetime import datetime, timedelta
    from sqlalchemy import extract

    # Total revenue (all time)
    q_total = await db.execute(
        select(func.sum(PaymentLog.amount)).where(PaymentLog.status == "success")
    )
    total_revenue = q_total.scalar() or 0.0

    # Total successful transactions
    q_count = await db.execute(
        select(func.count(PaymentLog.id)).where(PaymentLog.status == "success")
    )
    total_transactions = q_count.scalar() or 0

    # Total users
    q_users = await db.execute(select(func.count(User.id)))
    total_users = q_users.scalar() or 0
    arpu = total_revenue / max(1, total_users)

    # Revenue by plan distribution
    q_plan_rev = await db.execute(
        select(PaymentLog.item_id, func.sum(PaymentLog.amount), func.count(PaymentLog.id))
        .where(PaymentLog.status == "success")
        .group_by(PaymentLog.item_id)
    )
    plan_breakdown = [
        {"plan": row[0], "revenue": row[1] or 0, "count": row[2] or 0}
        for row in q_plan_rev.all()
    ]

    # Monthly revenue (last 12 months)
    twelve_months_ago = datetime.utcnow() - timedelta(days=365)
    q_monthly = await db.execute(
        select(
            extract("year", PaymentLog.created_at).label("year"),
            extract("month", PaymentLog.created_at).label("month"),
            func.sum(PaymentLog.amount),
            func.count(PaymentLog.id)
        )
        .where(and_(PaymentLog.status == "success", PaymentLog.created_at >= twelve_months_ago))
        .group_by("year", "month")
        .order_by("year", "month")
    )
    monthly_data = [
        {"year": int(row[0]), "month": int(row[1]), "revenue": row[2] or 0, "transactions": row[3] or 0}
        for row in q_monthly.all()
    ]

    # User plan distribution
    q_plans = await db.execute(
        select(User.plan, func.count(User.id)).group_by(User.plan)
    )
    user_plan_distribution = [
        {"plan": row[0], "count": row[1]} for row in q_plans.all()
    ]

    # Current MRR (this month's revenue)
    now = datetime.utcnow()
    q_mrr = await db.execute(
        select(func.sum(PaymentLog.amount))
        .where(and_(
            PaymentLog.status == "success",
            extract("year", PaymentLog.created_at) == now.year,
            extract("month", PaymentLog.created_at) == now.month
        ))
    )
    current_mrr = q_mrr.scalar() or 0.0

    return {
        "total_revenue": total_revenue,
        "total_transactions": total_transactions,
        "total_users": total_users,
        "arpu": round(arpu, 2),
        "current_mrr": current_mrr,
        "plan_breakdown": plan_breakdown,
        "monthly_data": monthly_data,
        "user_plan_distribution": user_plan_distribution,
    }


@router.get("/analytics/users")
async def get_user_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns user signup trends, active vs inactive stats, and top users leaderboard."""
    await verify_admin_status(current_user["id"], db)
    from datetime import datetime, timedelta

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    # 1. Signups trend (last 30 days)
    q_signups = await db.execute(
        select(
            func.date(User.created_at).label("signup_date"),
            func.count(User.id).label("count")
        )
        .where(User.created_at >= thirty_days_ago)
        .group_by("signup_date")
        .order_by("signup_date")
    )
    signups_trend = [{"date": str(row[0]), "count": row[1]} for row in q_signups.all()]

    # 2. Total and active/inactive count
    q_total = await db.execute(select(func.count(User.id)))
    total_users = q_total.scalar() or 0

    # Active users in last 30 days (scraped leads or launched campaigns)
    q_act_leads = await db.execute(
        select(Lead.user_id)
        .where(Lead.created_at >= thirty_days_ago)
        .distinct()
    )
    q_act_campaigns = await db.execute(
        select(Campaign.user_id)
        .where(Campaign.created_at >= thirty_days_ago)
        .distinct()
    )
    active_ids = {row[0] for row in q_act_leads.all()} | {row[0] for row in q_act_campaigns.all()}
    active_users = len(active_ids)
    inactive_users = max(0, total_users - active_users)

    # 3. Top users leaderboard by leads scraped
    q_top_leads = await db.execute(
        select(User.email, User.name, func.count(Lead.id).label("cnt"))
        .join(Lead, User.id == Lead.user_id)
        .group_by(User.id, User.email, User.name)
        .order_by(desc("cnt"))
        .limit(10)
    )
    top_leads = [{"email": r[0], "name": r[1] or "No Name", "count": r[2]} for r in q_top_leads.all()]

    # 4. Top users by campaigns created
    q_top_campaigns = await db.execute(
        select(User.email, User.name, func.count(Campaign.id).label("cnt"))
        .join(Campaign, User.id == Campaign.user_id)
        .group_by(User.id, User.email, User.name)
        .order_by(desc("cnt"))
        .limit(10)
    )
    top_campaigns = [{"email": r[0], "name": r[1] or "No Name", "count": r[2]} for r in q_top_campaigns.all()]

    return {
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": inactive_users,
        "signups_trend": signups_trend,
        "leaderboard_leads": top_leads,
        "leaderboard_campaigns": top_campaigns
    }


@router.get("/analytics/campaigns")
async def get_campaign_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns platform campaign statuses, send volume performance, and top campaigns."""
    await verify_admin_status(current_user["id"], db)

    # 1. Campaign count by status
    q_status = await db.execute(
        select(Campaign.status, func.count(Campaign.id))
        .group_by(Campaign.status)
    )
    status_counts = {r[0]: r[1] for r in q_status.all()}
    
    # Ensure standard statuses exist
    for status_key in ["draft", "active", "paused", "completed"]:
        if status_key not in status_counts:
            status_counts[status_key] = 0

    # 2. Campaign lead stats breakdown (sent, opened, replied, bounced)
    q_lead_stats = await db.execute(
        select(CampaignLead.status, func.count(CampaignLead.id))
        .group_by(CampaignLead.status)
    )
    lead_stats = {r[0]: r[1] for r in q_lead_stats.all()}
    
    total_leads = sum(lead_stats.values())
    sent = lead_stats.get("sent", 0) + lead_stats.get("opened", 0) + lead_stats.get("replied", 0) + lead_stats.get("bounced", 0)
    opened = lead_stats.get("opened", 0) + lead_stats.get("replied", 0)
    replied = lead_stats.get("replied", 0)
    bounced = lead_stats.get("bounced", 0)

    # 3. Top performing campaigns by reply volume
    q_top = await db.execute(
        select(
            Campaign.name,
            User.email,
            func.count(CampaignLead.id).label("total"),
            func.sum(case((CampaignLead.status != "pending", 1), else_=0)).label("sent_cnt"),
            func.sum(case((CampaignLead.status == "replied", 1), else_=0)).label("replied_cnt"),
            func.sum(case((CampaignLead.status == "opened", 1), else_=0)).label("opened_cnt")
        )
        .join(Campaign, CampaignLead.campaign_id == Campaign.id)
        .join(User, Campaign.user_id == User.id)
        .group_by(Campaign.id, Campaign.name, User.email)
        .order_by(desc("replied_cnt"))
        .limit(10)
    )
    
    top_campaigns = []
    for r in q_top.all():
        sent_count = r[3] or 0
        replied_count = r[4] or 0
        opened_count = r[5] or 0
        reply_rate = (replied_count / sent_count * 100) if sent_count > 0 else 0.0
        open_rate = (opened_count / sent_count * 100) if sent_count > 0 else 0.0
        top_campaigns.append({
            "name": r[0],
            "user_email": r[1],
            "total_leads": r[2],
            "sent": sent_count,
            "replied": replied_count,
            "reply_rate": round(reply_rate, 1),
            "open_rate": round(open_rate, 1)
        })

    return {
        "status_counts": status_counts,
        "email_metrics": {
            "total_leads": total_leads,
            "sent": sent,
            "opened": opened,
            "replied": replied,
            "bounced": bounced,
            "open_rate": round((opened / sent * 100), 1) if sent > 0 else 0.0,
            "reply_rate": round((replied / sent * 100), 1) if sent > 0 else 0.0,
            "bounce_rate": round((bounced / sent * 100), 1) if sent > 0 else 0.0,
        },
        "top_campaigns": top_campaigns
    }


# ── Promo Codes CRUD ─────────────────────────────────────────────────────────

class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str  # percentage, fixed, credits
    discount_value: float
    max_uses: Optional[int] = None
    expiry_at: Optional[str] = None  # ISO format string

class PromoCodeUpdate(BaseModel):
    is_active: Optional[bool] = None


@router.get("/promo-codes")
async def list_promo_codes(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists all promo codes (admin only)."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(PromoCode).order_by(desc(PromoCode.created_at)))
    return [p.to_dict() for p in q.scalars().all()]


@router.post("/promo-codes")
async def create_promo_code(
    payload: PromoCodeCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new promo code."""
    await verify_admin_status(current_user["id"], db)
    
    code_str = payload.code.strip().upper()
    if not code_str:
        raise HTTPException(status_code=400, detail="Promo code cannot be empty.")
        
    if payload.discount_type not in ("percentage", "fixed", "credits"):
        raise HTTPException(status_code=400, detail="Type must be percentage, fixed, or credits.")
        
    if payload.discount_value <= 0:
        raise HTTPException(status_code=400, detail="Value must be greater than zero.")

    # Check duplicate
    q_exists = await db.execute(select(PromoCode).where(PromoCode.code == code_str))
    if q_exists.scalars().first():
        raise HTTPException(status_code=400, detail=f"Promo code {code_str} already exists.")

    expiry = None
    if payload.expiry_at:
        try:
            from datetime import datetime
            expiry = datetime.fromisoformat(payload.expiry_at.replace("Z", ""))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for expiry_at.")

    promo = PromoCode(
        code=code_str,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        max_uses=payload.max_uses,
        expiry_at=expiry
    )
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    await log_audit(db, current_user["email"], "promo_create", promo.code, f"Type: {promo.discount_type}, Value: {promo.discount_value}")
    return promo.to_dict()


@router.put("/promo-codes/{promo_id}")
async def update_promo_code(
    promo_id: str,
    payload: PromoCodeUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggles status of an existing promo code."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(PromoCode).where(PromoCode.id == promo_id))
    promo = q.scalars().first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found.")
        
    if payload.is_active is not None:
        promo.is_active = payload.is_active
        
    await db.commit()
    await log_audit(db, current_user["email"], "promo_update", promo.code, f"Active: {promo.is_active}")
    return promo.to_dict()


@router.delete("/promo-codes/{promo_id}")
async def delete_promo_code(
    promo_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a promo code."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(PromoCode).where(PromoCode.id == promo_id))
    promo = q.scalars().first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found.")
        
    code_name = promo.code
    await db.delete(promo)
    await db.commit()
    await log_audit(db, current_user["email"], "promo_delete", code_name)
    return {"message": "Promo code deleted successfully."}


# ── Global Blacklist CRUD & CSV Import ────────────────────────────────────────

class GlobalBlacklistCreate(BaseModel):
    type: str  # email or domain
    value: str
    reason: Optional[str] = None

@router.get("/global-blacklist")
async def list_global_blacklist(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all global blacklist entries."""
    await verify_admin_status(current_user["id"], db)
    query = select(GlobalBlacklist)
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                GlobalBlacklist.value.ilike(search_term),
                GlobalBlacklist.reason.ilike(search_term)
            )
        )
    query = query.order_by(GlobalBlacklist.created_at.desc())
    res = await db.execute(query)
    entries = res.scalars().all()
    return [e.to_dict() for e in entries]

@router.post("/global-blacklist")
async def add_global_blacklist_entry(
    request: GlobalBlacklistCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a domain or email to the global blacklist."""
    await verify_admin_status(current_user["id"], db)
    val = request.value.strip().lower()
    entry_type = request.type.strip().lower()

    if not val:
        raise HTTPException(status_code=400, detail="Value cannot be empty.")
    if entry_type not in ["email", "domain"]:
        raise HTTPException(status_code=400, detail="Type must be either 'email' or 'domain'.")

    # Check if entry already exists
    q = await db.execute(select(GlobalBlacklist).where(GlobalBlacklist.value == val))
    existing = q.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="This value is already globally blacklisted.")

    entry = GlobalBlacklist(
        type=entry_type,
        value=val,
        reason=request.reason
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    await log_audit(db, current_user["email"], "global_blacklist_add", val, f"Type: {entry_type}, Reason: {request.reason}")
    return entry.to_dict()

@router.delete("/global-blacklist/{entry_id}")
async def delete_global_blacklist_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a global blacklist entry."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(GlobalBlacklist).where(GlobalBlacklist.id == entry_id))
    entry = q.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Blacklist entry not found.")

    val = entry.value
    await db.delete(entry)
    await db.commit()

    await log_audit(db, current_user["email"], "global_blacklist_delete", val)
    return {"message": f"Successfully removed {val} from global blacklist."}

@router.post("/global-blacklist/import")
async def import_global_blacklist_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Bulk import global blacklist entries from CSV."""
    await verify_admin_status(current_user["id"], db)
    
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    try:
        content = await file.read()
        csv_text = content.decode("utf-8")
        reader = csv.reader(io.StringIO(csv_text))
        
        header = next(reader, None)
        if not header:
            raise HTTPException(status_code=400, detail="Empty CSV file.")

        value_idx = -1
        type_idx = -1
        reason_idx = -1

        for idx, col in enumerate(header):
            col_lower = col.strip().lower()
            if col_lower in ["value", "email", "domain", "address"]:
                value_idx = idx
            elif col_lower in ["type", "category"]:
                type_idx = idx
            elif col_lower in ["reason", "details", "comment"]:
                reason_idx = idx

        if value_idx == -1:
            value_idx = 0  # Fallback

        imported_count = 0
        skipped_count = 0

        for row in reader:
            if not row or value_idx >= len(row):
                continue
                
            val = row[value_idx].strip().lower()
            if not val:
                continue

            # Guess type by checking for @ symbol
            entry_type = "email"
            if type_idx != -1 and type_idx < len(row):
                parsed_type = row[type_idx].strip().lower()
                if parsed_type in ["email", "domain"]:
                    entry_type = parsed_type
            else:
                if "@" not in val and "." in val:
                    entry_type = "domain"

            reason = ""
            if reason_idx != -1 and reason_idx < len(row):
                reason = row[reason_idx].strip()
            else:
                reason = "Imported via admin CSV"

            # Check if exists in global blacklist
            q = await db.execute(select(GlobalBlacklist).where(GlobalBlacklist.value == val))
            existing = q.scalars().first()
            if existing:
                skipped_count += 1
                continue

            entry = GlobalBlacklist(
                type=entry_type,
                value=val,
                reason=reason
            )
            db.add(entry)
            imported_count += 1

        if imported_count > 0:
            await db.commit()
            await log_audit(db, current_user["email"], "global_blacklist_import", f"Count: {imported_count}")

        return {
            "message": f"Successfully imported {imported_count} entries to global blacklist.",
            "imported": imported_count,
            "skipped": skipped_count
        }
    except Exception as e:
        logger.error(f"Global blacklist CSV import failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")


# ── Support Tickets Admin Console ────────────────────────────────────────────

class TicketStatusUpdate(BaseModel):
    status: str

class TicketReplyAdminCreate(BaseModel):
    message: str

@router.get("/tickets/pending-count")
async def get_pending_tickets_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get count of open support tickets that need admin attention."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(
        select(func.count(SupportTicket.id)).where(SupportTicket.status == "open")
    )
    count = q.scalar() or 0
    return {"pending_count": count}

@router.get("/tickets")
async def list_all_tickets(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all user tickets on the platform."""
    await verify_admin_status(current_user["id"], db)
    query = select(SupportTicket)
    if status_filter:
        query = query.where(SupportTicket.status == status_filter.strip().lower())
    query = query.order_by(SupportTicket.updated_at.desc())
    res = await db.execute(query)
    tickets = res.scalars().all()

    # We want to attach user email
    ticket_list = []
    for t in tickets:
        q_user = await db.execute(select(User).where(User.id == t.user_id))
        u = q_user.scalars().first()
        t_dict = t.to_dict()
        t_dict["user_email"] = u.email if u else "unknown@getleads.com"
        ticket_list.append(t_dict)

    return ticket_list

@router.get("/tickets/{ticket_id}")
async def get_ticket_details_admin(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve ticket details with reply thread for admin."""
    await verify_admin_status(current_user["id"], db)
    q = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = q.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    q_user = await db.execute(select(User).where(User.id == ticket.user_id))
    u = q_user.scalars().first()

    q_replies = await db.execute(select(TicketReply).where(TicketReply.ticket_id == ticket_id).order_by(TicketReply.created_at.asc()))
    replies = q_replies.scalars().all()

    ticket_dict = ticket.to_dict()
    ticket_dict["user_email"] = u.email if u else "unknown@getleads.com"
    ticket_dict["user_name"] = u.name if u else "Customer"

    return {
        "ticket": ticket_dict,
        "replies": [r.to_dict() for r in replies]
    }

@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket_admin(
    ticket_id: str,
    request: TicketReplyAdminCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Post an admin reply to a ticket, setting status to in_progress."""
    await verify_admin_status(current_user["id"], db)
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    q = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = q.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # Create admin reply
    reply = TicketReply(
        ticket_id=ticket.id,
        sender_email=current_user["email"],
        is_admin_reply=True,
        message=message
    )
    db.add(reply)
    
    # Update ticket status to in_progress
    ticket.status = "in_progress"
    
    await db.commit()
    await db.refresh(reply)

    # Trigger email notification to user
    q_user = await db.execute(select(User).where(User.id == ticket.user_id))
    user = q_user.scalars().first()
    if user:
        from app.utils.email_sender import send_system_email
        subject = f"Support Reply: {ticket.title}"
        body = (
            f"Hello {user.name or 'Customer'},\n\n"
            f"Our support team has replied to your ticket \"{ticket.title}\":\n\n"
            f"Message:\n"
            f"\"{message}\"\n\n"
            f"To view the full thread or reply, please visit your support panel: "
            f"{settings.FRONTEND_URL}/support\n\n"
            f"Best regards,\n"
            f"GetLeads Support"
        )
        await send_system_email(user.email, subject, body, db)

    await log_audit(db, current_user["email"], "ticket_reply", ticket.id, f"Admin replied to: {ticket.title}")
    return reply.to_dict()

@router.put("/tickets/{ticket_id}/status")
async def update_ticket_status_admin(
    ticket_id: str,
    request: TicketStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change ticket status."""
    await verify_admin_status(current_user["id"], db)
    new_status = request.status.strip().lower()
    if new_status not in ["open", "in_progress", "resolved", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status option.")

    q = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = q.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    old_status = ticket.status
    ticket.status = new_status
    await db.commit()

    await log_audit(db, current_user["email"], "ticket_status_update", ticket.id, f"Changed status from {old_status} to {new_status}")
    return ticket.to_dict()


# ── Reports CSV Downloads ───────────────────────────────────────────────────

@router.get("/reports/revenue")
async def download_revenue_report(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate and stream all time success payments report."""
    await verify_admin_status(current_user["id"], db)
    
    # Query all success payments
    q = await db.execute(
        select(PaymentLog)
        .where(PaymentLog.status == "success")
        .order_by(PaymentLog.created_at.desc())
    )
    logs = q.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Transaction ID", "User ID", "User Email", "Amount (BDT)", 
        "Item Type", "Item ID", "Promo Code Used", "Date Created"
    ])
    
    for log in logs:
        # Fetch user email
        qu = await db.execute(select(User).where(User.id == log.user_id))
        u = qu.scalars().first()
        email = u.email if u else "unknown@getleads.com"
        
        writer.writerow([
            log.tran_id, log.user_id, email, f"{log.amount:.2f}",
            log.item_type, log.item_id, log.promo_code or "-",
            log.created_at.isoformat() if log.created_at else ""
        ])
    
    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=revenue_report.csv"
    return response

@router.get("/reports/users")
async def download_users_report(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate and stream all users report."""
    await verify_admin_status(current_user["id"], db)
    
    q = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = q.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "User ID", "Name", "Email", "Plan", "Credits Balance", 
        "Is Admin", "Telegram Configured", "Date Joined"
    ])
    
    for u in users:
        tg_conf = "Yes" if (u.telegram_chat_id and u.telegram_bot_token) else "No"
        writer.writerow([
            u.id, u.name or "-", u.email, u.plan, u.credits,
            "Yes" if u.is_admin else "No", tg_conf,
            u.created_at.isoformat() if u.created_at else ""
        ])
        
    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=users_report.csv"
    return response

@router.get("/reports/campaigns")
async def download_campaigns_report(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate and stream campaign health metrics report."""
    await verify_admin_status(current_user["id"], db)
    
    q = await db.execute(
        select(Campaign).order_by(Campaign.created_at.desc())
    )
    camps = q.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Campaign ID", "Campaign Name", "User Email", "Status",
        "Total Leads", "Sent Count", "Replies Count", "Bounces Count",
        "Send Interval (m)", "Rotate Mailboxes", "Date Created"
    ])
    
    for camp in camps:
        # User email
        qu = await db.execute(select(User).where(User.id == camp.user_id))
        u = qu.scalars().first()
        email = u.email if u else "unknown@getleads.com"
        
        # Stats counts
        q_stats = await db.execute(
            select(CampaignLead.status, func.count(CampaignLead.id))
            .where(CampaignLead.campaign_id == camp.id)
            .group_by(CampaignLead.status)
        )
        counts = dict(q_stats.all())
        total_leads = sum(counts.values())
        
        sent = (counts.get("sent", 0) + counts.get("opened", 0) + 
                counts.get("replied", 0) + counts.get("bounced", 0))
        replied = counts.get("replied", 0)
        bounced = counts.get("bounced", 0)
        
        writer.writerow([
            camp.id, camp.name, email, camp.status,
            total_leads, sent, replied, bounced,
            camp.send_interval, "Yes" if camp.rotate_mailboxes else "No",
            camp.created_at.isoformat() if camp.created_at else ""
        ])
        
    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=campaigns_report.csv"
    return response

@router.get("/reports/credits")
async def download_credits_report(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate and stream system-wide credits consumption reports."""
    await verify_admin_status(current_user["id"], db)
    
    q = await db.execute(
        select(CreditsLog).order_by(CreditsLog.created_at.desc())
    )
    logs = q.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Log ID", "User Email", "Action Type", "Amount", 
        "Balance After", "Reference Code", "Timestamp"
    ])
    
    for log in logs:
        qu = await db.execute(select(User).where(User.id == log.user_id))
        u = qu.scalars().first()
        email = u.email if u else "unknown@getleads.com"
        
        writer.writerow([
            log.id, email, log.action, log.amount,
            log.balance_after, log.reference or "-",
            log.created_at.isoformat() if log.created_at else ""
        ])
        
    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=credits_report.csv"
    return response
