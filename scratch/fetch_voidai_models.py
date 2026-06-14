import sys
import os
import asyncio
import httpx

# Add backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import async_session_maker
from app.utils.config_resolver import get_system_setting

async def main():
    print("Connecting to database and resolving VOIDAI_API_KEY...")
    async with async_session_maker() as db:
        voidai_api_key = await get_system_setting(db, "VOIDAI_API_KEY")
        openai_api_key = await get_system_setting(db, "OPENAI_API_KEY")
        anthropic_api_key = await get_system_setting(db, "ANTHROPIC_API_KEY")
        
    voidai_key = voidai_api_key
    if not voidai_key:
        if openai_api_key and openai_api_key.startswith("sk-voidai"):
            voidai_key = openai_api_key
        elif anthropic_api_key and anthropic_api_key.startswith("sk-voidai"):
            voidai_key = anthropic_api_key
            
    if not voidai_key:
        print("Error: No VoidAI API key resolved.")
        return
        
    print(f"VoidAI key found: {voidai_key[:12]}...")
    
    headers = {
        "Authorization": f"Bearer {voidai_key}",
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get("https://api.voidai.app/v1/models", headers=headers, timeout=10.0)
            print("Status code:", res.status_code)
            if res.status_code == 200:
                models = res.json().get("data", [])
                print("\nAvailable models on VoidAI:")
                for m in models:
                    print(f"- {m.get('id')}")
            else:
                print("Error body:", res.text)
        except Exception as e:
            print("Request failed:", e)

if __name__ == "__main__":
    # Add environment variables
    # Read backend/.env to load settings if needed
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
    
    asyncio.run(main())
