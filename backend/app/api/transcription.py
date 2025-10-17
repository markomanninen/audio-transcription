"""
Transcription API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import logging
import json
from datetime import datetime

from ..core.database import get_db
from ..services.speaker_service import SpeakerService
from ..services.transcription_singleton import (
    add_pending_transcription,
    get_transcription_service,
    has_pending_transcriptions,
    initialize_transcription_service,
    is_initialization_in_progress,
    is_transcription_service_ready,
)
from ..services.transcription_service import TranscriptionService
from ..models.segment import Segment
from ..models.speaker import Speaker
from ..models.audio_file import AudioFile, TranscriptionStatus


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/transcription", tags=["transcription"])


class TranscriptionStatusResponse(BaseModel):
    """Response model for transcription status."""
    file_id: int
    filename: str
    original_filename: str
    status: str
    progress: float
    error_message: str | None
    processing_stage: str | None
    segment_count: int
    duration: float | None
    transcription_started_at: str | None
    transcription_completed_at: str | None
    created_at: str | None
    updated_at: str | None
    transcription_metadata: str | None

    class Config:
        from_attributes = True


class SegmentResponse(BaseModel):
    """Response model for a transcription segment."""
    id: int
    start_time: float
    end_time: float
    original_text: str
    edited_text: str | None
    speaker_id: int | None
    sequence: int

    class Config:
        from_attributes = True


class SpeakerResponse(BaseModel):
    """Response model for a speaker."""
    id: int
    speaker_id: str
    display_name: str
    color: str

    class Config:
        from_attributes = True


class StartTranscriptionRequest(BaseModel):
    """Request to start transcription."""
    include_diarization: bool = True
    model_size: str = "tiny"  # tiny, base, small, medium, large
    language: str | None = None  # None for auto-detection

    model_config = {
        "protected_namespaces": ()
    }


class SegmentUpdateRequest(BaseModel):
    """Request to update a segment's edited text."""
    edited_text: str


def transcribe_task(
    audio_file_id: int,
    include_diarization: bool = True,
    model_size: str | None = None,
    language: str | None = None,
    force_restart: bool = False,
) -> None:
    """Background task for transcription (supports queued execution)."""
    from ..core.database import SessionLocal

    logger.info(
        "🎬 Background transcription task started for file %s (model=%s, language=%s, force_restart=%s)",
        audio_file_id,
        model_size or "default",
        language or "auto",
        force_restart,
    )

    db = SessionLocal()
    try:
        transcription_service = get_transcription_service()

        if force_restart:
            transcription_service.resume_or_transcribe_audio(audio_file_id, db, force_restart=True)
        else:
            transcription_service.transcribe_audio(audio_file_id, db)

        if include_diarization:
            speaker_service = SpeakerService()
            speaker_service.perform_diarization(audio_file_id, db)

    except Exception:
        logger.exception("Background transcription task failed for file %s", audio_file_id)
        raise
    finally:
        db.close()


@router.post("/{audio_file_id}/action")
async def transcription_action(
    audio_file_id: int,
    action: str = Query(default="auto", description="Action: auto, resume, restart, continue"),
    db: Session = Depends(get_db)
):
    """
    Intelligent transcription action endpoint.
    
    Actions:
    - auto: Automatically decide best action based on current state
    - resume: Resume existing transcription if possible
    - restart: Force restart by clearing segments and starting fresh
    - continue: Continue current transcription
    """
    try:
        # Check if transcription service is ready, initialize if not
        if not is_transcription_service_ready():
            logger.info("Transcription service not ready, starting background initialization...")
            # Start initialization in background to avoid blocking the API
            import threading
            init_thread = threading.Thread(target=initialize_transcription_service, daemon=True)
            init_thread.start()
            # Immediately return 503 to tell client to try again later
            raise HTTPException(
                status_code=503, 
                detail="Transcription service is initializing in the background. Please wait and try again in 30-60 seconds."
            )
        
        transcription_service = get_transcription_service()
        result = transcription_service.smart_transcription_action(audio_file_id, db, action)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error in transcription action: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# OLD STATUS ENDPOINT REMOVED - Using new TranscriptionStatusResponse format below
# @router.get("/{audio_file_id}/status")
# async def get_transcription_status(audio_file_id: int, db: Session = Depends(get_db)):
#     """Get detailed transcription status for restart/resume decisions."""
#     try:
#         transcription_service = TranscriptionService()
#         status = transcription_service.get_transcription_status(audio_file_id, db)
#         
#         if "error" in status:
#             raise HTTPException(status_code=404, detail=status["error"])
#         
#         return status
#     except Exception as e:
#         logger.error(f"Error getting transcription status: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

@router.post("/{audio_file_id}/start")
async def start_transcription_with_settings(
    audio_file_id: int, 
    request: StartTranscriptionRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Session = Depends(get_db)
):
    """Start transcription with specific settings."""
    try:
        # Log the start of transcription request
        print(f"[TRANSCRIPTION] Starting transcription for file {audio_file_id} with model={request.model_size}")
        logger.info(f"Starting transcription for file {audio_file_id} with model={request.model_size}")
        # Check if transcription service is ready
        service_ready = is_transcription_service_ready()
        print(f"[TRANSCRIPTION] Service ready status: {service_ready}")
        logger.info(f"Transcription service ready status: {service_ready}")
        
        if not service_ready:
            add_pending_transcription(
                audio_file_id,
                include_diarization=request.include_diarization,
                model_size=request.model_size,
                language=request.language,
                force_restart=False,
            )
            # Trigger initialization when first transcription is requested
            print(f"[INITIALIZATION] About to initialize Whisper for file {audio_file_id}")
            logger.info(f"Whisper not ready - file {audio_file_id} queued and starting initialization...")
            try:
                print(f"[INITIALIZATION] Calling initialize_transcription_service()...")
                initialize_transcription_service()
                print(f"[INITIALIZATION] ✅ Whisper initialization completed successfully")
                logger.info("✅ Whisper initialization completed successfully")
            except Exception as e:
                print(f"[INITIALIZATION] ❌ Whisper initialization failed: {e}")
                logger.error(f"❌ Whisper initialization failed: {e}")
                # Still queue the transcription - it might work later

        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise HTTPException(status_code=404, detail="File not found")

        audio_file.language = request.language
        metadata = {
            "model_size": request.model_size,
            "language": request.language,
            "include_diarization": request.include_diarization,
            "start_timestamp": datetime.utcnow().isoformat(),
        }
        audio_file.transcription_metadata = json.dumps(metadata)

        if service_ready:
            audio_file.transcription_status = TranscriptionStatus.PROCESSING
            audio_file.transcription_progress = 0.0
            audio_file.error_message = None
            audio_file.transcription_started_at = datetime.utcnow()
            audio_file.transcription_completed_at = None
        else:
            audio_file.transcription_status = TranscriptionStatus.PENDING
            audio_file.transcription_progress = 0.0
            audio_file.error_message = "Whisper model loading. Transcription will begin automatically once model is ready."
            audio_file.transcription_started_at = None
            audio_file.transcription_completed_at = None

        db.commit()

        if not service_ready:
            response.status_code = status.HTTP_202_ACCEPTED
            return {
                "status": "queued",
                "message": "Whisper model loading. Transcription will begin automatically once model is ready.",
                "file_id": audio_file_id,
                "include_diarization": request.include_diarization,
                "settings": {
                    "model_size": request.model_size,
                    "language": request.language,
                    "include_diarization": request.include_diarization,
                },
            }

        # CRITICAL FIX: Use threading instead of BackgroundTasks
        # BackgroundTasks silently fail in Docker/production environments
        import threading

        def run_transcription():
            """Run transcription in background thread."""
            transcribe_task(
                audio_file_id=audio_file_id,
                include_diarization=request.include_diarization,
                model_size=request.model_size,
                language=request.language,
                force_restart=False,
            )

        transcription_thread = threading.Thread(target=run_transcription, daemon=True)
        transcription_thread.start()
        logger.info(f"✅ Started transcription thread for file {audio_file_id}")

        return {
            "status": "started",
            "message": "Transcription started successfully",
            "file_id": audio_file_id,
            "include_diarization": request.include_diarization,
            "settings": {
                "model_size": request.model_size,
                "language": request.language,
                "include_diarization": request.include_diarization,
            },
        }
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error starting transcription with settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{audio_file_id}/force-restart")
async def force_restart_transcription(
    audio_file_id: int, 
    request: StartTranscriptionRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Session = Depends(get_db)
):
    """Force restart a transcription with new settings - SAME AS START."""
    try:
        logger.info(f"Force restarting transcription for file {audio_file_id} with model={request.model_size}")
        # Check if transcription service is ready
        service_ready = is_transcription_service_ready()
        if not service_ready:
            add_pending_transcription(
                audio_file_id,
                include_diarization=request.include_diarization,
                model_size=request.model_size,
                language=request.language,
                force_restart=True,
            )

            # Don't try to initialize here - just queue the request
            # Initialization will happen via background process or manual trigger
            logger.info(f"Whisper not ready - file {audio_file_id} queued for processing when ready")

        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise HTTPException(status_code=404, detail="File not found")

        audio_file.language = request.language
        metadata = {
            "model_size": request.model_size,
            "language": request.language,
            "include_diarization": request.include_diarization,
            "start_timestamp": datetime.utcnow().isoformat(),
        }
        audio_file.transcription_metadata = json.dumps(metadata)

        from ..models.speaker import Speaker

        speaker_ids = [
            sid
            for (sid,) in db.query(Segment.speaker_id)
            .filter(Segment.audio_file_id == audio_file_id, Segment.speaker_id.isnot(None))
            .distinct()
        ]

        existing_segments = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).count()
        if existing_segments > 0:
            logger.info(f"Force-restart: Deleting {existing_segments} existing segments for file {audio_file_id}")
            db.query(Segment).filter(Segment.audio_file_id == audio_file_id).delete(synchronize_session=False)
            db.commit()

        if speaker_ids:
            logger.info(f"Force-restart: Deleting {len(speaker_ids)} speakers associated with file {audio_file_id}")
            db.query(Speaker).filter(Speaker.id.in_(speaker_ids)).delete(synchronize_session=False)
            db.commit()

        if service_ready:
            audio_file.transcription_status = TranscriptionStatus.PROCESSING
            audio_file.error_message = None
            audio_file.transcription_started_at = datetime.utcnow()
            audio_file.transcription_progress = 0.0
        else:
            audio_file.transcription_status = TranscriptionStatus.PENDING
            audio_file.error_message = "Whisper model loading. Transcription will restart automatically once model is ready."
            audio_file.transcription_started_at = None
            audio_file.transcription_progress = 0.0

        audio_file.transcription_completed_at = None
        db.commit()

        if not service_ready:
            response.status_code = status.HTTP_202_ACCEPTED
            return {
                "status": "queued",
                "message": "Whisper model loading. Transcription will restart automatically once model is ready.",
                "file_id": audio_file_id,
                "include_diarization": request.include_diarization,
                "settings": {
                    "model_size": request.model_size,
                    "language": request.language,
                    "include_diarization": request.include_diarization,
                },
            }

        # CRITICAL FIX: Use threading instead of BackgroundTasks
        # BackgroundTasks silently fail in Docker/production environments
        import threading

        def run_transcription():
            """Run transcription in background thread."""
            transcribe_task(
                audio_file_id=audio_file_id,
                include_diarization=request.include_diarization,
                model_size=request.model_size,
                language=request.language,
                force_restart=True,
            )

        transcription_thread = threading.Thread(target=run_transcription, daemon=True)
        transcription_thread.start()
        logger.info(f"✅ Started force-restart transcription thread for file {audio_file_id}")

        return {
            "status": "started",
            "message": "Transcription restarted successfully",
            "file_id": audio_file_id,
            "include_diarization": request.include_diarization,
            "settings": {
                "model_size": request.model_size,
                "language": request.language,
                "include_diarization": request.include_diarization,
            },
        }
    except HTTPException:
        # Re-raise HTTPException (like 202, 404) without converting to 500
        raise
    except Exception as e:
        logger.error(f"Error force restarting transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{audio_file_id}/resume")
async def resume_transcription(audio_file_id: int, db: Session = Depends(get_db)):
    """Resume existing transcription if segments exist."""
    try:
        # Check if transcription service is ready
        if not is_transcription_service_ready():
            raise HTTPException(
                status_code=503, 
                detail="Transcription service is not ready yet. Whisper model is still downloading. Please wait and try again."
            )
        
        transcription_service = get_transcription_service()
        result = transcription_service.smart_transcription_action(audio_file_id, db, "resume")
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error resuming transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{audio_file_id}/transcribe")
async def start_transcription(
    audio_file_id: int,
    request: StartTranscriptionRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    db: Session = Depends(get_db)
) -> dict:
    """
    Start transcription of an audio file in the background.

    Args:
        audio_file_id: ID of audio file to transcribe
        request: Transcription options
        background_tasks: FastAPI background tasks
        response: FastAPI response object
        db: Database session

    Returns:
        Acknowledgment message
    """
    service_ready = is_transcription_service_ready()
    if not service_ready:
        try:
            add_pending_transcription(
                audio_file_id,
                include_diarization=request.include_diarization,
                model_size=request.model_size,
                language=request.language,
                force_restart=False,
            )

            # Start initialization in a truly detached background thread
            import threading

            def init_whisper():
                try:
                    print(f"📦 Starting Whisper initialization in background for file {audio_file_id}...")
                    initialize_transcription_service()
                    print(f"✅ Whisper initialization complete for file {audio_file_id}")
                except Exception as e:
                    print(f"❌ Failed to initialize Whisper for file {audio_file_id}: {e}")

            # Start in a daemon thread that won't block the response
            init_thread = threading.Thread(target=init_whisper, daemon=True)
            init_thread.start()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start Whisper initialization: {str(e)}",
            )

    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="File not found")

    audio_file.language = request.language
    metadata = {
        "model_size": request.model_size,
        "language": request.language,
        "include_diarization": request.include_diarization,
        "start_timestamp": datetime.utcnow().isoformat(),
    }
    audio_file.transcription_metadata = json.dumps(metadata)

    if service_ready:
        audio_file.transcription_status = TranscriptionStatus.PROCESSING
        audio_file.error_message = None
        audio_file.transcription_started_at = datetime.utcnow()
        audio_file.transcription_progress = 0.0
    else:
        audio_file.transcription_status = TranscriptionStatus.PENDING
        audio_file.error_message = "Whisper model loading. Transcription will begin automatically once model is ready."
        audio_file.transcription_started_at = None
        audio_file.transcription_progress = 0.0

    audio_file.transcription_completed_at = None
    db.commit()

    if not service_ready:
        response.status_code = status.HTTP_202_ACCEPTED
        return {
            "message": "Whisper model loading. Transcription will begin automatically once model is ready.",
            "file_id": audio_file_id,
            "include_diarization": request.include_diarization,
            "status": "queued",
        }

    # CRITICAL FIX: Use threading instead of BackgroundTasks
    # BackgroundTasks silently fail in Docker/production environments
    import threading

    def run_transcription():
        """Run transcription in background thread."""
        transcribe_task(
            audio_file_id=audio_file_id,
            include_diarization=request.include_diarization,
            model_size=request.model_size,
            language=request.language,
            force_restart=False,
        )

    transcription_thread = threading.Thread(target=run_transcription, daemon=True)
    transcription_thread.start()
    logger.info(f"✅ Started transcription thread for file {audio_file_id} (legacy endpoint)")

    return {
        "message": "Transcription started",
        "file_id": audio_file_id,
        "include_diarization": request.include_diarization,
    }


@router.get("/{file_id}/status", response_model=TranscriptionStatusResponse)
async def get_transcription_status(
    file_id: int,
    db: Session = Depends(get_db)
) -> TranscriptionStatusResponse:
    """
    Get transcription status for an audio file.

    Args:
        file_id: ID of audio file
        db: Database session

    Returns:
        Transcription status information
    """
    # First, get the audio file to ensure it exists
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    # Check if transcription service is ready
    if not is_transcription_service_ready():
        # CRITICAL FIX: If file is already completed, return actual data from database
        # Don't show "model loading" for files that are already done!
        if audio_file.transcription_status == TranscriptionStatus.COMPLETED:
            segment_count = db.query(Segment).filter(Segment.audio_file_id == file_id).count()
            return TranscriptionStatusResponse(
                file_id=audio_file.id,
                filename=audio_file.filename,
                original_filename=audio_file.original_filename,
                status=audio_file.transcription_status.value.lower(),
                progress=audio_file.transcription_progress or 1.0,
                error_message=None,
                processing_stage=None,
                segment_count=segment_count,
                duration=audio_file.duration,
                transcription_started_at=audio_file.transcription_started_at.isoformat() if audio_file.transcription_started_at else None,
                transcription_completed_at=audio_file.transcription_completed_at.isoformat() if audio_file.transcription_completed_at else None,
                created_at=audio_file.created_at.isoformat() if audio_file.created_at else None,
                updated_at=audio_file.updated_at.isoformat() if audio_file.updated_at else None,
                transcription_metadata=audio_file.transcription_metadata
            )

        # For pending/processing files, show model loading status
        error_message = "AI transcription model is still loading. Please wait..."
        processing_stage = "model_loading"

        if has_pending_transcriptions():
            error_message = "Transcription queued. Model is loading and transcription will start automatically."
            processing_stage = "queued"

        return TranscriptionStatusResponse(
            file_id=audio_file.id,
            filename=audio_file.filename,
            original_filename=audio_file.original_filename,
            status="pending",
            progress=0.0,
            error_message=error_message,
            processing_stage=processing_stage,
            segment_count=0,
            duration=audio_file.duration,
            transcription_started_at=None,
            transcription_completed_at=None,
            created_at=audio_file.created_at.isoformat() if audio_file.created_at else None,
            updated_at=audio_file.updated_at.isoformat() if audio_file.updated_at else None,
            transcription_metadata=None
        )
    
    try:
        # Add timeout protection for the transcription service call
        import asyncio
        import concurrent.futures
        
        def get_info_sync():
            transcription_service = get_transcription_service()
            return transcription_service.get_transcription_info(file_id, db)
        
        # Run with timeout to prevent hanging
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = loop.run_in_executor(executor, get_info_sync)
            try:
                info = await asyncio.wait_for(future, timeout=5.0)  # 5 second timeout
                return TranscriptionStatusResponse(**info)
            except asyncio.TimeoutError:
                logger.warning(f"Timeout getting transcription info for file {file_id}")
                # Return fallback status based on database
                segment_count = db.query(Segment).filter(Segment.audio_file_id == file_id).count()
                return TranscriptionStatusResponse(
                    file_id=audio_file.id,
                    filename=audio_file.filename,
                    original_filename=audio_file.original_filename,
                    status=audio_file.transcription_status.value.lower() if audio_file.transcription_status else "unknown",
                    progress=audio_file.transcription_progress or 0.0,
                    error_message="Service temporarily unavailable, retrying...",
                    processing_stage="service_timeout",
                    segment_count=segment_count,
                    duration=audio_file.duration,
                    transcription_started_at=audio_file.transcription_started_at.isoformat() if audio_file.transcription_started_at else None,
                    transcription_completed_at=audio_file.transcription_completed_at.isoformat() if audio_file.transcription_completed_at else None,
                    created_at=audio_file.created_at.isoformat() if audio_file.created_at else None,
                    updated_at=audio_file.updated_at.isoformat() if audio_file.updated_at else None,
                    transcription_metadata=audio_file.transcription_metadata
                )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting transcription status for file {file_id}: {e}")
        # Return fallback status based on database
        segment_count = db.query(Segment).filter(Segment.audio_file_id == file_id).count()
        return TranscriptionStatusResponse(
            file_id=audio_file.id,
            filename=audio_file.filename,
            original_filename=audio_file.original_filename,
            status=audio_file.transcription_status.value.lower() if audio_file.transcription_status else "error",
            progress=audio_file.transcription_progress or 0.0,
            error_message=f"Service error: {str(e)}",
            processing_stage="error",
            segment_count=segment_count,
            duration=audio_file.duration,
            transcription_started_at=audio_file.transcription_started_at.isoformat() if audio_file.transcription_started_at else None,
            transcription_completed_at=audio_file.transcription_completed_at.isoformat() if audio_file.transcription_completed_at else None,
            created_at=audio_file.created_at.isoformat() if audio_file.created_at else None,
            updated_at=audio_file.updated_at.isoformat() if audio_file.updated_at else None,
            transcription_metadata=audio_file.transcription_metadata
        )


@router.post("/{file_id}/cancel")
async def cancel_transcription(
    file_id: int,
    db: Session = Depends(get_db)
) -> dict:
    """
    Cancel/reset a stuck or ongoing transcription.

    Args:
        file_id: ID of audio file
        db: Database session

    Returns:
        Success message
    """
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Reset transcription status
    audio_file.transcription_status = TranscriptionStatus.PENDING
    audio_file.transcription_progress = 0.0
    audio_file.error_message = None
    audio_file.transcription_started_at = None
    audio_file.transcription_completed_at = None
    audio_file.transcription_duration_seconds = None
    audio_file.processing_stats = None
    
    db.commit()

    return {"message": f"Transcription for file {file_id} has been reset to pending state"}


@router.get("/{file_id}/segments", response_model=List[SegmentResponse])
async def get_segments(
    file_id: int,
    db: Session = Depends(get_db)
) -> List[SegmentResponse]:
    """
    Get all transcription segments for an audio file.

    Args:
        file_id: ID of audio file
        db: Database session

    Returns:
        List of segments ordered by sequence
    """
    segments = (
        db.query(Segment)
        .filter(Segment.audio_file_id == file_id)
        .order_by(Segment.sequence)
        .all()
    )

    return [
        SegmentResponse(
            id=s.id,
            start_time=s.start_time,
            end_time=s.end_time,
            original_text=s.original_text,
            edited_text=s.edited_text,
            speaker_id=s.speaker_id,
            sequence=s.sequence
        )
        for s in segments
    ]


@router.get("/{file_id}/speakers", response_model=List[SpeakerResponse])
async def get_speakers(
    file_id: int,
    db: Session = Depends(get_db)
) -> List[SpeakerResponse]:
    """
    Get all speakers identified in the audio file.

    Args:
        file_id: ID of audio file
        db: Database session

    Returns:
        List of speakers for this specific audio file only
    """
    from ..models.audio_file import AudioFile

    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Get speakers that are actually used in segments for THIS specific file
    speakers = (
        db.query(Speaker)
        .join(Segment, Speaker.id == Segment.speaker_id)
        .filter(Segment.audio_file_id == file_id)
        .distinct()
        .all()
    )

    return [
        SpeakerResponse(
            id=s.id,
            speaker_id=s.speaker_id,
            display_name=s.display_name,
            color=s.color
        )
        for s in speakers
    ]


@router.patch("/segment/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    segment_id: int,
    request: SegmentUpdateRequest,
    db: Session = Depends(get_db)
) -> SegmentResponse:
    """
    Update a segment's edited text.

    Args:
        segment_id: ID of segment to update
        request: Updated text
        db: Database session

    Returns:
        Updated segment
    """
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segment {segment_id} not found"
        )

    segment.edited_text = request.edited_text
    
    # Update the parent audio file's updated_at timestamp to track latest activity
    audio_file = db.query(AudioFile).filter(AudioFile.id == segment.audio_file_id).first()
    if audio_file:
        from datetime import datetime
        audio_file.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(segment)

    return SegmentResponse(
        id=segment.id,
        start_time=segment.start_time,
        end_time=segment.end_time,
        original_text=segment.original_text,
        edited_text=segment.edited_text,
        speaker_id=segment.speaker_id,
        sequence=segment.sequence
    )


@router.put("/speaker/{speaker_id}", response_model=SpeakerResponse)
async def update_speaker(
    speaker_id: int,
    request: dict,
    db: Session = Depends(get_db)
) -> SpeakerResponse:
    """
    Update a speaker's display name.

    Args:
        speaker_id: ID of speaker to update
        request: New display name
        db: Database session

    Returns:
        Updated speaker
    """
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Speaker {speaker_id} not found"
        )

    if "display_name" in request:
        speaker.display_name = request["display_name"]

    db.commit()
    db.refresh(speaker)

    return SpeakerResponse(
        id=speaker.id,
        speaker_id=speaker.speaker_id,
        display_name=speaker.display_name,
        color=speaker.color
    )


@router.post("/{file_id}/continue")
async def continue_transcription(
    file_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> dict:
    """
    🚀 SMART CONTINUE: Resume existing transcription or skip if already complete.
    NO WASTED PROCESSING! Checks for existing segments first.

    Args:
        file_id: ID of audio file
        background_tasks: Background task handler
        db: Database session

    Returns:
        Action taken message
    """
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Check if transcription service is ready
    if not is_transcription_service_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transcription service is not ready. Please check the audio service configuration."
        )

    transcription_service = get_transcription_service()
    
    # Check if we can resume
    can_resume = transcription_service.can_resume_transcription(file_id, db)
    
    if can_resume:
        # Resume/complete existing transcription
        existing_segments = db.query(Segment).filter(Segment.audio_file_id == file_id).count()
        
        def complete_existing():
            segments = transcription_service.resume_or_transcribe_audio(file_id, db, force_restart=False)
            print(f"✅ RESUMED: Found and completed {len(segments)} existing segments")
        
        background_tasks.add_task(complete_existing)
        return {
            "message": f"🚀 SMART RESUME: Found {existing_segments} existing segments - completing transcription without re-processing",
            "action": "resume",
            "existing_segments": existing_segments
        }
    else:
        # Start fresh transcription
        audio_file.transcription_status = TranscriptionStatus.PENDING
        db.commit()
        
        def start_fresh():
            segments = transcription_service.resume_or_transcribe_audio(file_id, db, force_restart=False)
            print(f"✅ STARTED: Created {len(segments)} new segments")
        
        background_tasks.add_task(start_fresh)
        return {
            "message": "🆕 FRESH START: No existing segments found - starting new transcription",
            "action": "start_new",
            "existing_segments": 0
        }


@router.post("/{file_id}/retranscribe")
async def retranscribe_audio(
    file_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> dict:
    """
    🔄 FORCE RETRANSCRIBE: Delete existing segments and start completely fresh.
    Use this when you want to redo the transcription with different settings.

    Args:
        file_id: ID of audio file
        background_tasks: Background task handler
        db: Database session

    Returns:
        Action confirmation message
    """
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Check if transcription service is ready
    if not is_transcription_service_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transcription service is not ready. Please check the audio service configuration."
        )

    transcription_service = get_transcription_service()
    
    # Count existing segments before deletion
    existing_segments = db.query(Segment).filter(Segment.audio_file_id == file_id).count()
    
    # Reset status first
    audio_file.transcription_status = TranscriptionStatus.PENDING
    audio_file.transcription_progress = 0.0
    audio_file.error_message = None
    db.commit()
    
    def force_retranscribe():
        segments = transcription_service.resume_or_transcribe_audio(file_id, db, force_restart=True)
        print(f"🔄 RETRANSCRIBED: Deleted {existing_segments} old segments, created {len(segments)} new ones")
    
    background_tasks.add_task(force_retranscribe)
    
    return {
        "message": f"🔄 FORCE RETRANSCRIBE: Deleting {existing_segments} existing segments and starting fresh transcription",
        "action": "force_restart",
        "deleted_segments": existing_segments
    }
