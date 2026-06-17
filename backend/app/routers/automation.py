from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
import base64
import uuid

from app.database import get_db
from app.models import CampaignLead, Lead, Blacklist, Campaign
from app.config import settings
from app.utils.rate_limiter import rate_limit_unsubscribe, rate_limit_open_tracking

router = APIRouter(prefix="/api/automation", tags=["Automation"])

@router.get("/unsubscribe/{campaign_lead_id}")
async def unsubscribe_recipient(
    campaign_lead_id: str,
    redirect: bool = False,
    db: AsyncSession = Depends(get_db),
    _ = Depends(rate_limit_unsubscribe)
):
    """
    Public unauthenticated endpoint to unsubscribe a recipient.
    Marks their campaign lead status and lead status as unsubscribed,
    and appends their email to the user's blacklist.
    """
    # Validate UUID format to prevent Postgres database DataError crash
    try:
        uuid.UUID(campaign_lead_id)
    except ValueError:
        if redirect:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/unsubscribe?status=error&msg=Invalid unsubscribe link format.",
                status_code=status.HTTP_307_TEMPORARY_REDIRECT
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid unsubscribe link format."
        )

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
        if redirect:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/unsubscribe?status=error&msg=Unsubscribe record not found.",
                status_code=status.HTTP_307_TEMPORARY_REDIRECT
            )
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
        if redirect:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/unsubscribe?status=error&msg=Associated contact not found.",
                status_code=status.HTTP_307_TEMPORARY_REDIRECT
            )
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
        if redirect:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/unsubscribe?status=error&msg=Associated campaign not found.",
                status_code=status.HTTP_307_TEMPORARY_REDIRECT
            )
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

    if redirect:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/unsubscribe?lead_id={campaign_lead_id}&status=unsubscribed",
            status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )

    return {
        "message": "You have been successfully unsubscribed.",
        "email": lead.email
    }


@router.get("/track/open/{campaign_lead_id}")
async def track_email_open(
    campaign_lead_id: str,
    db: AsyncSession = Depends(get_db),
    _ = Depends(rate_limit_open_tracking)
):
    """
    Public unauthenticated endpoint to track email opens using a 1x1 transparent tracking pixel.
    Updates the CampaignLead's status to 'opened' if it was 'sent'.
    """
    # Validate UUID format to prevent Postgres database DataError crash
    try:
        uuid.UUID(campaign_lead_id)
    except ValueError:
        # Gracefully return the tracking pixel even if ID is invalid
        pixel_data = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
        return Response(content=pixel_data, media_type="image/gif")

    # 1. Fetch CampaignLead record
    q_c_lead = await db.execute(
        select(CampaignLead).where(CampaignLead.id == campaign_lead_id)
    )
    c_lead = q_c_lead.scalars().first()
    
    if c_lead:
        # Only update status to "opened" if it's currently "sent"
        if c_lead.status == "sent":
            c_lead.status = "opened"
            await db.commit()

    # 1x1 transparent GIF image bytes
    pixel_data = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=pixel_data, media_type="image/gif")
