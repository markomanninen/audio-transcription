"""
FastAPI main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.database import init_db
from .api import upload, transcription, audio, export, ai_corrections, ai_analysis


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Initialize database
    init_db()
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
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Vite default port
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


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "audio-transcription-api"}


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "services": {
            "api": "up",
            "database": "up",
            "transcription": "pending",
        }
    }
