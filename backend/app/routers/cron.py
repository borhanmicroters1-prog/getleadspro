import logging
from fastapi import APIRouter, status

from app.utils.scheduler import (
    send_emails_job,
    check_follow_ups_job,
    check_replies_and_bounces_job,
    send_daily_reports_job,
    detect_ab_test_winners_job,
    warmup_cron_job
)

logger = logging.getLogger("cron")
router = APIRouter(prefix="/api/cron", tags=["Cron Jobs"])

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
