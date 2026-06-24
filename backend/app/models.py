from sqlalchemy import Column, String, Integer, Float, DateTime, Date, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.types import TypeDecorator, CHAR
from datetime import datetime, timezone
import uuid

class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses
    CHAR(36), storing as stringified hex values.
    Returns strings to Python.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            from sqlalchemy.dialects.postgresql import UUID
            return dialect.type_descriptor(UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            if isinstance(value, str):
                return uuid.UUID(value)
            return value
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)

class EncryptedString(TypeDecorator):
    """SQLAlchemy TypeDecorator that encrypts values before storing them in the database
    and decrypts them when loading them.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        from app.utils.encryption import encrypt
        return encrypt(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        from app.utils.encryption import decrypt
        return decrypt(value)

Base = declarative_base()

def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True)  # Matches Supabase UUID
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=True)
    avatar = Column(String(500), nullable=True)
    plan = Column(String(50), default="Free")
    credits = Column(Integer, default=50)
    stripe_customer_id = Column(String(255), nullable=True)
    telegram_chat_id = Column(String(255), nullable=True)
    telegram_bot_token = Column(String(255), nullable=True)
    is_admin = Column(Boolean, default=False)
    custom_tracking_domain = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    leads = relationship("Lead", back_populates="user", cascade="all, delete-orphan")
    credits_logs = relationship("CreditsLog", back_populates="user", cascade="all, delete-orphan")
    blacklist_items = relationship("Blacklist", back_populates="user", cascade="all, delete-orphan")
    email_accounts = relationship("EmailAccount", back_populates="user", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="user", cascade="all, delete-orphan")
    support_tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "avatar": self.avatar,
            "plan": self.plan,
            "credits": self.credits,
            "stripe_customer_id": self.stripe_customer_id,
            "telegram_chat_id": self.telegram_chat_id,
            "telegram_bot_token": self.telegram_bot_token,
            "is_admin": self.is_admin,
            "custom_tracking_domain": self.custom_tracking_domain,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Lead(Base):
    __tablename__ = "leads"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False)
    company = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    rating = Column(Float, nullable=True)
    source = Column(String(50), nullable=False)  # google_maps, facebook_ads, csv_upload
    campaign_name = Column(String(255), nullable=True)
    status = Column(String(50), default="new")  # new, contacted, replied, bounced, unsubscribed, ooo
    score = Column(Float, default=0.0)
    title = Column(String(255), nullable=True)
    verification_status = Column(String(50), default="unverified")  # unverified, valid, invalid, catch_all, disposable, unknown
    verification_error = Column(String(500), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Unique constraint per user to prevent duplicate email records per campaign
    __table_args__ = (UniqueConstraint("user_id", "campaign_name", "email", name="uq_user_campaign_lead_email"),)

    # Relationships
    user = relationship("User", back_populates="leads")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "email": self.email,
            "company": self.company,
            "phone": self.phone,
            "website": self.website,
            "address": self.address,
            "rating": self.rating,
            "source": self.source,
            "campaign_name": self.campaign_name,
            "status": self.status,
            "score": self.score,
            "title": self.title,
            "verification_status": self.verification_status,
            "verification_error": self.verification_error,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CreditsLog(Base):
    __tablename__ = "credits_log"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)  # scrape, purchase, bonus
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    reference = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="credits_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "amount": self.amount,
            "balance_after": self.balance_after,
            "reference": self.reference,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Blacklist(Base):
    __tablename__ = "blacklist"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)  # email, domain
    value = Column(String(255), nullable=False)
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Unique constraint per user to prevent duplicate blacklist entries
    __table_args__ = (UniqueConstraint("user_id", "value", name="uq_user_blacklist_value"),)

    # Relationships
    user = relationship("User", back_populates="blacklist_items")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "value": self.value,
            "reason": self.reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class EmailAccount(Base):
    __tablename__ = "email_accounts"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # gmail, brevo
    access_token = Column(EncryptedString(2000), nullable=True)
    refresh_token = Column(EncryptedString(2000), nullable=True)
    from_email = Column(String(255), nullable=False)
    from_name = Column(String(255), nullable=True)
    daily_limit = Column(Integer, default=50)
    emails_sent_today = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_system_seed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Warm-up Fields
    warmup_enabled = Column(Boolean, default=False)
    warmup_status = Column(String(50), default="idle")  # idle, warming, paused
    warmup_started_at = Column(DateTime, nullable=True)
    warmup_health_score = Column(Integer, default=100)

    # Unique constraint per user to prevent duplicate email connections for the same address
    __table_args__ = (UniqueConstraint("user_id", "from_email", name="uq_user_email_account_from_email"),)

    # Relationships
    user = relationship("User", back_populates="email_accounts")
    warmup_logs = relationship("WarmupLog", back_populates="email_account", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "from_email": self.from_email,
            "from_name": self.from_name,
            "daily_limit": self.daily_limit,
            "emails_sent_today": self.emails_sent_today,
            "is_active": self.is_active,
            "is_system_seed": self.is_system_seed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "warmup_enabled": self.warmup_enabled,
            "warmup_status": self.warmup_status,
            "warmup_started_at": self.warmup_started_at.isoformat() if self.warmup_started_at else None,
            "warmup_health_score": self.warmup_health_score,
        }


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="draft")  # draft, active, paused, completed
    email_account_id = Column(GUID, ForeignKey("email_accounts.id", ondelete="SET NULL"), nullable=True)
    rotate_mailboxes = Column(Boolean, default=True, nullable=False)
    rotate_mailbox_ids = Column(String(2000), nullable=True)
    ai_model = Column(String(100), default="claude-3.5-sonnet", nullable=False)
    ai_prompt_template = Column(String(2000), nullable=True)
    subject_a = Column(String(255), nullable=True)
    subject_b = Column(String(255), nullable=True)
    ab_winner = Column(String(50), nullable=True)
    body_template = Column(String(5000), nullable=True)
    send_as_plaintext = Column(Boolean, default=False, nullable=False)
    
    # Follow-ups
    follow_up_1_days = Column(Integer, nullable=True)
    follow_up_1_body = Column(String(5000), nullable=True)
    follow_up_2_days = Column(Integer, nullable=True)
    follow_up_2_body = Column(String(5000), nullable=True)
    follow_up_3_days = Column(Integer, nullable=True)
    follow_up_3_body = Column(String(5000), nullable=True)
    
    # Schedule
    send_start_hour = Column(Integer, default=9)
    send_end_hour = Column(Integer, default=18)
    timezone = Column(String(100), default="UTC")
    send_interval = Column(Integer, default=2, nullable=False)
    
    created_at = Column(DateTime, default=utc_now, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="campaigns")
    email_account = relationship("EmailAccount")
    leads = relationship("CampaignLead", back_populates="campaign", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "status": self.status,
            "email_account_id": self.email_account_id,
            "rotate_mailboxes": self.rotate_mailboxes,
            "rotate_mailbox_ids": self.rotate_mailbox_ids,
            "subject_a": self.subject_a,
            "subject_b": self.subject_b,
            "ab_winner": self.ab_winner,
            "body_template": self.body_template,
            "send_as_plaintext": self.send_as_plaintext,
            "follow_up_1_days": self.follow_up_1_days,
            "follow_up_1_body": self.follow_up_1_body,
            "follow_up_2_days": self.follow_up_2_days,
            "follow_up_2_body": self.follow_up_2_body,
            "follow_up_3_days": self.follow_up_3_days,
            "follow_up_3_body": self.follow_up_3_body,
            "send_start_hour": self.send_start_hour,
            "send_end_hour": self.send_end_hour,
            "timezone": self.timezone,
            "send_interval": self.send_interval,
            "ai_model": self.ai_model,
            "ai_prompt_template": self.ai_prompt_template,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class CampaignLead(Base):
    __tablename__ = "campaign_leads"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(GUID, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    lead_id = Column(GUID, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="pending")  # pending, sent, opened, replied, bounced, unsubscribed, ooo
    sent_count = Column(Integer, default=0)
    last_sent_at = Column(DateTime, nullable=True)
    next_follow_up_at = Column(DateTime, nullable=True)
    assigned_subject = Column(String(10), default="a") # a or b
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="leads")
    lead = relationship("Lead")

    def to_dict(self):
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "lead_id": self.lead_id,
            "status": self.status,
            "sent_count": self.sent_count,
            "last_sent_at": self.last_sent_at.isoformat() if self.last_sent_at else None,
            "next_follow_up_at": self.next_follow_up_at.isoformat() if self.next_follow_up_at else None,
            "assigned_subject": self.assigned_subject,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class WarmupLog(Base):
    __tablename__ = "warmup_logs"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    email_account_id = Column(GUID, ForeignKey("email_accounts.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)
    emails_sent = Column(Integer, default=0)
    emails_received = Column(Integer, default=0)
    replies_sent = Column(Integer, default=0)
    inbox_moved = Column(Integer, default=0)
    spam_found = Column(Integer, default=0)
    health_score = Column(Integer, default=100)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Unique constraint per account and date
    __table_args__ = (UniqueConstraint("email_account_id", "date", name="uq_email_account_warmup_date"),)

    # Relationships
    email_account = relationship("EmailAccount", back_populates="warmup_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "email_account_id": self.email_account_id,
            "date": self.date.isoformat() if self.date else None,
            "emails_sent": self.emails_sent,
            "emails_received": self.emails_received,
            "replies_sent": self.replies_sent,
            "inbox_moved": self.inbox_moved,
            "spam_found": self.spam_found,
            "health_score": self.health_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(255), primary_key=True)
    value = Column(String(2000), nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AILog(Base):
    __tablename__ = "ai_logs"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # voidai, openai, anthropic, gemini
    model = Column(String(50), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "cost": self.cost,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PaymentLog(Base):
    __tablename__ = "payment_logs"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tran_id = Column(String(100), unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    item_type = Column(String(50), nullable=False)  # plan, pack
    item_id = Column(String(50), nullable=False)    # starter, pro, business
    status = Column(String(50), nullable=False)     # initiated, success, failed, cancelled
    error_reason = Column(String(500), nullable=True)
    promo_code = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tran_id": self.tran_id,
            "amount": self.amount,
            "item_type": self.item_type,
            "item_id": self.item_id,
            "status": self.status,
            "error_reason": self.error_reason,
            "promo_code": self.promo_code,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    message = Column(String(2000), nullable=False)
    type = Column(String(30), nullable=False, default="info")  # info, warning, critical
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_email = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)       # user_login, impersonate, settings_change, maintenance_toggle, etc.
    target = Column(String(255), nullable=True)         # affected resource/user
    details = Column(String(2000), nullable=True)       # extra context
    created_at = Column(DateTime, default=utc_now, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "actor_email": self.actor_email,
            "action": self.action,
            "target": self.target,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, nullable=False)
    discount_type = Column(String(30), nullable=False, default="percentage")  # percentage, fixed, credits
    discount_value = Column(Float, nullable=False)
    max_uses = Column(Integer, nullable=True)  # None = unlimited
    uses_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    expiry_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "discount_type": self.discount_type,
            "discount_value": self.discount_value,
            "max_uses": self.max_uses,
            "uses_count": self.uses_count,
            "is_active": self.is_active,
            "expiry_at": self.expiry_at.isoformat() if self.expiry_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class GlobalBlacklist(Base):
    __tablename__ = "global_blacklist"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String(50), nullable=False)  # email, domain
    value = Column(String(255), unique=True, nullable=False)
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "value": self.value,
            "reason": self.reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(String(2000), nullable=False)
    status = Column(String(50), default="open", nullable=False)       # open, in_progress, resolved, closed
    priority = Column(String(30), default="medium", nullable=False)    # low, medium, high
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="support_tickets")
    replies = relationship("TicketReply", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketReply.created_at")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TicketReply(Base):
    __tablename__ = "ticket_replies"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(GUID, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    sender_email = Column(String(255), nullable=False)
    is_admin_reply = Column(Boolean, default=False, nullable=False)
    message = Column(String(2000), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="replies")

    def to_dict(self):
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "sender_email": self.sender_email,
            "is_admin_reply": self.is_admin_reply,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

