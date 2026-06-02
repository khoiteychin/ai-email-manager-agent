from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    PORT: int = 3001
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    # Firebase
    FIREBASE_PROJECT_ID: str = "email-agent-70f5c"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./firebase-service-account.json"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Google OAuth / Gmail
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "https://api.emailkhanh.freeddns.org/gmail/callback"

    # Discord
    DISCORD_CLIENT_ID: str = ""
    DISCORD_CLIENT_SECRET: str = ""
    DISCORD_REDIRECT_URI: str = "https://api.emailkhanh.freeddns.org/discord/callback"
    DISCORD_BOT_TOKEN: str = ""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,https://emailkhanh.freeddns.org"

    FRONTEND_URL: str = "http://localhost:3000"
    GMAIL_PUBSUB_TOPIC: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
