from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_

from app.database import get_db
from app.models import CampaignLead, Lead, Blacklist, Campaign

router = APIRouter(prefix="/api/automation", tags=["Automation"])

@router.get("/unsubscribe/{campaign_lead_id}")
async def unsubscribe_recipient(
    campaign_lead_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Public unauthenticated endpoint to unsubscribe a recipient.
    Marks their campaign lead status and lead status as unsubscribed,
    and appends their email to the user's blacklist.
    """
    # 1. Fetch CampaignLead record
    q_c_lead = await db.execute(
        select(CampaignLead).where(CampaignLead.id == campaign_lead_id)
    )
    c_lead = q_c_lead.scalars().first()
    
    if not c_lead:
        # Fallback: check if the parameter is a direct lead_id
        q_c_lead_fallback = await db.execute(
            select(CampaignLead).where(CampaignLead.lead_id == campaign_lead_id)
        )
        c_lead = q_c_lead_fallback.scalars().first()

    if not c_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unsubscribe record not found."
        )

    # 2. Get lead details
    q_lead = await db.execute(
        select(Lead).where(Lead.id == c_lead.lead_id)
    )
    lead = q_lead.scalars().first()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated contact not found."
        )

    # 3. Get campaign details to find the owner user_id
    q_campaign = await db.execute(
        select(Campaign).where(Campaign.id == c_lead.campaign_id)
    )
    campaign = q_campaign.scalars().first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated campaign not found."
        )

    # 4. Update status fields
    c_lead.status = "unsubscribed"
    lead.status = "unsubscribed"

    # 5. Add to user's blacklist to prevent any future campaign outreach
    q_blacklist = await db.execute(
        select(Blacklist).where(
            and_(
                Blacklist.user_id == campaign.user_id,
                Blacklist.value == lead.email.lower()
            )
        )
    )
    existing_blacklist = q_blacklist.scalars().first()

    if not existing_blacklist:
        blacklist_entry = Blacklist(
            user_id=campaign.user_id,
            type="email",
            value=lead.email.lower(),
            reason=f"Auto-unsubscribed from campaign '{campaign.name}'"
        )
        db.add(blacklist_entry)

    await db.commit()
    return {
        "message": "You have been successfully unsubscribed.",
        "email": lead.email
    }
