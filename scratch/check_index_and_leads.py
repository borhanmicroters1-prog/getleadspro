import asyncio
from sqlalchemy import text, select
from app.database import async_session_maker
from app.models import Lead

async def check():
    async with async_session_maker() as session:
        # Check last 5 leads
        print("\nLast 5 leads in database:")
        q = await session.execute(
            select(Lead).order_by(Lead.created_at.desc()).limit(5)
        )
        leads = q.scalars().all()
        for l in leads:
            print(f"- ID: {l.id}, Email: {l.email}, Campaign: {l.campaign_name}, Source: {l.source}, UserID: {l.user_id}")

if __name__ == "__main__":
    asyncio.run(check())
