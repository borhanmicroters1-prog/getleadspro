from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import User
from app.config import settings
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user["id"]
    user_email = (current_user.get("email") or "").strip().lower()
    
    # Query the public.users profile from database by ID
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    
    # If not found by ID, try looking up by email (handles Supabase UUID vs mock ID mismatch)
    if not db_user and user_email:
        result_by_email = await db.execute(
            select(User).where(func.lower(User.email) == user_email)
        )
        db_user = result_by_email.scalars().first()
        if db_user:
            # Migrate the old record's ID to the current auth provider's ID
            old_id = db_user.id
            db_user.id = user_id
            await db.commit()
            await db.refresh(db_user)
    
    # If user profile doesn't exist in the database at all, create it
    if not db_user:
        is_admin_user = (
            user_email == settings.SUPER_ADMIN_EMAIL.strip().lower()
            or user_email == "admin@getleads.com"
            or user_email == "admin@getclient.com"
            or user_email == "borhan.seoexpert@gmail.com"
        )
        # Load free signup credits dynamically (falls back to 50)
        free_credits = 50
        if not is_admin_user:
            try:
                from app.models import SystemSetting
                q_setting = await db.execute(
                    select(SystemSetting).where(SystemSetting.key == "FREE_SIGNUP_CREDITS")
                )
                setting = q_setting.scalars().first()
                if setting:
                    free_credits = int(setting.value)
            except Exception:
                pass

        db_user = User(
            id=user_id,
            email=current_user["email"],
            name=current_user["name"],
            avatar=current_user["avatar"],
            plan="Pro" if is_admin_user else "Free",
            credits=10000 if is_admin_user else free_credits,
            is_admin=is_admin_user
        )
        db.add(db_user)
        
        # Log signup action in AuditLog
        try:
            from app.models import AuditLog
            audit_entry = AuditLog(
                actor_email=current_user["email"],
                action="signup",
                target=current_user["email"],
                details=f"User signed up successfully. Default credits: {10000 if is_admin_user else free_credits}"
            )
            db.add(audit_entry)
        except Exception as e:
            import logging
            logging.getLogger("auth").error(f"Failed to log signup audit entry: {str(e)}")

        await db.commit()
        await db.refresh(db_user)
        
    return db_user.to_dict()


class SettingsUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None


@router.put("/me")
async def update_settings(
    request: SettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalars().first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User profile not found.")

    if request.name is not None:
        user.name = request.name
    if request.avatar is not None:
        user.avatar = request.avatar
    if request.telegram_bot_token is not None:
        user.telegram_bot_token = request.telegram_bot_token.strip() or None
    if request.telegram_chat_id is not None:
        user.telegram_chat_id = request.telegram_chat_id.strip() or None

    await db.commit()
    await db.refresh(user)
    return user.to_dict()


@router.post("/telegram-test")
async def test_telegram_connection(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from fastapi import HTTPException
    from app.utils.telegram import send_telegram_notification
    
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found.")

    if not user.telegram_bot_token or not user.telegram_chat_id:
        raise HTTPException(
            status_code=400,
            detail="Telegram Bot Token and Chat ID must be configured and saved first."
        )

    success = await send_telegram_notification(
        user,
        f"🤖 <b>GetClient Telegram Integration Test</b>\n\n"
        f"Hello {user.name or 'there'}!\n"
        f"Your Telegram bot notifications are now successfully connected to GetClient. "
        f"You will receive instant reply notifications and daily summary reports here."
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to send Telegram message. Please check that your Bot Token is valid, "
                   "your Chat ID is correct, and that you have started a chat with the bot by typing /start."
        )

    return {"message": "Test message sent successfully. Please check your Telegram chat."}
