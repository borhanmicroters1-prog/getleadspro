import asyncio
from sqlalchemy import text
from app.database import async_session_maker

async def migrate():
    print("Connecting to the database...")
    async with async_session_maker() as session:
        # 1. Find the name of the unique constraint on leads(user_id, email)
        query_find_constraint = text("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'public.leads'::regclass 
              AND contype = 'u';
        """)
        
        result = await session.execute(query_find_constraint)
        constraints = [row[0] for row in result.fetchall()]
        print(f"Found unique constraints on leads table: {constraints}")
        
        # 2. Drop the old constraint
        # The default name for UNIQUE(user_id, email) is usually "leads_user_id_email_key"
        old_constraint = None
        for c in constraints:
            if "user_id" in c and "email" in c:
                old_constraint = c
                break
        
        if not old_constraint:
            # Fallback check if it has a generic name
            for c in constraints:
                if c.startswith("leads_") or "key" in c:
                    old_constraint = c
                    break
                    
        if old_constraint:
            print(f"Dropping constraint '{old_constraint}'...")
            await session.execute(text(f"ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS {old_constraint};"))
            print(f"Constraint '{old_constraint}' dropped.")
        else:
            print("Could not identify the unique constraint name. Attempting drop using default name...")
            await session.execute(text("ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_user_id_email_key;"))
            
        # 3. Create a new unique index or constraint.
        # Since PostgreSQL's UNIQUE constraint treats NULLs as distinct (allowing duplicate emails when campaign_name is null),
        # we can create a UNIQUE INDEX using COALESCE to treat NULL as empty string, which enforces uniqueness even for null campaign names.
        # E.g.: UNIQUE (user_id, COALESCE(campaign_name, ''), email)
        print("Creating new unique index on (user_id, COALESCE(campaign_name, ''), email)...")
        await session.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_user_campaign_lead_email 
            ON public.leads (user_id, COALESCE(campaign_name, ''), email);
        """))
        
        await session.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
