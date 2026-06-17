import logging
from typing import Optional
from fastapi import APIRouter, status, Depends, HTTPException, Header, Query
from app.config import settings

from app.utils.scheduler import (
    send_emails_job,
    check_follow_ups_job,
    check_replies_and_bounces_job,
    send_daily_reports_job,
    detect_ab_test_winners_job,
    warmup_cron_job
)

logger = logging.getLogger("cron")

async def verify_cron_secret(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    secret: Optional[str] = Query(None)
):
    """Dependency function to verify cron requests using either header or query parameter."""
    provided = x_cron_secret or secret
    if not settings.CRON_SECRET:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Cron secret is not configured on the server."
            )
        # If no secret is configured, bypass the check to avoid lockout in local development
        return
    if provided != settings.CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized cron trigger token."
        )

router = APIRouter(
    prefix="/api/cron",
    tags=["Cron Jobs"],
    dependencies=[Depends(verify_cron_secret)]
)

@router.post("/send-emails")
async def trigger_send_emails():
    """Manually triggers the campaign outbound email sender job."""
    logger.info("Manual trigger: /api/cron/send-emails")
    await send_emails_job()
    return {"message": "Outbound campaign emails sender task executed successfully."}

@router.post("/follow-ups")
async def trigger_follow_ups():
    """Manually triggers the campaign follow-up sequence evaluator job."""
    logger.info("Manual trigger: /api/cron/follow-ups")
    await check_follow_ups_job()
    return {"message": "Follow-up sequences checker task executed successfully."}

@router.post("/replies-bounces")
async def trigger_replies_bounces():
    """Manually triggers the simulated reply and bounce crawler task."""
    logger.info("Manual trigger: /api/cron/replies-bounces")
    await check_replies_and_bounces_job()
    return {"message": "Replies and bounces simulation checker task executed successfully."}

@router.post("/ab-test-winner")
async def trigger_ab_test_winner():
    """Manually triggers the A/B test winner selector engine."""
    logger.info("Manual trigger: /api/cron/ab-test-winner")
    await detect_ab_test_winners_job()
    return {"message": "A/B test winners checker task executed successfully."}

@router.post("/daily-report")
async def trigger_daily_report():
    """Manually triggers the daily Telegram summary digest notification task."""
    logger.info("Manual trigger: /api/cron/daily-report")
    await send_daily_reports_job()
    return {"message": "Daily Telegram reports task executed successfully."}

@router.post("/warmup")
async def trigger_warmup():
    """Manually triggers the daily email warm-up pool execution job."""
    logger.info("Manual trigger: /api/cron/warmup")
    await warmup_cron_job()
    return {"message": "Daily email warm-up pool simulation task executed successfully."}
