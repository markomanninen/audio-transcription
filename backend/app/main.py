"""
FastAPI main application entry point.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import init_db, engine, SessionLocal
from .services.transcription_singleton import initialize_transcription_service, cleanup_transcription_service
from .api import upload, transcription, audio, export, ai_corrections, ai_analysis, llm_logs
from .core.config import settings
from .services.status_normalizer import normalize_transcription_statuses
from .models.audio_file import AudioFile, TranscriptionStatus


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    print("[STARTUP] Starting application lifespan...")
    
    # Startup: Initialize database with complete schema
    print("[STARTUP] Initializing database...")
    try:
        init_db()
        print("[STARTUP] Database initialized")
    except Exception as e:
        print(f"[STARTUP] ❌ Database initialization failed: {e}")
        raise

    # Normalize legacy lowercase transcription statuses so they align with the current enum.
    print("[STARTUP] Normalizing transcription statuses...")
    try:
        results = normalize_transcription_statuses(engine)
        normalized = results.get("normalized", 0)
        invalid_reset = results.get("invalid_reset", 0)
        print(f"[STARTUP] 🛠️ Normalized {normalized} transcription status value(s); reset {invalid_reset} invalid record(s).")
    except Exception as exc:
        print(f"[STARTUP] ⚠️ Failed to normalize transcription statuses: {exc}")

    # Optionally seed deterministic data for local end-to-end tests.
    if os.getenv("SEED_E2E_DATA", "").lower() in {"1", "true", "yes", "on"}:
        try:
            from .test_data.seed_e2e import seed_e2e_data

            seed_e2e_data()
        except Exception as exc:
            print(f"⚠️ Failed to seed E2E data: {exc}")
    
    # Clean up any orphaned transcriptions from previous server crashes/restarts
    print("[STARTUP] Cleaning up orphaned transcriptions...")
    db = SessionLocal()
    try:
        # Reset any PROCESSING transcriptions to PENDING
        # Because if we're starting up, any previous processes are dead
        print("[STARTUP] Querying for orphaned files...")
        orphaned_files = db.query(AudioFile).filter(
            AudioFile.transcription_status == TranscriptionStatus.PROCESSING
        ).all()
        print(f"[STARTUP] Found {len(orphaned_files)} orphaned files")

        for file in orphaned_files:
            print(f"🧹 Cleaning up orphaned transcription for file {file.id}")
            file.transcription_status = TranscriptionStatus.PENDING
            file.transcription_progress = 0.0
            file.error_message = "Transcription was interrupted by server restart"
            file.transcription_started_at = None

        if orphaned_files:
            print("[STARTUP] Committing orphaned file changes...")
            db.commit()
            print(f"🧹 Cleaned up {len(orphaned_files)} orphaned transcription(s)")
        else:
            print("✅ No orphaned transcriptions found")
            
    finally:
        db.close()
    
    # DON'T start transcription service initialization automatically during startup
    # Let it initialize only when first transcription is requested to avoid startup issues
    print("🚀 FastAPI starting - Whisper will initialize when first transcription is requested")
    
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
cors_origins = settings.cors_origins_list
# Ensure http(s)://localhost is always allowed when serving through nginx on port 80
fallback_origins = ["http://localhost", "http://127.0.0.1", "https://localhost"]
allow_origins = list(dict.fromkeys([*cors_origins, *fallback_origins]))
# Permit any localhost/127.0.0.1 port during development and automated tests.
local_origin_regex = r"http://(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=local_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

# Removed request logging middleware that might be causing issues

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


@app.get("/health-simple")
async def health_simple():
    """Ultra-simple health check - just returns 200 OK."""
    import time
    print(f"[HEALTH-SIMPLE] Health check requested at {time.time()}")
    return {"status": "ok", "timestamp": time.time()}


@app.get("/health")
async def health():
    """Non-blocking health check with essential transcription status."""
    import time
    from pathlib import Path
    
    components = {
        "api": {"status": "up", "message": "FastAPI running"},
        "database": {"status": "up", "message": "Available"},
        "whisper": {"status": "idle", "message": "Will load on demand"},
        "ollama": {"status": "unknown", "message": "Not checked (optional)"},
        "redis": {"status": "unknown", "message": "Not checked (optional)"},
        "storage": {"status": "up", "message": "Available"},
    }

    # Check Redis (optional, fast check with timeout)
    try:
        import redis
        redis_client = redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=1,
            socket_timeout=1,
            decode_responses=False,
            health_check_interval=0  # Disable background health checks
        )
        redis_client.ping()
        redis_client.close()
        components["redis"] = {"status": "up", "message": "Connected"}
    except ImportError:
        components["redis"] = {"status": "down", "message": "Redis library not installed"}
    except redis.exceptions.ConnectionError:
        components["redis"] = {"status": "down", "message": "Connection refused"}
    except redis.exceptions.TimeoutError:
        components["redis"] = {"status": "down", "message": "Connection timeout"}
    except Exception as e:
        error_msg = str(e)[:50] if str(e) else "Connection failed"
        components["redis"] = {"status": "down", "message": f"Not available: {error_msg}"}

    # Check Ollama (optional, fast check with timeout)
    try:
        import requests
        ollama_url = settings.OLLAMA_BASE_URL or "http://localhost:11434"
        response = requests.get(f"{ollama_url}/api/tags", timeout=1.0)
        if response.status_code == 200:
            models = response.json().get('models', [])
            model_count = len(models)
            components["ollama"] = {"status": "up", "message": f"Connected ({model_count} models)"}
        else:
            components["ollama"] = {"status": "down", "message": f"HTTP {response.status_code}"}
    except ImportError:
        components["ollama"] = {"status": "down", "message": "Requests library not installed"}
    except requests.exceptions.Timeout:
        components["ollama"] = {"status": "down", "message": "Connection timeout"}
    except requests.exceptions.ConnectionError:
        components["ollama"] = {"status": "down", "message": "Connection refused"}
    except Exception as e:
        error_msg = str(e)[:50] if str(e) else "Connection failed"
        components["ollama"] = {"status": "down", "message": f"Not available: {error_msg}"}
    
    # Check storage (fast, non-blocking)
    try:
        storage_path = Path(settings.AUDIO_STORAGE_PATH)
        if storage_path.exists():
            components["storage"] = {"status": "up", "message": f"Storage accessible"}
        else:
            components["storage"] = {"status": "down", "message": "Storage path missing"}
    except Exception as e:
        components["storage"] = {"status": "down", "message": str(e)}
    
    # Check Whisper status (non-blocking, no model loading)
    try:
        from .services.transcription_singleton import (
            is_transcription_service_ready, 
            is_initialization_in_progress,
            get_model_download_progress,
            get_target_model_size
        )
        
        if is_transcription_service_ready():
            # Service is ready - get model size without blocking
            try:
                from .services.transcription_singleton import get_transcription_service
                service = get_transcription_service()
                components["whisper"] = {
                    "status": "up", 
                    "message": f"Whisper model '{service.model_size}' ready",
                    "model_size": service.model_size
                }
            except:
                # Fallback if getting service fails
                components["whisper"] = {
                    "status": "up", 
                    "message": "Whisper service ready",
                    "model_size": get_target_model_size()
                }
        elif is_initialization_in_progress():
            # Check for download progress (non-blocking)
            download_info = get_model_download_progress()
            model_size = get_target_model_size()
            
            if download_info:
                if download_info['progress'] >= 100:
                    components["whisper"] = {
                        "status": "loading",
                        "message": f"Loading {model_size} model into memory...",
                        "model_size": model_size
                    }
                else:
                    components["whisper"] = {
                        "status": "downloading",
                        "message": f"Downloading {model_size}: {download_info['progress']}%",
                        "progress": download_info['progress'],
                        "downloaded": download_info['downloaded'],
                        "total": download_info['total'],
                        "speed": download_info.get('speed', ''),
                        "model_size": model_size
                    }
            else:
                components["whisper"] = {
                    "status": "loading",
                    "message": f"Initializing {model_size} model...",
                    "model_size": model_size
                }
        else:
            # Not initialized yet
            model_size = get_target_model_size()
            components["whisper"] = {
                "status": "idle",
                "message": f"Will load {model_size} model on demand",
                "model_size": model_size
            }
            
    except Exception as e:
        components["whisper"] = {"status": "unknown", "message": f"Status check failed: {str(e)}"}
    
    # Check for active transcriptions (quick database check)
    try:
        # Quick check for processing files without blocking
        db = SessionLocal()
        try:
            processing_count = db.query(AudioFile).filter(
                AudioFile.transcription_status == TranscriptionStatus.PROCESSING
            ).count()
            
            if processing_count > 0:
                components["database"] = {"status": "busy", "message": f"Processing {processing_count} transcription(s)"}
                # Update whisper status if processing
                if components["whisper"]["status"] == "up":
                    # Get active transcription info
                    active_file = db.query(AudioFile).filter(
                        AudioFile.transcription_status == TranscriptionStatus.PROCESSING
                    ).first()
                    if active_file:
                        components["whisper"]["status"] = "processing"
                        components["whisper"]["active_transcription"] = {
                            "file_id": active_file.id,
                            "filename": active_file.original_filename,
                            "progress": float(active_file.transcription_progress or 0),
                            "stage": active_file.transcription_stage,
                            "started_at": active_file.transcription_started_at.isoformat() if active_file.transcription_started_at else None
                        }
            else:
                components["database"] = {"status": "up", "message": "Available"}
        finally:
            db.close()
            
    except Exception as e:
        # Don't fail health check on database issues
        components["database"] = {"status": "unknown", "message": "Could not check status"}
    
    # Determine overall status
    critical_down = any(
        components[k]["status"] == "down"
        for k in ["api", "storage"]
    )
    
    whisper_loading = components["whisper"]["status"] in ["downloading", "loading"]
    
    if critical_down:
        overall_status = "unhealthy"
    elif whisper_loading:
        overall_status = "starting"
    else:
        overall_status = "healthy"
    
    return {
        "status": overall_status,
        "version": "0.1.0",
        "components": components,
        "critical": ["api", "database", "whisper", "storage"],
        "optional": ["ollama", "redis"],
        "timestamp": time.time()
    }
