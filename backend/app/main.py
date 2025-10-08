"""
FastAPI main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.database import init_db
from .services.transcription_singleton import initialize_transcription_service, cleanup_transcription_service
from .api import upload, transcription, audio, export, ai_corrections, ai_analysis, llm_logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Initialize database with complete schema
    init_db()
    
    # Clean up any orphaned transcriptions from previous server crashes/restarts
    from .core.database import SessionLocal
    from .models.audio_file import AudioFile, TranscriptionStatus
    
    db = SessionLocal()
    try:
        # Reset any PROCESSING transcriptions to PENDING
        # Because if we're starting up, any previous processes are dead
        orphaned_files = db.query(AudioFile).filter(
            AudioFile.transcription_status == TranscriptionStatus.PROCESSING
        ).all()
        
        for file in orphaned_files:
            print(f"🧹 Cleaning up orphaned transcription for file {file.id}")
            file.transcription_status = TranscriptionStatus.PENDING
            file.transcription_progress = 0.0
            file.error_message = "Transcription was interrupted by server restart"
            file.transcription_started_at = None
            
        if orphaned_files:
            db.commit()
            print(f"🧹 Cleaned up {len(orphaned_files)} orphaned transcription(s)")
        else:
            print("✅ No orphaned transcriptions found")
            
    finally:
        db.close()
    
    # Initialize global transcription service (loads model once)
    initialize_transcription_service()
    
    yield
    # Shutdown: Clean up resources
    cleanup_transcription_service()


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
            # Use a short timeout to avoid blocking during heavy operations
            conn = sqlite3.connect(db_path, timeout=5.0)
            conn.execute("SELECT 1")
            conn.close()
            components["database"] = {"status": "up", "message": f"SQLite database accessible"}
        else:
            components["database"] = {"status": "down", "message": "Database file not found"}
    except Exception as e:
        # During heavy transcription, database might be busy - this is normal
        if "database is locked" in str(e).lower() or "busy" in str(e).lower():
            components["database"] = {"status": "busy", "message": "Database busy (transcription in progress)"}
        else:
            components["database"] = {"status": "down", "message": str(e)}

    # Check Whisper model
    try:
        from .services.transcription_singleton import is_transcription_service_ready, get_transcription_service, get_model_download_progress
        if is_transcription_service_ready():
            service = get_transcription_service()
            components["whisper"] = {
                "status": "up", 
                "message": f"Whisper model '{service.model_size}' loaded and ready"
            }
        else:
            # Try to get download progress
            download_info = get_model_download_progress()
            if download_info:
                components["whisper"] = {
                    "status": "downloading", 
                    "message": f"Downloading Whisper model: {download_info['progress']}% ({download_info['downloaded']}/{download_info['total']})",
                    "progress": download_info['progress'],
                    "downloaded": download_info['downloaded'],
                    "total": download_info['total'],
                    "speed": download_info.get('speed', 'unknown')
                }
            else:
                components["whisper"] = {
                    "status": "loading", 
                    "message": f"Whisper model loading... (this may take several minutes)"
                }
    except Exception as e:
        components["whisper"] = {"status": "down", "message": f"Whisper error: {str(e)}"}

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
        for k in ["api", "storage"]  # Remove database from critical for busy state
    )
    
    # Database is critical only if truly down, not just busy
    database_critical_down = components["database"]["status"] == "down"
    
    # Check if Whisper is still loading
    whisper_loading = components["whisper"]["status"] == "loading"
    
    if critical_down or database_critical_down:
        overall_status = "unhealthy"
    elif whisper_loading:
        overall_status = "starting"  # Still initializing
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "version": "0.1.0",
        "components": components,
        "critical": ["api", "database", "whisper", "storage"],
        "optional": ["ollama", "redis"]
    }
