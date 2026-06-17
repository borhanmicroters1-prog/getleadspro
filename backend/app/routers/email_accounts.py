from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, and_
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import User, EmailAccount
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/email-accounts", tags=["Email Accounts"])

class GmailConnectRequest(BaseModel):
  code: Optional[str] = None
  redirect_uri: Optional[str] = None
  from_name: Optional[str] = None
  app_password: Optional[str] = None
  from_email: Optional[str] = None
  daily_limit: Optional[int] = 50

class BrevoConnectRequest(BaseModel):
  api_key: str
  from_email: str
  from_name: str
  daily_limit: Optional[int] = 300

@router.get("")
async def list_email_accounts(
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  from sqlalchemy import and_
  result = await db.execute(
    select(EmailAccount).where(
      and_(
        EmailAccount.user_id == current_user["id"],
        EmailAccount.is_system_seed == False
      )
    )
  )
  accounts = result.scalars().all()
  return [account.to_dict() for account in accounts]

@router.post("/gmail/connect")
async def connect_gmail(
  request: GmailConnectRequest,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  # Check if we are connecting using an App Password
  if request.app_password:
    from_email = request.from_email.strip().lower() if request.from_email else ""
    if not from_email or "@" not in from_email:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid Gmail email address."
      )
    if not request.app_password.strip():
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Gmail App Password cannot be empty."
      )
    from_name = request.from_name or current_user["name"] or "Me"
    
    # Check if Gmail account already connected for this user and email
    q = await db.execute(
      select(EmailAccount).where(
        and_(
          EmailAccount.user_id == current_user["id"],
          EmailAccount.from_email == from_email
        )
      )
    )
    account = q.scalars().first()
    
    if account:
      account.provider = "gmail"
      account.from_name = from_name
      account.access_token = request.app_password.strip()
      account.daily_limit = request.daily_limit or 50
      account.is_active = True
    else:
      account = EmailAccount(
        user_id=current_user["id"],
        provider="gmail",
        access_token=request.app_password.strip(),
        from_email=from_email,
        from_name=from_name,
        daily_limit=request.daily_limit or 50,
        is_active=True
      )
      db.add(account)
      
    await db.commit()
    await db.refresh(account)
    return account.to_dict()

  # In development fallback mode, we mock the OAuth code exchange
  print(f"DEBUG: request={request.model_dump()}, current_user={current_user}", flush=True)
  from_email = request.from_email.strip().lower() if (request.from_email and request.from_email.strip()) else (current_user["email"] or f"{current_user['id']}@gmail.com")
  from_name = request.from_name or current_user["name"] or "Me"
  
  # Check if Gmail account already connected for this user
  q = await db.execute(
    select(EmailAccount).where(
      and_(
        EmailAccount.user_id == current_user["id"],
        EmailAccount.from_email == from_email
      )
    )
  )
  account = q.scalars().first()
  
  if account:
    # Update token details
    account.provider = "gmail"
    account.from_name = from_name
    account.access_token = f"mock-access-token-{request.code or 'default'}"
    account.refresh_token = "mock-refresh-token"
    account.is_active = True
  else:
    # Create new account connection
    account = EmailAccount(
      user_id=current_user["id"],
      provider="gmail",
      access_token=f"mock-access-token-{request.code or 'default'}",
      refresh_token="mock-refresh-token",
      from_email=from_email,
      from_name=from_name,
      daily_limit=50,
      is_active=True
    )
    db.add(account)
    
  await db.commit()
  await db.refresh(account)
  return account.to_dict()


@router.post("/brevo/connect")
async def connect_brevo(
  request: BrevoConnectRequest,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  # Clean fields
  from_email = request.from_email.strip().lower()
  if "@" not in from_email:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Invalid sender email address."
    )
    
  if not request.api_key.strip():
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Brevo API Key cannot be empty."
    )

  # Check if Brevo account already connected for this email
  q = await db.execute(
    select(EmailAccount).where(
      and_(
        EmailAccount.user_id == current_user["id"],
        EmailAccount.from_email == from_email
      )
    )
  )
  account = q.scalars().first()
  
  if account:
    account.provider = "brevo"
    account.from_name = request.from_name
    account.access_token = request.api_key
    account.daily_limit = request.daily_limit or 300
    account.is_active = True
  else:
    account = EmailAccount(
      user_id=current_user["id"],
      provider="brevo",
      access_token=request.api_key,
      from_email=from_email,
      from_name=request.from_name,
      daily_limit=request.daily_limit or 300,
      is_active=True
    )
    db.add(account)
    
  await db.commit()
  await db.refresh(account)
  return account.to_dict()

@router.delete("/{account_id}")
async def disconnect_email_account(
  account_id: str,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  stmt = delete(EmailAccount).where(
    and_(
      EmailAccount.id == account_id,
      EmailAccount.user_id == current_user["id"]
    )
  )
  result = await db.execute(stmt)
  await db.commit()
  
  if result.rowcount == 0:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Email account not found or unauthorized."
    )
    
  return {"message": "Email account disconnected successfully."}
