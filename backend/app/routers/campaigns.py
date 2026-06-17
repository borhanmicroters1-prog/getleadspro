from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, and_, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_db
from app.models import User, Campaign, CampaignLead, Lead
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])

class CampaignCreate(BaseModel):
  name: str
  email_account_id: Optional[str] = None
  rotate_mailboxes: bool = True
  rotate_mailbox_ids: Optional[str] = None
  ai_model: Optional[str] = "claude-3.5-sonnet"
  ai_prompt_template: Optional[str] = None
  lead_ids: List[str] = []
  subject_a: Optional[str] = None
  subject_b: Optional[str] = None
  body_template: Optional[str] = None
  follow_up_1_days: Optional[int] = None
  follow_up_1_body: Optional[str] = None
  follow_up_2_days: Optional[int] = None
  follow_up_2_body: Optional[str] = None
  follow_up_3_days: Optional[int] = None
  follow_up_3_body: Optional[str] = None
  send_start_hour: int = 9
  send_end_hour: int = 18
  timezone: str = "UTC"
  send_interval: int = 2
  status: str = "draft"

class CampaignUpdate(BaseModel):
  name: Optional[str] = None
  email_account_id: Optional[str] = None
  rotate_mailboxes: Optional[bool] = None
  rotate_mailbox_ids: Optional[str] = None
  ai_model: Optional[str] = None
  ai_prompt_template: Optional[str] = None
  subject_a: Optional[str] = None
  subject_b: Optional[str] = None
  body_template: Optional[str] = None
  follow_up_1_days: Optional[int] = None
  follow_up_1_body: Optional[str] = None
  follow_up_2_days: Optional[int] = None
  follow_up_2_body: Optional[str] = None
  follow_up_3_days: Optional[int] = None
  follow_up_3_body: Optional[str] = None
  send_start_hour: Optional[int] = None
  send_end_hour: Optional[int] = None
  timezone: Optional[str] = None
  send_interval: Optional[int] = None

@router.get("")
async def list_campaigns(
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  q = await db.execute(
    select(Campaign).where(Campaign.user_id == current_user["id"]).order_by(Campaign.created_at.desc())
  )
  campaigns = q.scalars().all()
  
  result = []
  for camp in campaigns:
    # Fetch status counts
    c_leads_q = await db.execute(
      select(CampaignLead.status, func.count(CampaignLead.id))
      .where(CampaignLead.campaign_id == camp.id)
      .group_by(CampaignLead.status)
    )
    status_counts = dict(c_leads_q.all())
    
    total_leads = sum(status_counts.values())
    sent = status_counts.get("sent", 0) + status_counts.get("opened", 0) + status_counts.get("replied", 0) + status_counts.get("bounced", 0)
    opened = status_counts.get("opened", 0) + status_counts.get("replied", 0)
    replied = status_counts.get("replied", 0)
    bounced = status_counts.get("bounced", 0)

    # Convert counts to percentage rates if sent > 0
    open_rate = round((opened / sent) * 100, 1) if sent > 0 else 0.0
    reply_rate = round((replied / sent) * 100, 1) if sent > 0 else 0.0
    bounce_rate = round((bounced / sent) * 100, 1) if sent > 0 else 0.0
    
    camp_dict = camp.to_dict()
    camp_dict.update({
      "total_leads": total_leads,
      "sent": sent,
      "open_rate": open_rate,
      "reply_rate": reply_rate,
      "bounce_rate": bounce_rate,
    })
    result.append(camp_dict)
    
  return result

@router.post("")
async def create_campaign(
  request: CampaignCreate,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  if not request.name.strip():
    raise HTTPException(status_code=400, detail="Campaign name cannot be empty.")
    
  # Create Campaign record
  campaign = Campaign(
    user_id=current_user["id"],
    name=request.name,
    status=request.status,
    email_account_id=request.email_account_id,
    rotate_mailboxes=request.rotate_mailboxes,
    rotate_mailbox_ids=request.rotate_mailbox_ids,
    ai_model=request.ai_model,
    ai_prompt_template=request.ai_prompt_template,
    subject_a=request.subject_a,
    subject_b=request.subject_b,
    body_template=request.body_template,
    follow_up_1_days=request.follow_up_1_days,
    follow_up_1_body=request.follow_up_1_body,
    follow_up_2_days=request.follow_up_2_days,
    follow_up_2_body=request.follow_up_2_body,
    follow_up_3_days=request.follow_up_3_days,
    follow_up_3_body=request.follow_up_3_body,
    send_start_hour=request.send_start_hour,
    send_end_hour=request.send_end_hour,
    timezone=request.timezone,
    send_interval=request.send_interval,
    started_at=datetime.now(timezone.utc).replace(tzinfo=None) if request.status == "active" else None
  )
  
  db.add(campaign)
  await db.commit() # Commit first to get the campaign ID
  await db.refresh(campaign)

  # Add CampaignLead records
  for idx, lead_id in enumerate(request.lead_ids):
    # Assign Subject A/B alternatively if B exists for split testing
    assigned_subj = "a"
    if request.subject_b and idx % 2 == 1:
      assigned_subj = "b"
      
    c_lead = CampaignLead(
      campaign_id=campaign.id,
      lead_id=lead_id,
      status="pending",
      assigned_subject=assigned_subj
    )
    db.add(c_lead)
    
  await db.commit()
  return campaign.to_dict()

@router.get("/{campaign_id}")
async def get_campaign(
  campaign_id: str,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  q = await db.execute(
    select(Campaign).where(
      and_(Campaign.id == campaign_id, Campaign.user_id == current_user["id"])
    )
  )
  campaign = q.scalars().first()
  if not campaign:
    raise HTTPException(status_code=404, detail="Campaign not found.")

  # Fetch all linked leads
  leads_q = await db.execute(
    select(CampaignLead, Lead)
    .join(Lead, CampaignLead.lead_id == Lead.id)
    .where(CampaignLead.campaign_id == campaign.id)
  )
  leads_list = []
  for c_lead, lead in leads_q.all():
    lead_dict = lead.to_dict()
    lead_dict.update({
      "campaign_lead_id": c_lead.id,
      "delivery_status": c_lead.status,
      "sent_count": c_lead.sent_count,
      "last_sent_at": c_lead.last_sent_at.isoformat() if c_lead.last_sent_at else None,
      "assigned_subject": c_lead.assigned_subject,
    })
    leads_list.append(lead_dict)

  # Fetch status counts
  c_leads_q = await db.execute(
    select(CampaignLead.status, func.count(CampaignLead.id))
    .where(CampaignLead.campaign_id == campaign.id)
    .group_by(CampaignLead.status)
  )
  status_counts = dict(c_leads_q.all())
  
  total_leads = sum(status_counts.values())
  sent = status_counts.get("sent", 0) + status_counts.get("opened", 0) + status_counts.get("replied", 0) + status_counts.get("bounced", 0)
  opened = status_counts.get("opened", 0) + status_counts.get("replied", 0)
  replied = status_counts.get("replied", 0)
  bounced = status_counts.get("bounced", 0)
  
  analytics = {
    "total_leads": total_leads,
    "sent": sent,
    "opened": opened,
    "replied": replied,
    "bounced": bounced,
    "open_rate": round((opened / sent) * 100, 1) if sent > 0 else 0.0,
    "reply_rate": round((replied / sent) * 100, 1) if sent > 0 else 0.0,
    "bounce_rate": round((bounced / sent) * 100, 1) if sent > 0 else 0.0,
  }

  return {
    "campaign": campaign.to_dict(),
    "leads": leads_list,
    "analytics": analytics
  }

@router.put("/{campaign_id}")
async def update_campaign(
  campaign_id: str,
  request: CampaignUpdate,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  q = await db.execute(
    select(Campaign).where(
      and_(Campaign.id == campaign_id, Campaign.user_id == current_user["id"])
    )
  )
  campaign = q.scalars().first()
  if not campaign:
    raise HTTPException(status_code=404, detail="Campaign not found.")

  # Update provided fields
  for key, value in request.model_dump(exclude_unset=True).items():
    setattr(campaign, key, value)
    
  await db.commit()
  await db.refresh(campaign)
  return campaign.to_dict()

@router.post("/{campaign_id}/start")
async def start_campaign(
  campaign_id: str,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  q = await db.execute(
    select(Campaign).where(
      and_(Campaign.id == campaign_id, Campaign.user_id == current_user["id"])
    )
  )
  campaign = q.scalars().first()
  if not campaign:
    raise HTTPException(status_code=404, detail="Campaign not found.")
    
  campaign.status = "active"
  if not campaign.started_at:
    campaign.started_at = datetime.now(timezone.utc).replace(tzinfo=None)
    
  await db.commit()
  return campaign.to_dict()

@router.post("/{campaign_id}/pause")
async def pause_campaign(
  campaign_id: str,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  q = await db.execute(
    select(Campaign).where(
      and_(Campaign.id == campaign_id, Campaign.user_id == current_user["id"])
    )
  )
  campaign = q.scalars().first()
  if not campaign:
    raise HTTPException(status_code=404, detail="Campaign not found.")
    
  campaign.status = "paused"
  await db.commit()
  return campaign.to_dict()

@router.delete("/{campaign_id}")
async def delete_campaign(
  campaign_id: str,
  current_user: dict = Depends(get_current_user),
  db: AsyncSession = Depends(get_db)
):
  stmt = delete(Campaign).where(
    and_(Campaign.id == campaign_id, Campaign.user_id == current_user["id"])
  )
  result = await db.execute(stmt)
  await db.commit()
  
  if result.rowcount == 0:
    raise HTTPException(status_code=404, detail="Campaign not found or unauthorized.")
    
  return {"message": "Campaign deleted successfully."}
