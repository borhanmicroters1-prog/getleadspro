import asyncio
from sqlalchemy import select
from app.database import async_session_maker
from app.models import Lead

async def check():
    async with async_session_maker() as session:
        q = await session.execute(
            select(Lead).where(Lead.email.like("%duplicate_lead_scoped_test_2%"))
        )
        leads = q.scalars().all()
        print(f"Found {len(leads)} leads matching duplicate_lead_scoped_test_2:")
        for l in leads:
            print(f"- ID: {l.id}, Email: {l.email}, Campaign: {l.campaign_name}, Source: {l.source}")

if __name__ == "__main__":
    asyncio.run(check())
