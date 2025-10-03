"""
FastAPI main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.database import init_db
from .core.migrations import run_migrations
from .api import upload, transcription, audio, export, ai_corrections, ai_analysis, llm_logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Initialize database and run migrations
    init_db()
    run_migrations()
    yield
    # Shutdown: Clean up resources


app = FastAPI(
    title="Audio Transcription API",
    description="API for audio interview transcription with speaker recognition and AI editing",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

# Include routers
app.include_router(upload.router)
app.include_router(transcription.router)
app.include_router(audio.router)
app.include_router(export.router)
app.include_router(ai_corrections.router)
app.include_router(ai_analysis.router)
app.include_router(llm_logs.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "audio-transcription-api"}


@app.get("/health")
async def health():
    """Detailed health check with component status."""
    import os
    import sqlite3
    import requests
    from pathlib import Path

    components = {
        "api": {"status": "up", "message": "FastAPI running"},
        "database": {"status": "unknown", "message": ""},
        "whisper": {"status": "unknown", "message": ""},
        "ollama": {"status": "unknown", "message": ""},
        "redis": {"status": "unknown", "message": ""},
        "storage": {"status": "unknown", "message": ""},
    }

    # Check database
    try:
        from .core.config import settings
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        if Path(db_path).exists():
            conn = sqlite3.connect(db_path)
            conn.execute("SELECT 1")
            conn.close()
            components["database"] = {"status": "up", "message": f"SQLite database accessible"}
        else:
            components["database"] = {"status": "down", "message": "Database file not found"}
    except Exception as e:
        components["database"] = {"status": "down", "message": str(e)}

    # Check Whisper model
    try:
        import whisper
        components["whisper"] = {"status": "up", "message": f"Whisper library available (model: {settings.WHISPER_MODEL_SIZE})"}
    except Exception as e:
        components["whisper"] = {"status": "down", "message": f"Whisper not available: {str(e)}"}

    # Check Ollama
    try:
        response = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2)
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m["name"] for m in models]
            components["ollama"] = {
                "status": "up",
                "message": f"{len(models)} model(s) available: {', '.join(model_names[:3])}"
            }
        else:
            components["ollama"] = {"status": "down", "message": "Ollama API unreachable"}
    except Exception as e:
        components["ollama"] = {"status": "down", "message": "Ollama not available (optional)"}

    # Check Redis
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        components["redis"] = {"status": "up", "message": "Redis connection successful"}
    except Exception as e:
        components["redis"] = {"status": "down", "message": "Redis not available (optional)"}

    # Check storage
    try:
        storage_path = Path(settings.AUDIO_STORAGE_PATH)
        if storage_path.exists():
            components["storage"] = {"status": "up", "message": f"Storage accessible at {settings.AUDIO_STORAGE_PATH}"}
        else:
            os.makedirs(settings.AUDIO_STORAGE_PATH, exist_ok=True)
            components["storage"] = {"status": "up", "message": "Storage created"}
    except Exception as e:
        components["storage"] = {"status": "down", "message": str(e)}

    # Determine overall status
    critical_down = any(
        components[k]["status"] == "down"
        for k in ["api", "database", "whisper", "storage"]
    )
    overall_status = "degraded" if critical_down else "healthy"

    return {
        "status": overall_status,
        "version": "0.1.0",
        "components": components,
        "critical": ["api", "database", "whisper", "storage"],
        "optional": ["ollama", "redis"]
    }
