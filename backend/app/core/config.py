"""
Application configuration using Pydantic settings.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Audio Transcription API"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./data/transcriptions.db"

    # Storage
    AUDIO_STORAGE_PATH: str = "./data/audio"
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB in bytes
    ALLOWED_AUDIO_FORMATS: list[str] = ["mp3", "wav", "m4a", "webm", "ogg", "flac"]

    # Whisper configuration
    WHISPER_MODEL_SIZE: str = "base"  # tiny, base, small, medium, large
    WHISPER_DEVICE: str = "cpu"  # cpu or cuda

    # LLM services
    OPENROUTER_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    DEFAULT_LLM_PROVIDER: str = "ollama"
    DEFAULT_LLM_MODEL: str = "llama3.2:1b"

    # Redis for background tasks
    REDIS_URL: str = "redis://redis:6379/0"

    # Security
    JWT_SECRET_KEY: str = "development-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )


settings = Settings()
