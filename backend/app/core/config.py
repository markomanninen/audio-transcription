"""
Application conf    # Whisper configuration
    WHISPER_MODEL_SIZE: str = "base"  # tiny, base, small, medium, large
    WHISPER_DEVICE: str = "auto"  # auto, cpu, cuda, mpsration using Pydantic settings.
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
    ALLOWED_AUDIO_FORMATS: list[str] = ["mp3", "wav", "m4a", "mp4", "webm", "ogg", "flac"]

    # Whisper configuration
    WHISPER_MODEL_SIZE: str = "medium"  # tiny, base, small, medium, large
    WHISPER_DEVICE: str = "auto"  # auto, cpu, cuda, mps
    WHISPER_STRICT_MEMORY: bool = False  # If True, abort when memory below threshold
    E2E_TRANSCRIPTION_STUB: bool = False  # When true, skip Whisper processing and stub results (for local E2E tests)

    # LLM services
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-3-haiku"
    
    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://ollama:11434"  # Default to internal Docker service
    OLLAMA_MODEL: str = "llama3.2:1b"  # Default model
    OLLAMA_TIMEOUT: int = 30  # Request timeout in seconds
    OLLAMA_EXTERNAL: bool = False  # Set to True when using external Ollama service
    
    # External Ollama Configuration (when OLLAMA_EXTERNAL=True)
    OLLAMA_API_KEY: str = ""  # Optional API key for secured external Ollama
    OLLAMA_VERIFY_SSL: bool = True  # SSL certificate verification
    
    # Default LLM Provider Settings
    DEFAULT_LLM_PROVIDER: str = "ollama"
    DEFAULT_LLM_MODEL: str = "llama3.2:1b"

    # Redis for background tasks
    REDIS_URL: str = "redis://redis:6379/0"

    # Security
    JWT_SECRET_KEY: str = "development-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # External integrations
    HUGGINGFACE_HUB_TOKEN: str = ""

    # CORS
    CORS_ORIGINS: str = (
        "http://localhost,"
        "http://127.0.0.1,"
        "http://localhost:3000,"
        "http://localhost:5173,"
        "http://localhost:5174,"
        "http://localhost:5175,"
        "https://localhost"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return []
        raw = self.CORS_ORIGINS.strip()
        if raw.startswith("[") and raw.endswith("]"):
            import json
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [item.strip() for item in parsed if isinstance(item, str) and item.strip()]
            except json.JSONDecodeError:
                pass
        return [item.strip() for item in raw.split(",") if item.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        env_prefix="",
        env_file_encoding="utf-8",
    )


settings = Settings()
