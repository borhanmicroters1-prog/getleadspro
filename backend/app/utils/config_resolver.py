from sqlalchemy.future import select
from app.models import SystemSetting
from app.config import settings

async def get_system_setting(db, key: str) -> str:
    """
    Get a configuration value from the system_settings table,
    falling back to settings from config.py if not found or empty.
    """
    try:
        q = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = q.scalars().first()
        if setting and setting.value and setting.value.strip():
            return setting.value.strip()
    except Exception as e:
        # Fallback to config settings if table doesn't exist yet or query fails
        print(f"Error querying system settings for {key}: {e}")
        pass
    
    # Fallback to environment/config settings
    return getattr(settings, key, "")
