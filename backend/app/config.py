import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    FALKORDB_HOST: str = "localhost"
    FALKORDB_PORT: int = 6379
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    SANDBOX_TIMEOUT_SECONDS: int = 60
    SANDBOX_MAX_MEMORY_MB: int = 512
    ENABLE_DOCKER_SANDBOX: bool = True
    OFFLINE_FIXTURE_MODE: bool = False

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
