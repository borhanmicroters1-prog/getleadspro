import datetime
import logging
import random
from typing import Optional
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.future import select
from sqlalchemy import and_, func

from app.database import async_session_maker
from app.models import Campaign, CampaignLead, Lead, EmailAccount, User, Blacklist, WarmupLog, GlobalBlacklist
import asyncio
from app.utils.email_sender import send_email
from app.utils.telegram import send_telegram_notification
from app.utils.imap_worker import process_incoming_warmups, run_real_imap_replies_and_bounces_sync
from app.utils.config_resolver import get_system_setting

logger = logging.getLogger("scheduler")
scheduler = AsyncIOScheduler()

def substitute_variables(text: str, lead: Lead) -> str:
    """Substitutes variables like {{name}} or {{company}} in email templates."""
    if not text:
        return ""
        
    import re
    
    # Predefined placeholders
    first_name = lead.name.split()[0] if (lead.name and lead.name.strip()) else "Prospect"
    
    replacements = {
        "name": lead.name or "Prospect",
        "company": lead.company or "your business",
        "website": lead.website or "your website",
        "first_name": first_name,
        "title": lead.title or ""
    }
    
    # Custom fields placeholders
    if lead.custom_fields and isinstance(lead.custom_fields, dict):
        for key, val in lead.custom_fields.items():
            val_str = str(val) if val is not None else ""
            key_lower = key.strip().lower()
            replacements[key_lower] = val_str
            # support spaces replaced by underscores and vice versa
            replacements[key_lower.replace(" ", "_")] = val_str
            replacements[key_lower.replace("_", " ")] = val_str
            
    # Regex to find all {{ ... }} matches and replace them
    # Handles arbitrary whitespace inside braces, e.g. {{  first_name  }}
    pattern = re.compile(r"\{\{\s*(.*?)\s*\}\}")
    
    def replace_match(match):
        placeholder_key = match.group(1).strip().lower()
        if placeholder_key in replacements:
            return replacements[placeholder_key]
        return match.group(0) # Keep unchanged if variable is unknown
        
    return pattern.sub(replace_match, text)

async def resolve_mailbox_for_campaign(campaign: Campaign, db) -> Optional[EmailAccount]:
    """Resolves and returns the mailbox to use for sending, implementing smart multi-mailbox rotation."""
    if campaign.rotate_mailboxes:
        candidate_ids = []
        if campaign.rotate_mailbox_ids:
            candidate_ids = [cid.strip() for cid in campaign.rotate_mailbox_ids.split(",") if cid.strip()]

        query_rot = select(EmailAccount).where(
            and_(
                EmailAccount.user_id == campaign.user_id,
                EmailAccount.is_active == True,
                EmailAccount.emails_sent_today < EmailAccount.daily_limit
            )
        )
        if candidate_ids:
            query_rot = query_rot.where(EmailAccount.id.in_(candidate_ids))

        q_rot = await db.execute(query_rot)
        eligible_mailboxes = q_rot.scalars().all()

        if eligible_mailboxes:
            # Smart Rotation: select the mailbox with the lowest sending volume today to distribute load
            return min(eligible_mailboxes, key=lambda m: m.emails_sent_today)
        return None
    else:
        if campaign.email_account_id:
            q_mailbox = await db.execute(
                select(EmailAccount).where(EmailAccount.id == campaign.email_account_id)
            )
            mailbox = q_mailbox.scalars().first()
            if mailbox and mailbox.is_active and mailbox.emails_sent_today < mailbox.daily_limit:
                return mailbox
        return None

async def send_emails_job():
    """Periodic job to send outbound emails for active campaigns within business hours."""
    logger.info("Running send_emails_job...")
    async with async_session_maker() as db:
        # 1. Fetch active campaigns
        q = await db.execute(
            select(Campaign).where(Campaign.status == "active")
        )
        active_campaigns = q.scalars().all()
        
        for campaign in active_campaigns:
            # 2. Check Timezone sending window
            try:
                tz = ZoneInfo(campaign.timezone)
                now_tz = datetime.datetime.now(tz)
                current_hour = now_tz.hour
                if not (campaign.send_start_hour <= current_hour < campaign.send_end_hour):
                    # Outside sending business hour window
                    continue
            except Exception as e:
                logger.error(f"Timezone error for campaign {campaign.id}: {str(e)}")
                continue

            # 3. Resolve Mailbox (with Rotation)
            mailbox = await resolve_mailbox_for_campaign(campaign, db)

            if not mailbox:
                logger.warning(f"No available active mailbox with capacity for campaign {campaign.name} ({campaign.id}).")
                continue

            # Check Send Interval (elapsed minutes since last email sent)
            q_last_sent = await db.execute(
                select(func.max(CampaignLead.last_sent_at))
                .where(CampaignLead.campaign_id == campaign.id)
            )
            last_sent = q_last_sent.scalar()
            if last_sent:
                now_utc = datetime.datetime.now(datetime.timezone.utc)
                if last_sent.tzinfo is None:
                    last_sent = last_sent.replace(tzinfo=datetime.timezone.utc)
                elapsed_seconds = (now_utc - last_sent).total_seconds()
                
                # Humanize intervals by randomizing target seconds between 75% and 200% of send_interval
                base_seconds = campaign.send_interval
                random_target_seconds = random.randint(int(base_seconds * 0.75), int(base_seconds * 2.0))
                
                if elapsed_seconds < random_target_seconds:
                    logger.info(f"Skipping campaign {campaign.name} ({campaign.id}): elapsed {elapsed_seconds:.1f}s < random target {random_target_seconds}s.")
                    continue

            # 4. Fetch pending campaign leads ordered by priority score desc
            q_leads = await db.execute(
                select(CampaignLead, Lead)
                .join(Lead, CampaignLead.lead_id == Lead.id)
                .where(
                    and_(
                        CampaignLead.campaign_id == campaign.id,
                        CampaignLead.status == "pending"
                    )
                )
                .order_by(Lead.score.desc())
                .limit(1) # Send one email at a time per interval
            )
            
            for c_lead, lead in q_leads.all():
                # Verify limit again during batch execution, and rotate if possible
                if mailbox.emails_sent_today >= mailbox.daily_limit:
                    if campaign.rotate_mailboxes:
                        mailbox = await resolve_mailbox_for_campaign(campaign, db)
                        if not mailbox:
                            break
                    else:
                        break

                # 5. Blacklist check (User-level & System-level Global Blacklist)
                is_blocked = False
                block_reason = None
                
                # Check user-level email block
                q_blacklist = await db.execute(
                    select(Blacklist).where(
                        and_(
                            Blacklist.user_id == campaign.user_id,
                            Blacklist.value == lead.email.lower()
                        )
                    )
                )
                if q_blacklist.scalars().first():
                    is_blocked = True
                    block_reason = "user_blacklist"

                # Check global email block
                if not is_blocked:
                    q_g_blacklist = await db.execute(
                        select(GlobalBlacklist).where(
                            and_(
                                GlobalBlacklist.type == "email",
                                GlobalBlacklist.value == lead.email.lower()
                            )
                        )
                    )
                    if q_g_blacklist.scalars().first():
                        is_blocked = True
                        block_reason = "global_blacklist"

                # Parse domain for blacklist check
                domain = lead.email.split("@")[-1].lower() if "@" in lead.email else ""
                if domain and not is_blocked:
                    # Check user-level domain block
                    q_blacklist_domain = await db.execute(
                        select(Blacklist).where(
                            and_(
                                Blacklist.user_id == campaign.user_id,
                                Blacklist.value == domain
                            )
                        )
                    )
                    if q_blacklist_domain.scalars().first():
                        is_blocked = True
                        block_reason = "user_blacklist_domain"

                    # Check global domain block
                    if not is_blocked:
                        q_g_blacklist_domain = await db.execute(
                            select(GlobalBlacklist).where(
                                and_(
                                    GlobalBlacklist.type == "domain",
                                    GlobalBlacklist.value == domain
                                )
                            )
                        )
                        if q_g_blacklist_domain.scalars().first():
                            is_blocked = True
                            block_reason = "global_blacklist_domain"

                if is_blocked:
                    c_lead.status = "unsubscribed"
                    lead.status = "unsubscribed"
                    logger.info(f"Skipping lead {lead.email} for campaign {campaign.name}: blocked by {block_reason}.")
                    await db.commit()
                    continue

                # 6. Compose email details
                subject = campaign.subject_a
                if campaign.subject_b and c_lead.assigned_subject == "b":
                    subject = campaign.subject_b

                subject_subbed = substitute_variables(subject, lead)
                body_subbed = substitute_variables(campaign.body_template, lead)

                # 7. Deliver email
                success = await send_email(
                    mailbox, 
                    lead.email, 
                    subject_subbed, 
                    body_subbed, 
                    db, 
                    campaign_lead_id=c_lead.id,
                    send_as_plaintext=getattr(campaign, 'send_as_plaintext', False)
                )
                
                if success:
                    c_lead.status = "sent"
                    c_lead.sent_count = 1
                    c_lead.last_sent_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                    lead.status = "contacted"
                    mailbox.emails_sent_today += 1
                    
                    # Schedule follow-up if follow_up_1 is set
                    if campaign.follow_up_1_days:
                        c_lead.next_follow_up_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=campaign.follow_up_1_days)).replace(tzinfo=None)
                    else:
                        c_lead.next_follow_up_at = None

                    await db.commit()
                else:
                    logger.error(f"Failed to send email to lead {lead.email}")

async def check_follow_ups_job():
    """Checks for leads waiting for follow-up emails and sends them automatically."""
    logger.info("Running check_follow_ups_job...")
    async with async_session_maker() as db:
        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        
        # 1. Fetch leads whose follow-up is due
        q_leads = await db.execute(
            select(CampaignLead, Lead, Campaign)
            .join(Lead, CampaignLead.lead_id == Lead.id)
            .join(Campaign, CampaignLead.campaign_id == Campaign.id)
            .where(
                and_(
                    Campaign.status == "active",
                    CampaignLead.status == "sent",
                    CampaignLead.next_follow_up_at <= now
                )
            )
            .limit(5)
        )

        for c_lead, lead, campaign in q_leads.all():
            # Resolve mailbox with rotation support
            mailbox = await resolve_mailbox_for_campaign(campaign, db)

            if not mailbox:
                logger.warning(f"No available active mailbox with capacity for follow-up on lead {lead.email} in campaign {campaign.name}.")
                continue

            # Blacklist check (User-level & System-level Global Blacklist)
            is_blocked = False
            block_reason = None
            
            # Check user-level email block
            q_blacklist = await db.execute(
                select(Blacklist).where(
                    and_(
                        Blacklist.user_id == campaign.user_id,
                        Blacklist.value == lead.email.lower()
                    )
                )
            )
            if q_blacklist.scalars().first():
                is_blocked = True
                block_reason = "user_blacklist"

            # Check global email block
            if not is_blocked:
                q_g_blacklist = await db.execute(
                    select(GlobalBlacklist).where(
                        and_(
                            GlobalBlacklist.type == "email",
                            GlobalBlacklist.value == lead.email.lower()
                        )
                    )
                )
                if q_g_blacklist.scalars().first():
                    is_blocked = True
                    block_reason = "global_blacklist"

            # Parse domain for blacklist check
            domain = lead.email.split("@")[-1].lower() if "@" in lead.email else ""
            if domain and not is_blocked:
                # Check user-level domain block
                q_blacklist_domain = await db.execute(
                    select(Blacklist).where(
                        and_(
                            Blacklist.user_id == campaign.user_id,
                            Blacklist.value == domain
                        )
                    )
                )
                if q_blacklist_domain.scalars().first():
                    is_blocked = True
                    block_reason = "user_blacklist_domain"

                # Check global domain block
                if not is_blocked:
                    q_g_blacklist_domain = await db.execute(
                        select(GlobalBlacklist).where(
                            and_(
                                GlobalBlacklist.type == "domain",
                                GlobalBlacklist.value == domain
                            )
                        )
                    )
                    if q_g_blacklist_domain.scalars().first():
                        is_blocked = True
                        block_reason = "global_blacklist_domain"

            if is_blocked:
                c_lead.status = "unsubscribed"
                lead.status = "unsubscribed"
                logger.info(f"Skipping follow-up for lead {lead.email} in campaign {campaign.name}: blocked by {block_reason}.")
                await db.commit()
                continue

            # Determine follow-up body & next step
            follow_up_body = None
            next_follow_up_days = None
            step_number = c_lead.sent_count + 1

            if step_number == 2 and campaign.follow_up_1_body:
                follow_up_body = campaign.follow_up_1_body
                next_follow_up_days = campaign.follow_up_2_days
            elif step_number == 3 and campaign.follow_up_2_body:
                follow_up_body = campaign.follow_up_2_body
                next_follow_up_days = campaign.follow_up_3_days
            elif step_number == 4 and campaign.follow_up_3_body:
                follow_up_body = campaign.follow_up_3_body
                next_follow_up_days = None

            if not follow_up_body:
                # No more follow-up templates configured for this step
                c_lead.next_follow_up_at = None
                await db.commit()
                continue

            # Compose follow-up (using "Re: " prefix on original subject)
            orig_subject = campaign.subject_a
            if campaign.subject_b and c_lead.assigned_subject == "b":
                orig_subject = campaign.subject_b

            subject = f"Re: {orig_subject}"
            subject_subbed = substitute_variables(subject, lead)
            body_subbed = substitute_variables(follow_up_body, lead)

            # Send follow-up
            success = await send_email(
                mailbox, 
                lead.email, 
                subject_subbed, 
                body_subbed, 
                db, 
                campaign_lead_id=c_lead.id,
                send_as_plaintext=getattr(campaign, 'send_as_plaintext', False)
            )
            
            if success:
                c_lead.sent_count = step_number
                c_lead.last_sent_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                mailbox.emails_sent_today += 1

                if next_follow_up_days:
                    c_lead.next_follow_up_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=next_follow_up_days)).replace(tzinfo=None)
                else:
                    c_lead.next_follow_up_at = None

                await db.commit()
            else:
                logger.error(f"Failed to send follow-up to lead {lead.email}")

async def check_and_apply_bounce_limit(campaign: Campaign, user: User, db):
    c_leads_q = await db.execute(
        select(CampaignLead.status, func.count(CampaignLead.id))
        .where(CampaignLead.campaign_id == campaign.id)
        .group_by(CampaignLead.status)
    )
    status_counts = dict(c_leads_q.all())
    sent = status_counts.get("sent", 0) + status_counts.get("opened", 0) + status_counts.get("replied", 0) + status_counts.get("bounced", 0)
    bounced = status_counts.get("bounced", 0)
    
    bounce_rate = (bounced / sent) * 100 if sent > 0 else 0
    if bounce_rate > 10.0:
        campaign.status = "paused"
        await db.commit()
        if user:
            pause_text = (
                f"⚠️ <b>Campaign Auto-Paused!</b>\n\n"
                f"Campaign: <b>{campaign.name}</b> has exceeded the 10% bounce safety threshold.\n"
                f"Current Bounce Rate: <b>{bounce_rate:.1f}%</b> ({bounced} bounces out of {sent} sent).\n"
                f"Action Required: Clean your email list and verify MX records before resuming."
            )
            await send_telegram_notification(user, pause_text)


async def simulate_replies_and_bounces_for_mailbox(mailbox: EmailAccount, db):
    # Fetch campaign leads that have status "sent" or "opened" in active campaigns of this user
    q_leads = await db.execute(
        select(CampaignLead, Lead, Campaign)
        .join(Lead, CampaignLead.lead_id == Lead.id)
        .join(Campaign, CampaignLead.campaign_id == Campaign.id)
        .where(
            and_(
                Campaign.status == "active",
                Campaign.user_id == mailbox.user_id,
                CampaignLead.status.in_(["sent", "opened"])
            )
        )
    )
    
    for c_lead, lead, campaign in q_leads.all():
        if not c_lead.last_sent_at:
            continue
        delta = datetime.datetime.now(datetime.timezone.utc) - c_lead.last_sent_at.replace(tzinfo=datetime.timezone.utc)
        if delta.total_seconds() < 30:
            continue

        dice = random.random()
        
        if dice < 0.10:  # Reply received!
            c_lead.status = "replied"
            c_lead.next_follow_up_at = None
            lead.status = "replied"
            await db.commit()
            
            q_user = await db.execute(select(User).where(User.id == campaign.user_id))
            user = q_user.scalars().first()
            
            if user:
                message_text = (
                    f"💬 <b>New Reply Received! (Simulated)</b>\n\n"
                    f"Lead: <b>{lead.name or 'Prospect'}</b> ({lead.email})\n"
                    f"Company: {lead.company or '-'}\n"
                    f"Campaign: <b>{campaign.name}</b>\n\n"
                    f"<i>\"Thanks for reaching out! I would love to connect and jump on a call next Wednesday.\"</i>"
                )
                await send_telegram_notification(user, message_text)
                
        elif dice < 0.15:  # Bounce received!
            c_lead.status = "bounced"
            c_lead.next_follow_up_at = None
            lead.status = "bounced"
            await db.commit()
            
            q_user = await db.execute(select(User).where(User.id == campaign.user_id))
            user = q_user.scalars().first()
            
            if user:
                message_text = (
                    f"❌ <b>Outreach Email Bounced! (Simulated)</b>\n\n"
                    f"Lead: <b>{lead.name or 'Prospect'}</b> ({lead.email})\n"
                    f"Campaign: <b>{campaign.name}</b>\n"
                    f"Status: Undeliverable address."
                )
                await send_telegram_notification(user, message_text)
                
            await check_and_apply_bounce_limit(campaign, user, db)


async def check_real_replies_and_bounces(mailbox: EmailAccount, db):
    # Fetch campaign leads that have status "sent" or "opened" in active campaigns of this user
    q_leads = await db.execute(
        select(CampaignLead, Lead, Campaign)
        .join(Lead, CampaignLead.lead_id == Lead.id)
        .join(Campaign, CampaignLead.campaign_id == Campaign.id)
        .where(
            and_(
                Campaign.status == "active",
                Campaign.user_id == mailbox.user_id,
                CampaignLead.status.in_(["sent", "opened"])
            )
        )
    )
    
    leads_by_email = {}
    for c_lead, lead, campaign in q_leads.all():
        leads_by_email[lead.email.lower()] = (c_lead, lead, campaign)
        
    if not leads_by_email:
        return
        
    active_outreach_emails = list(leads_by_email.keys())
    
    detected_replies, detected_bounces = await asyncio.to_thread(
        run_real_imap_replies_and_bounces_sync,
        mailbox.provider,
        mailbox.from_email,
        mailbox.access_token,
        active_outreach_emails
    )
    
    q_user = await db.execute(select(User).where(User.id == mailbox.user_id))
    user = q_user.scalars().first()
    
    for reply in detected_replies:
        email_key = reply["email"].lower()
        if email_key in leads_by_email:
            c_lead, lead, campaign = leads_by_email[email_key]
            
            c_lead.status = "replied"
            c_lead.next_follow_up_at = None
            lead.status = "replied"
            await db.commit()
            
            if user:
                body_snippet = reply["body_snippet"] or "No text content preview."
                message_text = (
                    f"💬 <b>New Reply Received!</b>\n\n"
                    f"Lead: <b>{lead.name or 'Prospect'}</b> ({lead.email})\n"
                    f"Company: {lead.company or '-'}\n"
                    f"Campaign: <b>{campaign.name}</b>\n\n"
                    f"Subject: <i>{reply['subject']}</i>\n"
                    f"Message: <i>\"{body_snippet}\"</i>"
                )
                await send_telegram_notification(user, message_text)
                
    for bounce_email in detected_bounces:
        email_key = bounce_email.lower()
        if email_key in leads_by_email:
            c_lead, lead, campaign = leads_by_email[email_key]
            
            c_lead.status = "bounced"
            c_lead.next_follow_up_at = None
            lead.status = "bounced"
            await db.commit()
            
            if user:
                message_text = (
                    f"❌ <b>Outreach Email Bounced!</b>\n\n"
                    f"Lead: <b>{lead.name or 'Prospect'}</b> ({lead.email})\n"
                    f"Campaign: <b>{campaign.name}</b>\n"
                    f"Status: Undeliverable address."
                )
                await send_telegram_notification(user, message_text)
                
            await check_and_apply_bounce_limit(campaign, user, db)


async def check_replies_and_bounces_job():
    """
    Checks mailboxes for replies and bounces.
    Identifies if mailboxes are mock or real and routes tasks accordingly.
    """
    logger.info("Running check_replies_and_bounces_job...")
    async with async_session_maker() as db:
        # Fetch active campaigns
        q_campaigns = await db.execute(
            select(Campaign).where(Campaign.status == "active")
        )
        active_campaigns = q_campaigns.scalars().all()
        
        # Collect unique email accounts (mailboxes) associated with active campaigns
        mailboxes_to_check = set()
        for campaign in active_campaigns:
            if campaign.email_account_id:
                mailboxes_to_check.add(campaign.email_account_id)
            if campaign.rotate_mailboxes:
                # Add all active mailboxes of this user
                q_user_boxes = await db.execute(
                    select(EmailAccount).where(
                        and_(
                            EmailAccount.user_id == campaign.user_id,
                            EmailAccount.is_active == True
                        )
                    )
                )
                for box in q_user_boxes.scalars().all():
                    mailboxes_to_check.add(box.id)
                    
        if not mailboxes_to_check:
            logger.info("No active mailboxes to check for replies/bounces.")
            return
            
        q_boxes = await db.execute(
            select(EmailAccount).where(EmailAccount.id.in_(list(mailboxes_to_check)))
        )
        mailboxes = q_boxes.scalars().all()
        
        for mailbox in mailboxes:
            is_mock = (
                not mailbox.access_token
                or mailbox.access_token.startswith("mock-")
                or mailbox.access_token == "mock-token"
            )
            
            if is_mock:
                await simulate_replies_and_bounces_for_mailbox(mailbox, db)
            else:
                try:
                    await check_real_replies_and_bounces(mailbox, db)
                except Exception as e:
                    logger.error(f"Error checking real replies/bounces for {mailbox.from_email}: {e}")

async def send_daily_reports_job():
    """Calculates daily outreach stats and sends Telegram reports to active users."""
    logger.info("Running send_daily_reports_job...")
    async with async_session_maker() as db:
        # Fetch users with active telegram setups
        q_users = await db.execute(
            select(User).where(and_(User.telegram_bot_token != None, User.telegram_chat_id != None))
        )
        users = q_users.scalars().all()
        
        for user in users:
            # Fetch all campaigns of the user
            q_campaigns = await db.execute(
                select(Campaign).where(Campaign.user_id == user.id)
            )
            campaigns = q_campaigns.scalars().all()
            if not campaigns:
                continue
                
            report_text = f"📊 <b>Daily Outreach Summary — GetLeads</b>\nDate: {datetime.date.today().isoformat()}\n\n"
            has_activity = False
            
            for camp in campaigns:
                # Count today's deliveries
                # To mock this or track this in sqlite, we can check how many campaign leads have status updates today.
                # (For simplicity in dev simulation, we select counts of leads that are sent/replied/bounced).
                q_counts = await db.execute(
                    select(CampaignLead.status, func.count(CampaignLead.id))
                    .where(CampaignLead.campaign_id == camp.id)
                    .group_by(CampaignLead.status)
                )
                counts = dict(q_counts.all())
                total = sum(counts.values())
                sent = counts.get("sent", 0) + counts.get("opened", 0) + counts.get("replied", 0) + counts.get("bounced", 0)
                opened = counts.get("opened", 0) + counts.get("replied", 0)
                replied = counts.get("replied", 0)
                bounced = counts.get("bounced", 0)
                
                if sent > 0:
                    has_activity = True
                    open_pct = (opened / sent) * 100
                    reply_pct = (replied / sent) * 100
                    
                    report_text += (
                        f"✉️ <b>{camp.name}</b> ({camp.status.upper()})\n"
                        f"• Sent: {sent}\n"
                        f"• Opened: {opened} ({open_pct:.1f}%)\n"
                        f"• Replied: {replied} ({reply_pct:.1f}%)\n"
                        f"• Bounced: {bounced}\n\n"
                    )
            
            if has_activity:
                await send_telegram_notification(user, report_text)
            else:
                logger.info(f"No outreach activity today for user {user.id}. Skipping report.")

async def resolve_ab_winner_internal(campaign: Campaign, db) -> str:
    """Helper method to resolve the winning subject line for a split test."""
    # Count deliveries and opens/replies for subject A
    q_a = await db.execute(
        select(CampaignLead.status, func.count(CampaignLead.id))
        .where(
            and_(
                CampaignLead.campaign_id == campaign.id,
                CampaignLead.assigned_subject == "a"
            )
        )
        .group_by(CampaignLead.status)
    )
    counts_a = dict(q_a.all())
    sent_a = sum(counts_a.values()) - counts_a.get("pending", 0)
    opened_a = counts_a.get("opened", 0) + counts_a.get("replied", 0)
    rate_a = (opened_a / sent_a) * 100 if sent_a > 0 else 0.0

    # Count deliveries and opens/replies for subject B
    q_b = await db.execute(
        select(CampaignLead.status, func.count(CampaignLead.id))
        .where(
            and_(
                CampaignLead.campaign_id == campaign.id,
                CampaignLead.assigned_subject == "b"
            )
        )
        .group_by(CampaignLead.status)
    )
    counts_b = dict(q_b.all())
    sent_b = sum(counts_b.values()) - counts_b.get("pending", 0)
    opened_b = counts_b.get("opened", 0) + counts_b.get("replied", 0)
    rate_b = (opened_b / sent_b) * 100 if sent_b > 0 else 0.0

    # Pick winner
    winner = "b" if rate_b > rate_a else "a"
    campaign.ab_winner = winner
    
    # Update pending leads to use the winner subject
    from sqlalchemy import update
    await db.execute(
        update(CampaignLead)
        .where(
            and_(
                CampaignLead.campaign_id == campaign.id,
                CampaignLead.status == "pending"
            )
        )
        .values(assigned_subject=winner)
    )
    
    await db.commit()
    logger.info(f"Resolved A/B test winner for campaign {campaign.id} to subject {winner.upper()} (A: {rate_a:.1f}%, B: {rate_b:.1f}%)")
    
    # Send telegram notification if configured
    q_user = await db.execute(
        select(User).where(User.id == campaign.user_id)
    )
    user = q_user.scalars().first()
    if user:
        subject_text_winner = campaign.subject_a if winner == "a" else campaign.subject_b
        message = (
            f"🏆 <b>A/B Test Winner Selected!</b>\n\n"
            f"Campaign: <b>{campaign.name}</b>\n"
            f"Winner: <b>Subject {winner.upper()}</b> (\"{subject_text_winner}\")\n\n"
            f"📈 <b>Stats:</b>\n"
            f"• Subject A: {rate_a:.1f}% open rate ({opened_a}/{sent_a})\n"
            f"• Subject B: {rate_b:.1f}% open rate ({opened_b}/{sent_b})\n\n"
            f"All remaining pending leads will receive Subject {winner.upper()}."
        )
        await send_telegram_notification(user, message)
        
    return winner

async def detect_ab_test_winners_job():
    """
    Checks active campaigns that are split testing (subject_b set),
    started >48h ago, and haven't declared a winner yet.
    Evaluates open rates and selects the winning subject line.
    """
    logger.info("Running detect_ab_test_winners_job...")
    async with async_session_maker() as db:
        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        threshold_time = now - datetime.timedelta(hours=48)
        
        q = await db.execute(
            select(Campaign).where(
                and_(
                    Campaign.status == "active",
                    Campaign.subject_b != None,
                    Campaign.ab_winner == None,
                    Campaign.started_at <= threshold_time
                )
            )
        )
        campaigns = q.scalars().all()
        
        for campaign in campaigns:
            await resolve_ab_winner_internal(campaign, db)

WARMUP_TEMPLATES = [
    {"subject": "Feedback on your services", "body": "Hello,\nI visited your website recently and was interested in your services. Do you have a brochure or pricing sheet you could send over? Thanks!"},
    {"subject": "Quick question about business hours", "body": "Hi there,\nAre you open during the upcoming holiday weekend? We are planning a visit and wanted to confirm your hours. Best!"},
    {"subject": "Partnership inquiry", "body": "Hello,\nI'm looking to connect with your business development team. We have a proposal for a joint marketing initiative that might interest you. Who is the best contact person? Best regards."},
    {"subject": "Schedule a brief call", "body": "Hi,\nI'd like to schedule a quick 10-minute call to discuss a potential project. Could you share your calendar link? Thank you!"},
    {"subject": "Inquiry regarding custom pricing", "body": "Hello,\nDo you offer custom pricing packages for small startups? We have a team of 5 and would love to know more. Thanks."}
]

async def generate_ai_warmup_email_content(db) -> dict:
    """Dynamically generates natural conversational emails using AI if keys are present."""
    # Resolve system API keys dynamically
    voidai_api_key = await get_system_setting(db, "VOIDAI_API_KEY")
    openai_api_key = await get_system_setting(db, "OPENAI_API_KEY")
    anthropic_api_key = await get_system_setting(db, "ANTHROPIC_API_KEY")
    gemini_api_key = await get_system_setting(db, "GEMINI_API_KEY")

    voidai_key = None
    if voidai_api_key:
        voidai_key = voidai_api_key
    elif openai_api_key and openai_api_key.startswith("sk-voidai"):
        voidai_key = openai_api_key
    elif anthropic_api_key and anthropic_api_key.startswith("sk-voidai"):
        voidai_key = anthropic_api_key

    # Choose provider & model
    provider = "claude"
    if not voidai_key:
        if anthropic_api_key:
            provider = "claude"
        elif openai_api_key:
            provider = "chatgpt"
        elif gemini_api_key:
            provider = "gemini"
        else:
            # No keys, return None to trigger fallback templates
            return None
    
    prompt = (
        "You are an employee sending a casual, professional email to a business contact or colleague. "
        "Generate a realistic, natural-sounding, conversational email subject and body. "
        "The topic should be a typical office or business scenario. Examples:\n"
        "- Asking about product features or pricing\n"
        "- Requesting website support or reporting a query\n"
        "- Asking for holiday hours or office location\n"
        "- Suggesting a joint marketing idea or partnership\n"
        "- Requesting a feedback session or quick call\n\n"
        "Ensure it sounds organic and completely written by a human. Avoid any sales pitches, spammy promotional language, or placeholders (like [Your Name] or [Company Name]). Write complete, realistic text.\n\n"
        "You MUST return a JSON object with exactly two keys:\n"
        "1. 'subject': The subject line of the email.\n"
        "2. 'body': The email body text.\n\n"
        "Do NOT output any markdown tags (like ```json), notes, explanations, or backticks. Return ONLY the raw valid JSON payload."
    )

    import httpx
    from app.routers.emails import clean_llm_json
    
    async with httpx.AsyncClient() as client:
        try:
            if voidai_key:
                headers = {
                    "Authorization": f"Bearer {voidai_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "claude-sonnet-4-6",
                    "messages": [{"role": "user", "content": prompt}]
                }
                res = await client.post("https://api.voidai.app/v1/chat/completions", headers=headers, json=payload, timeout=15.0)
                if res.status_code == 200:
                    result_text = res.json()["choices"][0]["message"]["content"]
                    return clean_llm_json(result_text)
            else:
                if provider == "claude":
                    headers = {
                        "x-api-key": anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    }
                    payload = {
                        "model": "claude-3-5-sonnet-20241022",
                        "max_tokens": 400,
                        "messages": [{"role": "user", "content": prompt}]
                    }
                    res = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=15.0)
                    if res.status_code == 200:
                        result_text = res.json()["content"][0]["text"]
                        return clean_llm_json(result_text)
                elif provider == "chatgpt":
                    headers = {
                        "Authorization": f"Bearer {openai_api_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt}]
                    }
                    res = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=15.0)
                    if res.status_code == 200:
                        result_text = res.json()["choices"][0]["message"]["content"]
                        return clean_llm_json(result_text)
                elif provider == "gemini":
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
                    headers = {"Content-Type": "application/json"}
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}]
                    }
                    res = await client.post(url, headers=headers, json=payload, timeout=15.0)
                    if res.status_code == 200:
                        result_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                        return clean_llm_json(result_text)
        except Exception as e:
            logger.error(f"Failed to generate dynamic AI warmup content: {e}")
            
    return None

async def warmup_cron_job():
    """
    Daily cron job that runs through all connected email accounts that have warmup enabled.
    Sends warmup emails and calculates reputation and health scores.
    """
    logger.info("Running warmup_cron_job...")
    async with async_session_maker() as db:
        # 1. Fetch all warming email accounts
        q = await db.execute(
            select(EmailAccount).where(EmailAccount.warmup_status == "warming")
        )
        warming_accounts = q.scalars().all()
        
        today = datetime.datetime.now(datetime.timezone.utc).date()
        
        for account in warming_accounts:
            # 2. Get or create WarmupLog for today
            q_log = await db.execute(
                select(WarmupLog).where(
                    and_(
                        WarmupLog.email_account_id == account.id,
                        WarmupLog.date == today
                    )
                )
            )
            log = q_log.scalars().first()
            if not log:
                log = WarmupLog(
                    email_account_id=account.id,
                    date=today,
                    emails_sent=0,
                    emails_received=0,
                    replies_sent=0,
                    inbox_moved=0,
                    spam_found=0,
                    health_score=account.warmup_health_score
                )
                db.add(log)
                await db.commit()
                await db.refresh(log)
            
            # 3. Determine daily sending volume target based on warmup age
            if not account.warmup_started_at:
                account.warmup_started_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                await db.commit()
                
            started_dt = account.warmup_started_at.replace(tzinfo=datetime.timezone.utc)
            days_warming = (datetime.datetime.now(datetime.timezone.utc) - started_dt).days + 1
            
            if days_warming <= 3:
                target_volume = 5
                target_reply_rate = 0.80
            elif days_warming <= 7:
                target_volume = 10
                target_reply_rate = 0.75
            elif days_warming <= 14:
                target_volume = 20
                target_reply_rate = 0.70
            elif days_warming <= 21:
                target_volume = 30
                target_reply_rate = 0.65
            elif days_warming <= 30:
                target_volume = 40
                target_reply_rate = 0.60
            else:
                target_volume = 50
                target_reply_rate = 0.50
                
            # If already sent the daily quota, skip sending more
            if log.emails_sent >= target_volume:
                continue
                
            # 4. Generate warmup outbound emails
            emails_to_send = target_volume - log.emails_sent
            
            # Get list of other warming accounts in the pool
            q_pool = await db.execute(
                select(EmailAccount).where(
                    and_(
                        EmailAccount.warmup_status == "warming",
                        EmailAccount.id != account.id
                    )
                )
            )
            pool = q_pool.scalars().all()
            
            for _ in range(emails_to_send):
                # Select target (recipient)
                recipient_email = ""
                recipient_account = None
                
                if pool:
                    recipient_account = random.choice(pool)
                    recipient_email = recipient_account.from_email
                else:
                    # Fallback to mock pool in sandbox/local dev
                    recipient_email = "mock-warmup-pool@getleads.com"
                    
                # Generate dynamic AI warmup email or fallback to templates
                ai_content = await generate_ai_warmup_email_content(db)
                if ai_content and "subject" in ai_content and "body" in ai_content:
                    subj = ai_content["subject"]
                    body = ai_content["body"]
                else:
                    tmpl = random.choice(WARMUP_TEMPLATES)
                    subj = tmpl["subject"]
                    body = tmpl["body"]
                
                # Deliver warmup email with custom warmup header
                success = await send_email(
                    account,
                    recipient_email,
                    subj,
                    body,
                    db,
                    headers={"X-GetLeads-Warmup": "true"}
                )
                if success:
                    log.emails_sent += 1
                    
                    is_sender_mock = (
                        not account.access_token
                        or account.access_token.startswith("mock-")
                        or account.access_token == "mock-token"
                    )
                    is_recipient_mock = (
                        not recipient_account
                        or not recipient_account.access_token
                        or recipient_account.access_token.startswith("mock-")
                        or recipient_account.access_token == "mock-token"
                    )

                    # Only run simulation if sender or recipient is mock. 
                    # If both are real connected accounts, we let the real IMAP worker handle it.
                    if recipient_account and (is_sender_mock or is_recipient_mock):
                        # Find or create today's log for recipient
                        q_rec_log = await db.execute(
                            select(WarmupLog).where(
                                and_(
                                    WarmupLog.email_account_id == recipient_account.id,
                                    WarmupLog.date == today
                                )
                            )
                        )
                        rec_log = q_rec_log.scalars().first()
                        if not rec_log:
                            rec_log = WarmupLog(
                                email_account_id=recipient_account.id,
                                date=today,
                                emails_sent=0,
                                emails_received=0,
                                replies_sent=0,
                                inbox_moved=0,
                                spam_found=0,
                                health_score=recipient_account.warmup_health_score
                            )
                            db.add(rec_log)
                            await db.commit()
                            await db.refresh(rec_log)
                            
                        rec_log.emails_received += 1
                        
                        # Simulate Inbox Deliverability: 95% chance of moving to inbox, 5% spam
                        if random.random() < 0.95:
                            rec_log.inbox_moved += 1
                        else:
                            rec_log.spam_found += 1
                            
                        # Simulate Reply: based on target reply rate
                        if random.random() < target_reply_rate:
                            rec_log.replies_sent += 1
                            log.emails_received += 1
                            
                            # Sim sender receiving reply
                            if random.random() < 0.95:
                                log.inbox_moved += 1
                            else:
                                log.spam_found += 1
                                
                        await db.commit()
                    elif not recipient_account:
                        # Recipient is mock (fallback pool): simulate its response actions directly on sender log
                        # Sim receipt
                        log.emails_received += 1
                        
                        # Inbox Deliverability
                        if random.random() < 0.95:
                            log.inbox_moved += 1
                        else:
                            log.spam_found += 1
                            
                        # Reply
                        if random.random() < target_reply_rate:
                            log.replies_sent += 1
                            
                        await db.commit()
                        
            # Recalculate and update health score for this account
            total_delivery = log.inbox_moved + log.spam_found
            inbox_delivery_rate = log.inbox_moved / total_delivery if total_delivery > 0 else 0.95
            spam_rate = log.spam_found / total_delivery if total_delivery > 0 else 0.05
            
            reply_rate = log.replies_sent / log.emails_received if log.emails_received > 0 else target_reply_rate
            
            age_factor = min(1.0, days_warming / 30.0)
            
            computed_score = (
                inbox_delivery_rate * 0.4 +
                reply_rate * 0.3 +
                (1.0 - spam_rate) * 0.2 +
                age_factor * 0.1
            ) * 100.0
            
            final_health = int(min(100.0, max(0.0, computed_score)))
            log.health_score = final_health
            account.warmup_health_score = final_health
            await db.commit()
            
            # Safety rules: Pause warm-up if health score < 30
            if final_health < 30:
                account.warmup_status = "paused"
                account.is_active = False # Deactivate mailbox
                await db.commit()
                
                # Fetch user details to alert them
                q_user = await db.execute(
                    select(User).where(User.id == account.user_id)
                )
                user = q_user.scalars().first()
                if user:
                    message_text = (
                        f"⚠️ <b>Warming Account Suspended!</b>\n\n"
                        f"Mailbox: <b>{account.from_email}</b>\n"
                        f"Critical Health Score: <b>{final_health}/100</b>\n"
                        f"Status: Warm-up auto-paused, and mailbox is deactivated.\n\n"
                        f"<i>Action Required: Please review spam complaint trends or connect a different outbound email domain.</i>"
                    )
                    await send_telegram_notification(user, message_text)
                    
                    # Auto pause user's active campaigns connected to this mailbox
                    q_camps = await db.execute(
                        select(Campaign).where(
                            and_(
                                Campaign.email_account_id == account.id,
                                Campaign.status == "active"
                            )
                        )
                    )
                    camps = q_camps.scalars().all()
                    for camp in camps:
                        camp.status = "paused"
                    await db.commit()

def start_scheduler():
    """Initializes and starts the periodic background jobs runner."""
    if not scheduler.running:
        # 1. Job to send emails (runs every 1 minute)
        scheduler.add_job(
            send_emails_job,
            "interval",
            minutes=1,
            id="send_emails_job",
            replace_existing=True
        )
        # 2. Job to check follow-up sequencing (runs every 5 minutes)
        scheduler.add_job(
            check_follow_ups_job,
            "interval",
            minutes=5,
            id="check_follow_ups_job",
            replace_existing=True
        )
        # 3. Job to parse replies & bounces (runs every 2 minutes in development to make it responsive)
        scheduler.add_job(
            check_replies_and_bounces_job,
            "interval",
            minutes=2,
            id="check_replies_and_bounces_job",
            replace_existing=True
        )
        # 4. Job for daily Telegram reports (runs at 10 PM daily)
        scheduler.add_job(
            send_daily_reports_job,
            "cron",
            hour=22,
            minute=0,
            id="send_daily_reports_job",
            replace_existing=True
        )
        # 5. Job to check A/B testing winners hourly
        scheduler.add_job(
            detect_ab_test_winners_job,
            "interval",
            hours=1,
            id="detect_ab_test_winners_job",
            replace_existing=True
        )
        # 6. Job for daily email Warm-up (runs at 11 PM daily)
        scheduler.add_job(
            warmup_cron_job,
            "cron",
            hour=23,
            minute=0,
            id="warmup_cron_job",
            replace_existing=True
        )
        # 7. Job for real-time IMAP Warm-up processing (runs every 10 minutes)
        scheduler.add_job(
            process_incoming_warmups_job,
            "interval",
            minutes=10,
            id="process_incoming_warmups_job",
            replace_existing=True
        )
        
        scheduler.start()

async def process_incoming_warmups_job():
    """
    Background job to run IMAP checks and auto-replies for all active warming mailboxes.
    Runs periodically (e.g., every 10 minutes).
    """
    logger.info("Running process_incoming_warmups_job...")
    async with async_session_maker() as db:
        # Fetch all warming accounts
        q = await db.execute(
            select(EmailAccount).where(EmailAccount.warmup_status == "warming")
        )
        warming_accounts = q.scalars().all()
        for account in warming_accounts:
            try:
                await process_incoming_warmups(account, db)
            except Exception as e:
                logger.error(f"Error in process_incoming_warmups_job for {account.from_email}: {str(e)}")
        logger.info("APScheduler Background Jobs started successfully.")

def stop_scheduler():
    """Clean shutdown of the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler Background Jobs shut down successfully.")
