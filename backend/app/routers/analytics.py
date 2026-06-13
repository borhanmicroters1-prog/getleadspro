import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func, desc
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models import User, Campaign, CampaignLead, Lead
from app.utils.auth import get_current_user

logger = logging.getLogger("analytics")
router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("")
async def get_overall_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns account-level aggregated outreach performance data,
    source distribution metrics, hourly reply distributions, and 30-day trend lines.
    """
    user_id = current_user["id"]

    # 1. Fetch campaigns
    q_camps = await db.execute(
        select(Campaign).where(Campaign.user_id == user_id)
    )
    campaigns = q_camps.scalars().all()
    campaign_ids = [c.id for c in campaigns]

    # Initialize default values
    sent = 0
    opened = 0
    replied = 0
    bounced = 0
    unsubscribed = 0
    open_rate = 0.0
    reply_rate = 0.0
    bounce_rate = 0.0
    unsubscribe_rate = 0.0
    best_campaign_name = "N/A"
    best_campaign_rate = 0.0
    best_time_str = "N/A"
    
    hour_distribution = {h: 0 for h in range(24)}
    trend_data = []
    today = datetime.now(timezone.utc).date()
    for i in range(29, -1, -1):
        target_date = today - timedelta(days=i)
        trend_data.append({
            "date": target_date.strftime("%b %d"),
            "sent": 0,
            "replied": 0
        })

    sources = ["google_maps", "facebook_ads", "csv_upload"]
    source_performance = [
        {
            "source": src,
            "sent": 0,
            "replied": 0,
            "open_rate": 0.0,
            "reply_rate": 0.0
        }
        for src in sources
    ]

    if campaign_ids:
        # 2. Query status counts from CampaignLead
        q_counts = await db.execute(
            select(CampaignLead.status, func.count(CampaignLead.id))
            .where(CampaignLead.campaign_id.in_(campaign_ids))
            .group_by(CampaignLead.status)
        )
        status_counts = dict(q_counts.all())

        sent = (
            status_counts.get("sent", 0) +
            status_counts.get("opened", 0) +
            status_counts.get("replied", 0) +
            status_counts.get("bounced", 0) +
            status_counts.get("unsubscribed", 0)
        )
        opened = status_counts.get("opened", 0) + status_counts.get("replied", 0)
        replied = status_counts.get("replied", 0)
        bounced = status_counts.get("bounced", 0)
        unsubscribed = status_counts.get("unsubscribed", 0)

        if sent > 0:
            open_rate = round((opened / sent) * 100, 1)
            reply_rate = round((replied / sent) * 100, 1)
            bounce_rate = round((bounced / sent) * 100, 1)
            unsubscribe_rate = round((unsubscribed / sent) * 100, 1)

        # 3. Best Performing Campaign
        for camp in campaigns:
            q_camp_counts = await db.execute(
                select(CampaignLead.status, func.count(CampaignLead.id))
                .where(CampaignLead.campaign_id == camp.id)
                .group_by(CampaignLead.status)
            )
            c_counts = dict(q_camp_counts.all())
            c_sent = (
                c_counts.get("sent", 0) +
                c_counts.get("opened", 0) +
                c_counts.get("replied", 0) +
                c_counts.get("bounced", 0) +
                c_counts.get("unsubscribed", 0)
            )
            c_replied = c_counts.get("replied", 0)
            c_reply_rate = (c_replied / c_sent) * 100 if c_sent > 0 else 0.0
            if c_reply_rate >= best_campaign_rate and c_sent > 0:
                best_campaign_name = camp.name
                best_campaign_rate = round(c_reply_rate, 1)

        # 4. Performance metrics by Lead Source
        source_performance = []
        for src in sources:
            q_src_counts = await db.execute(
                select(CampaignLead.status, func.count(CampaignLead.id))
                .join(Lead, CampaignLead.lead_id == Lead.id)
                .where(
                    and_(
                        CampaignLead.campaign_id.in_(campaign_ids),
                        Lead.source == src
                    )
                )
                .group_by(CampaignLead.status)
            )
            s_counts = dict(q_src_counts.all())
            s_sent = (
                s_counts.get("sent", 0) +
                s_counts.get("opened", 0) +
                s_counts.get("replied", 0) +
                s_counts.get("bounced", 0) +
                s_counts.get("unsubscribed", 0)
            )
            s_replied = s_counts.get("replied", 0)
            s_opened = s_counts.get("opened", 0) + s_replied
            s_rate = (s_replied / s_sent) * 100 if s_sent > 0 else 0.0
            
            source_performance.append({
                "source": src,
                "sent": s_sent,
                "replied": s_replied,
                "open_rate": round((s_opened / s_sent) * 100, 1) if s_sent > 0 else 0.0,
                "reply_rate": round(s_rate, 1)
            })

        # 5. Best Send Time (Hour of Day)
        q_replied_times = await db.execute(
            select(CampaignLead.last_sent_at)
            .where(
                and_(
                    CampaignLead.campaign_id.in_(campaign_ids),
                    CampaignLead.status == "replied",
                    CampaignLead.last_sent_at != None
                )
            )
        )
        replied_hours = [t[0].hour for t in q_replied_times.all() if t[0]]
        
        for hr in replied_hours:
            hour_distribution[hr] += 1
            
        best_send_hour = None
        max_replies_count = 0
        for hr, count in hour_distribution.items():
            if count > max_replies_count:
                max_replies_count = count
                best_send_hour = hr
                
        if best_send_hour is not None:
            if best_send_hour == 0:
                best_time_str = "12:00 AM"
            elif best_send_hour == 12:
                best_time_str = "12:00 PM"
            elif best_send_hour > 12:
                best_time_str = f"{best_send_hour - 12}:00 PM"
            else:
                best_time_str = f"{best_send_hour}:00 AM"

        # 6. Trend Lines (Last 30 Days)
        trend_data = []
        for i in range(29, -1, -1):
            target_date = today - timedelta(days=i)
            
            # Count sent on this day
            q_sent_day = await db.execute(
                select(func.count(CampaignLead.id)).where(
                    and_(
                        CampaignLead.campaign_id.in_(campaign_ids),
                        func.date(CampaignLead.last_sent_at) == target_date
                    )
                )
            )
            day_sent = q_sent_day.scalar() or 0
            
            # Count replies on this day (approximate based on last_sent_at)
            q_replied_day = await db.execute(
                select(func.count(CampaignLead.id)).where(
                    and_(
                        CampaignLead.campaign_id.in_(campaign_ids),
                        CampaignLead.status == "replied",
                        func.date(CampaignLead.last_sent_at) == target_date
                    )
                )
            )
            day_replies = q_replied_day.scalar() or 0
            
            trend_data.append({
                "date": target_date.strftime("%b %d"),
                "sent": day_sent,
                "replied": day_replies
            })

    return {
        "is_mock": False,
        "summary": {
            "emails_sent": sent,
            "open_rate": open_rate,
            "reply_rate": reply_rate,
            "bounce_rate": bounce_rate,
            "unsubscribe_rate": unsubscribe_rate,
            "best_campaign": best_campaign_name,
            "best_send_time": best_time_str
        },
        "source_breakdown": source_performance,
        "hourly_distribution": [{"hour": f"{h:02d}:00", "replies": count} for h, count in hour_distribution.items() if h >= 9 and h <= 18],
        "trend_30_days": trend_data
    }

def get_mock_analytics():
    """Generates realistic mockup data for onboarding preview dashboards."""
    today = datetime.now(timezone.utc).date()
    trend_data = []
    
    # Generate random looking trends
    import random
    for i in range(29, -1, -1):
        target_date = today - timedelta(days=i)
        # Weekday vs Weekend checks
        is_weekend = target_date.weekday() in [5, 6]
        base_sent = 10 if is_weekend else random.randint(45, 85)
        base_replies = 0 if is_weekend else random.randint(3, 8)
        
        trend_data.append({
            "date": target_date.strftime("%b %d"),
            "sent": base_sent,
            "replied": base_replies
        })
        
    hour_distribution = [
        {"hour": "09:00 AM", "replies": 14},
        {"hour": "10:00 AM", "replies": 22},
        {"hour": "11:00 AM", "replies": 18},
        {"hour": "12:00 PM", "replies": 8},
        {"hour": "01:00 PM", "replies": 11},
        {"hour": "02:00 PM", "replies": 19},
        {"hour": "03:00 PM", "replies": 25},
        {"hour": "04:00 PM", "replies": 21},
        {"hour": "05:00 PM", "replies": 15},
        {"hour": "06:00 PM", "replies": 6}
    ]

    source_performance = [
        {"source": "google_maps", "sent": 450, "replied": 28, "open_rate": 68.5, "reply_rate": 6.2},
        {"source": "facebook_ads", "sent": 320, "replied": 29, "open_rate": 74.2, "reply_rate": 9.1},
        {"source": "csv_upload", "sent": 180, "replied": 9, "open_rate": 58.0, "reply_rate": 5.0}
    ]

    return {
        "is_mock": True,
        "summary": {
            "emails_sent": 950,
            "open_rate": 67.9,
            "reply_rate": 6.9,
            "bounce_rate": 1.8,
            "unsubscribe_rate": 1.2,
            "best_campaign": "Dhaka Agencies Cold Outreach A/B",
            "best_send_time": "03:00 PM"
        },
        "source_breakdown": source_performance,
        "hourly_distribution": hour_distribution,
        "trend_30_days": trend_data
    }
