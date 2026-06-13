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
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    leads = relationship("Lead", back_populates="user", cascade="all, delete-orphan")
    credits_logs = relationship("CreditsLog", back_populates="user", cascade="all, delete-orphan")
    blacklist_items = relationship("Blacklist", back_populates="user", cascade="all, delete-orphan")
    email_accounts = relationship("EmailAccount", back_populates="user", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="user", cascade="all, delete-orphan")

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
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Unique constraint per user to prevent duplicate email records
    __table_args__ = (UniqueConstraint("user_id", "email", name="uq_user_lead_email"),)

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
    access_token = Column(String(500), nullable=True)
    refresh_token = Column(String(500), nullable=True)
    from_email = Column(String(255), nullable=False)
    from_name = Column(String(255), nullable=True)
    daily_limit = Column(Integer, default=50)
    emails_sent_today = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
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
    subject_a = Column(String(255), nullable=True)
    subject_b = Column(String(255), nullable=True)
    ab_winner = Column(String(50), nullable=True)
    body_template = Column(String(5000), nullable=True)
    
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
            "subject_a": self.subject_a,
            "subject_b": self.subject_b,
            "ab_winner": self.ab_winner,
            "body_template": self.body_template,
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
