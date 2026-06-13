from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import auth
from app.config import settings
from app.utils.scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database on startup (creating tables if they don't exist)
    await init_db()
    # Start APScheduler background jobs
    start_scheduler()
    yield
    # Cleanup on shutdown: stop background jobs
    stop_scheduler()

app = FastAPI(
    title="GetClient API",
    description="Backend API for GetClient Email Outreach SaaS",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
    max_age=600,
)

# Register routers
from app.routers import leads, email_accounts, emails, campaigns, blacklist, automation, billing, warmup, analytics, cron, admin
app.include_router(auth.router)
app.include_router(leads.router)
app.include_router(email_accounts.router)
app.include_router(emails.router)
app.include_router(campaigns.router)
app.include_router(blacklist.router)
app.include_router(automation.router)
app.include_router(billing.router)
app.include_router(warmup.router)
app.include_router(analytics.router)
app.include_router(cron.router)
app.include_router(admin.router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "api_version": "1.0.0"
    }
