from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.models import Base

# Determine if we are using SQLite and configure connect_args accordingly
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
if is_sqlite:
    connect_args = {"check_same_thread": False}
else:
    # Disable prepared statements cache for Supabase connection pooler (PgBouncer)
    connect_args = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0
    }

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

# Create session maker
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Dependency to get database session
async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Initialize database tables
async def init_db():
    # 1. Create tables if they do not exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # 2. Run column additions in separate transactions to avoid transactional rollback issues in PostgreSQL
    migrations = [
        ("campaigns", "rotate_mailboxes", "ALTER TABLE campaigns ADD COLUMN rotate_mailboxes BOOLEAN DEFAULT true"),
        ("campaigns", "send_interval", "ALTER TABLE campaigns ADD COLUMN send_interval INTEGER DEFAULT 2"),
        ("leads", "title", "ALTER TABLE leads ADD COLUMN title VARCHAR(255)"),
        ("email_accounts", "warmup_enabled", "ALTER TABLE email_accounts ADD COLUMN warmup_enabled BOOLEAN DEFAULT false"),
        ("email_accounts", "warmup_status", "ALTER TABLE email_accounts ADD COLUMN warmup_status VARCHAR(50) DEFAULT 'idle'"),
        ("email_accounts", "warmup_started_at", "ALTER TABLE email_accounts ADD COLUMN warmup_started_at TIMESTAMP"),
        ("email_accounts", "warmup_health_score", "ALTER TABLE email_accounts ADD COLUMN warmup_health_score INTEGER DEFAULT 100")
    ]

    for table, column, sql in migrations:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
            print(f"Database migrated: {table}.{column} added.")
        except Exception:
            # Column already exists or other error, safe to ignore and continue
            pass
            
    print("Database initialized.")
