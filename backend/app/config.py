import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    DATABASE_URL: str = "sqlite+aiosqlite:///./getleads.db"
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-key-for-local-testing"
    SUPABASE_PROJECT_ID: str = "grdqjnazfdznbviopmxf"
    SUPER_ADMIN_EMAIL: str = "admin@getleads.com"
    CRON_SECRET: str = "super-secret-cron-key-for-local-testing"
    
    # Scraper API Keys
    GOOGLE_MAPS_API_KEY: str = ""
    META_ACCESS_TOKEN: str = ""

    # AI API Keys
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    VOIDAI_API_KEY: str = ""

    # SSLCommerz Configuration
    SSLCOMMERZ_STORE_ID: str = ""
    SSLCOMMERZ_STORE_PASSWORD: str = ""
    SSLCOMMERZ_IS_SANDBOX: bool = True
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"


    model_config = SettingsConfigDict(
        # Look for .env file in the backend directory
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

