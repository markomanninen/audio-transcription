"""
Transcription API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
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
    is_model_cached_on_disk,
)
from ..services.transcription_service import TranscriptionService
from ..services.audio_service import AudioService
from ..models.segment import Segment
from ..models.speaker import Speaker
from ..models.audio_file import AudioFile, TranscriptionStatus


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/transcription", tags=["transcription"])


class TranscriptionStatusResponse(BaseModel):
    """Response model for transcription status."""
    model_config = ConfigDict(from_attributes=True)

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
    parent_file_id: int | None = None
    split_start_seconds: float | None = None
    split_end_seconds: float | None = None
    split_label: str | None = None
    split_total_chunks: int | None = None
    split_origin_filename: str | None = None
    split_depth: int | None = None


class SegmentResponse(BaseModel):
    """Response model for a transcription segment."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    start_time: float
    end_time: float
    original_text: str
    edited_text: str | None
    speaker_id: int | None
    sequence: int
    is_passive: bool


class SegmentListResponse(BaseModel):
    """Response returning a list of segments."""
    segments: List[SegmentResponse]


class SpeakerResponse(BaseModel):
    """Response model for a speaker."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    speaker_id: str
    display_name: str
    color: str


class StartTranscriptionRequest(BaseModel):
    """Request to start transcription."""
    model_config = ConfigDict(protected_namespaces=())

    include_diarization: bool = True
    model_size: str = "tiny"  # tiny, base, small, medium, large
    language: str | None = None  # None for auto-detection


class SegmentUpdateRequest(BaseModel):
    """Request to update a segment's edited text."""
    edited_text: Optional[str] = None
    is_passive: Optional[bool] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None


class SegmentBulkPassiveRequest(BaseModel):
    """Request to bulk update passive state for segments."""
    segment_ids: List[int]
    is_passive: bool = True


class SegmentInsertRequest(BaseModel):
    """Request to insert a new segment relative to an existing one."""
    direction: str = "below"  # "above" or "below"
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    original_text: Optional[str] = None
    speaker_id: Optional[int] = None


class SegmentJoinRequest(BaseModel):
    """Request to merge multiple segments into one."""
    segment_ids: List[int]
    max_gap_seconds: float | None = 1.5


class AudioSplitRequest(BaseModel):
    """Request to split an audio file into smaller chunks."""
    model_config = ConfigDict(protected_namespaces=())

    chunk_duration_seconds: float = 600.0
    overlap_seconds: float = 0.0
    start_transcription: bool = True
    include_diarization: bool = True
    model_size: str | None = None
    language: str | None = None


class SplitChunkResponse(BaseModel):
    """Represents one generated audio chunk after splitting."""
    file_id: int
    original_filename: str
    duration: float
    order_index: int
    chunk_label: str | None = None
    chunk_total: int | None = None
    split_start_seconds: float | None = None
    split_end_seconds: float | None = None
    parent_file_id: int | None = None
    transcription_requested: bool
    started_immediately: bool


class SplitBatchResponse(BaseModel):
    """Response for audio split and batch transcription."""
    parent_file_id: int
    created_files: List[SplitChunkResponse]


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
                print(f"[INITIALIZATION] Starting background initialization...")
                # Start initialization in background thread to avoid blocking API
                import threading
                init_thread = threading.Thread(
                    target=initialize_transcription_service, 
                    daemon=True,
                    name="whisper-init"
                )
                init_thread.start()
                print(f"[INITIALIZATION] Background initialization started")
                logger.info("Background Whisper initialization started")
            except Exception as e:
                print(f"[INITIALIZATION] Failed to start background initialization: {e}")
                logger.error(f"Failed to start background Whisper initialization: {e}")
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

        # UNIFIED PROGRESS: Set status to PROCESSING for both ready and loading states
        # This allows frontend to show unified progress bar for all stages
        audio_file.transcription_status = TranscriptionStatus.PROCESSING
        audio_file.transcription_started_at = datetime.utcnow()
        audio_file.transcription_completed_at = None

        if service_ready:
            audio_file.transcription_progress = 0.0
            audio_file.error_message = None
            audio_file.processing_stage = "Starting transcription..."
        else:
            # Model loading is first stage: 0-10% of total progress
            audio_file.transcription_progress = 0.05  # 5% for model loading stage
            audio_file.error_message = None
            audio_file.processing_stage = "Loading Whisper model..."

        db.commit()

        if not service_ready:
            # Still return 202 Accepted for queued state, but with processing status
            response.status_code = status.HTTP_202_ACCEPTED
            return {
                "status": "processing",  # Changed from "queued" to "processing"
                "message": "Loading Whisper model. Transcription will start automatically.",
                "processing_stage": "Loading Whisper model...",
                "progress": 0.05,  # 5% progress for model loading
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
        logger.info(f"Started transcription thread for file {audio_file_id}")

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
        logger.info(f"Started force-restart transcription thread for file {audio_file_id}")

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
                    print(f"Whisper initialization complete for file {audio_file_id}")
                except Exception as e:
                    print(f"Failed to initialize Whisper for file {audio_file_id}: {e}")

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
    logger.info(f"Started transcription thread for file {audio_file_id} (legacy endpoint)")

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
    
    chunk_label = None
    chunk_total = None
    source_original = None
    if audio_file.transcription_metadata:
        try:
            meta_payload = json.loads(audio_file.transcription_metadata)
            chunk_label = meta_payload.get("chunk_label")
            chunk_total = meta_payload.get("chunk_total")
            if chunk_label is None and chunk_total:
                try:
                    chunk_index = int(meta_payload.get("chunk_index", 0))
                    chunk_total_int = int(chunk_total)
                    chunk_label = f"{chunk_index + 1}/{chunk_total_int}"
                    chunk_total = chunk_total_int
                except (TypeError, ValueError):
                    chunk_total = chunk_total
            else:
                try:
                    chunk_total = int(chunk_total) if chunk_total is not None else None
                except (TypeError, ValueError):
                    chunk_total = None
            source_original = meta_payload.get("source_original_filename")
        except json.JSONDecodeError:
            chunk_total = chunk_total if isinstance(chunk_total, int) else None

    split_context = {
        "parent_file_id": audio_file.parent_audio_file_id,
        "split_start_seconds": audio_file.split_start_seconds,
        "split_end_seconds": audio_file.split_end_seconds,
        "split_label": chunk_label,
        "split_total_chunks": chunk_total,
        "split_origin_filename": source_original,
        "split_depth": audio_file.split_depth,
    }

    # Check if transcription service is ready
    if not is_transcription_service_ready():
        # CRITICAL FIX: If file is already processing, completed, or failed, return actual data from database
        # Don't show "model loading" for files that have actual transcription status!
        if audio_file.transcription_status in (TranscriptionStatus.PROCESSING, TranscriptionStatus.COMPLETED, TranscriptionStatus.FAILED):
            segment_count = db.query(Segment).filter(Segment.audio_file_id == file_id).count()

            # For processing files, use the stored progress and stage from database
            progress_value = audio_file.transcription_progress or 0.0
            if audio_file.transcription_status == TranscriptionStatus.COMPLETED:
                progress_value = 1.0  # Ensure completed files show 100%

            return TranscriptionStatusResponse(
                file_id=audio_file.id,
                filename=audio_file.filename,
                original_filename=audio_file.original_filename,
                status=audio_file.transcription_status.value.lower(),
                progress=progress_value,
                error_message=audio_file.error_message if audio_file.transcription_status == TranscriptionStatus.FAILED else None,
                processing_stage=audio_file.transcription_stage,
                segment_count=segment_count,
                duration=audio_file.duration,
                transcription_started_at=audio_file.transcription_started_at.isoformat() if audio_file.transcription_started_at else None,
                transcription_completed_at=audio_file.transcription_completed_at.isoformat() if audio_file.transcription_completed_at else None,
                created_at=audio_file.created_at.isoformat() if audio_file.created_at else None,
                updated_at=audio_file.updated_at.isoformat() if audio_file.updated_at else None,
                transcription_metadata=audio_file.transcription_metadata,
                **split_context,
            )

        # For pending/processing files, check if model is cached vs needs download
        model_is_cached = is_model_cached_on_disk()
        
        if model_is_cached:
            # Model is downloaded but not loaded into memory
            error_message = "AI model is cached and ready. Click 'Start Transcription' to begin."
            processing_stage = "model_ready_to_load"
        else:
            # Model needs to be downloaded
            error_message = "AI transcription model needs to be downloaded. This may take several minutes."
            processing_stage = "model_download_needed"

        if has_pending_transcriptions():
            if model_is_cached:
                error_message = "Transcription queued. Model will load automatically when processing starts."
                processing_stage = "queued_ready"
            else:
                error_message = "Transcription queued. Model download and loading will start automatically."
                processing_stage = "queued_download"

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
            transcription_metadata=None,
            **split_context,
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
                info_with_split = {**info, **split_context}
                return TranscriptionStatusResponse(**info_with_split)
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
                    transcription_metadata=audio_file.transcription_metadata,
                    **split_context,
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
            transcription_metadata=audio_file.transcription_metadata,
            **split_context,
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
            sequence=s.sequence,
            is_passive=s.is_passive,
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

    audio_file = db.query(AudioFile).filter(AudioFile.id == segment.audio_file_id).first()

    prev_segment = (
        db.query(Segment)
        .filter(
            Segment.audio_file_id == segment.audio_file_id,
            Segment.sequence < segment.sequence,
        )
        .order_by(Segment.sequence.desc())
        .first()
    )
    next_segment = (
        db.query(Segment)
        .filter(
            Segment.audio_file_id == segment.audio_file_id,
            Segment.sequence > segment.sequence,
        )
        .order_by(Segment.sequence)
        .first()
    )

    lower_bound = prev_segment.end_time if prev_segment else 0.0
    upper_bound = None
    if next_segment is not None:
        upper_bound = next_segment.start_time
    elif audio_file and audio_file.duration is not None:
        upper_bound = audio_file.duration

    new_start = segment.start_time if request.start_time is None else request.start_time
    new_end = segment.end_time if request.end_time is None else request.end_time

    if request.start_time is not None or request.end_time is not None:
        if new_start < lower_bound:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Segment start time overlaps the previous segment.",
            )
        if upper_bound is not None and new_end > upper_bound:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Segment end time overlaps the next segment.",
            )
        if new_end <= new_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Segment end time must be greater than start time.",
            )
        segment.start_time = new_start
        segment.end_time = new_end

    if request.edited_text is not None:
        segment.edited_text = request.edited_text

    if request.is_passive is not None:
        segment.is_passive = request.is_passive

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
        sequence=segment.sequence,
        is_passive=segment.is_passive,
    )


@router.post("/segments/passive", response_model=List[SegmentResponse])
async def bulk_update_segment_passive(
    request: SegmentBulkPassiveRequest,
    db: Session = Depends(get_db)
) -> List[SegmentResponse]:
    """
    Bulk update the passive state of multiple segments.

    Args:
        request: Segment IDs and desired passive state
        db: Database session

    Returns:
        Updated segments sorted by sequence
    """
    if not request.segment_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one segment ID must be provided."
        )

    segments = (
        db.query(Segment)
        .filter(Segment.id.in_(request.segment_ids))
        .all()
    )

    if len(segments) != len(request.segment_ids):
        found_ids = {seg.id for seg in segments}
        missing_ids = sorted(set(request.segment_ids) - found_ids)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segments not found: {missing_ids}"
        )

    affected_audio_ids: set[int] = set()
    for segment in segments:
        segment.is_passive = request.is_passive
        affected_audio_ids.add(segment.audio_file_id)

    if affected_audio_ids:
        from datetime import datetime
        audio_files = (
            db.query(AudioFile)
            .filter(AudioFile.id.in_(affected_audio_ids))
            .all()
        )
        now = datetime.utcnow()
        for audio_file in audio_files:
            audio_file.updated_at = now

    db.commit()

    # Refresh to ensure updated values are returned and sort by sequence for deterministic order
    updated_segments = (
        db.query(Segment)
        .filter(Segment.id.in_(request.segment_ids))
        .order_by(Segment.sequence)
        .all()
    )

    return [
        SegmentResponse(
            id=segment.id,
            start_time=segment.start_time,
            end_time=segment.end_time,
            original_text=segment.original_text,
            edited_text=segment.edited_text,
            speaker_id=segment.speaker_id,
            sequence=segment.sequence,
            is_passive=segment.is_passive,
        )
        for segment in updated_segments
    ]


@router.post("/segments/join", response_model=SegmentResponse)
async def join_segments(
    request: SegmentJoinRequest,
    db: Session = Depends(get_db)
) -> SegmentResponse:
    """
    Merge nearby segments into a single segment preserving sequence order.

    Args:
        request: Segment IDs to merge (must belong to same audio file)
        db: Database session

    Returns:
        The merged segment
    """
    if len(request.segment_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least two segments are required to perform a join."
        )

    segments = (
        db.query(Segment)
        .filter(Segment.id.in_(request.segment_ids))
        .order_by(Segment.sequence)
        .all()
    )

    if len(segments) != len(request.segment_ids):
        found_ids = {seg.id for seg in segments}
        missing_ids = sorted(set(request.segment_ids) - found_ids)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segments not found: {missing_ids}"
        )

    audio_file_id = segments[0].audio_file_id
    if any(seg.audio_file_id != audio_file_id for seg in segments):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All segments must belong to the same audio file."
        )

    # Validate speakers if present
    speaker_ids = {seg.speaker_id for seg in segments if seg.speaker_id is not None}
    if len(speaker_ids) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot join segments with different speaker assignments."
        )

    # Ensure segments are "nearby" using optional gap threshold
    if request.max_gap_seconds is not None and request.max_gap_seconds >= 0:
        for prev, curr in zip(segments, segments[1:]):
            gap = curr.start_time - prev.end_time
            if gap > request.max_gap_seconds:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Segments {prev.id} and {curr.id} are {gap:.2f}s apart, "
                        f"exceeding the allowed gap of {request.max_gap_seconds:.2f}s."
                    ),
                )

    base_segment = segments[0]
    remaining_segments = segments[1:]

    # Merge timing and text
    base_segment.end_time = segments[-1].end_time

    original_parts = [seg.original_text.strip() for seg in segments if seg.original_text]
    base_segment.original_text = " ".join(original_parts).strip()

    edited_text_present = any(seg.edited_text for seg in segments)
    if edited_text_present:
        edited_parts = [
            (seg.edited_text or seg.original_text).strip()
            for seg in segments
            if (seg.edited_text or seg.original_text)
        ]
        merged_edit = " ".join(edited_parts).strip()
        base_segment.edited_text = merged_edit if merged_edit else None
    else:
        base_segment.edited_text = None

    # Preserve passive state only if all segments were passive
    base_segment.is_passive = all(seg.is_passive for seg in segments)

    if speaker_ids:
        base_segment.speaker_id = next(iter(speaker_ids))

    # Delete the remaining segments
    for seg in remaining_segments:
        db.delete(seg)

    db.flush()

    # Re-sequence remaining segments for the audio file
    ordered_segments = (
        db.query(Segment)
        .filter(Segment.audio_file_id == audio_file_id)
        .order_by(Segment.sequence, Segment.id)
        .all()
    )
    for index, seg in enumerate(ordered_segments):
        seg.sequence = index

    # Update audio file timestamp
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
    if audio_file:
        from datetime import datetime
        audio_file.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(base_segment)

    return SegmentResponse(
        id=base_segment.id,
        start_time=base_segment.start_time,
        end_time=base_segment.end_time,
        original_text=base_segment.original_text,
        edited_text=base_segment.edited_text,
        speaker_id=base_segment.speaker_id,
        sequence=base_segment.sequence,
        is_passive=base_segment.is_passive,
    )


@router.delete("/segments/{segment_id}", response_model=SegmentListResponse)
async def delete_segment(segment_id: int, db: Session = Depends(get_db)) -> SegmentListResponse:
    """Delete a segment and re-sequence remaining segments."""
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    audio_file_id = segment.audio_file_id
    removed_sequence = segment.sequence

    db.delete(segment)
    db.flush()

    db.query(Segment).filter(
        Segment.audio_file_id == audio_file_id,
        Segment.sequence > removed_sequence,
    ).update({Segment.sequence: Segment.sequence - 1}, synchronize_session=False)

    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
    if audio_file:
        from datetime import datetime
        audio_file.updated_at = datetime.utcnow()

    db.commit()

    remaining = (
        db.query(Segment)
        .filter(Segment.audio_file_id == audio_file_id)
        .order_by(Segment.sequence)
        .all()
    )

    return SegmentListResponse(
        segments=[
            SegmentResponse(
                id=s.id,
                start_time=s.start_time,
                end_time=s.end_time,
                original_text=s.original_text,
                edited_text=s.edited_text,
                speaker_id=s.speaker_id,
                sequence=s.sequence,
                is_passive=s.is_passive,
            )
            for s in remaining
        ]
    )


@router.post("/segment/{segment_id}/insert", response_model=SegmentResponse)
async def insert_segment(
    segment_id: int,
    request: SegmentInsertRequest,
    db: Session = Depends(get_db)
) -> SegmentResponse:
    """Insert a new segment above or below the specified segment."""
    base = db.query(Segment).filter(Segment.id == segment_id).first()
    if not base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    direction = request.direction.lower()
    if direction not in {"above", "below"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="direction must be 'above' or 'below'",
        )

    audio_file_id = base.audio_file_id
    prev_segment = (
        db.query(Segment)
        .filter(
            Segment.audio_file_id == audio_file_id,
            Segment.sequence < base.sequence,
        )
        .order_by(Segment.sequence.desc())
        .first()
    )
    next_segment = (
        db.query(Segment)
        .filter(
            Segment.audio_file_id == audio_file_id,
            Segment.sequence > base.sequence,
        )
        .order_by(Segment.sequence)
        .first()
    )
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()

    if direction == "above":
        lower_bound = prev_segment.end_time if prev_segment else 0.0
        upper_bound = base.start_time
    else:
        lower_bound = base.end_time
        if next_segment is not None:
            upper_bound = next_segment.start_time
        else:
            upper_bound = audio_file.duration if audio_file and audio_file.duration is not None else None

    if upper_bound is not None and upper_bound - lower_bound <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No available time gap to insert a new segment.",
        )

    # Determine proposed timing
    start_time = request.start_time if request.start_time is not None else lower_bound
    if request.end_time is not None:
        end_time = request.end_time
    elif upper_bound is not None:
        end_time = upper_bound
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be provided when inserting after the last segment without a known duration.",
        )

    if start_time < lower_bound:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time overlaps the previous segment.",
        )
    if upper_bound is not None and end_time > upper_bound:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time overlaps the next segment.",
        )
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be greater than start time.",
        )

    new_sequence = base.sequence if direction == "above" else base.sequence + 1

    db.query(Segment).filter(
        Segment.audio_file_id == audio_file_id,
        Segment.sequence >= new_sequence,
    ).update({Segment.sequence: Segment.sequence + 1}, synchronize_session=False)

    new_segment = Segment(
        audio_file_id=audio_file_id,
        sequence=new_sequence,
        start_time=start_time,
        end_time=end_time,
        original_text=(request.original_text or "").strip(),
        edited_text=None,
        speaker_id=request.speaker_id if request.speaker_id is not None else base.speaker_id,
        is_passive=False,
    )

    db.add(new_segment)

    if audio_file:
        from datetime import datetime
        audio_file.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(new_segment)

    return SegmentResponse(
        id=new_segment.id,
        start_time=new_segment.start_time,
        end_time=new_segment.end_time,
        original_text=new_segment.original_text,
        edited_text=new_segment.edited_text,
        speaker_id=new_segment.speaker_id,
        sequence=new_segment.sequence,
        is_passive=new_segment.is_passive,
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


@router.post("/{audio_file_id}/split-batch", response_model=SplitBatchResponse)
async def split_audio_and_batch_transcribe(
    audio_file_id: int,
    request: AudioSplitRequest,
    db: Session = Depends(get_db)
) -> SplitBatchResponse:
    """
    Split an audio file into smaller chunks and optionally start transcription for each.
    """
    audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {audio_file_id} not found"
        )

    audio_service = AudioService()
    try:
        chunks = audio_service.split_audio(
            audio_file.file_path,
            request.chunk_duration_seconds,
            request.overlap_seconds,
            original_display_name=audio_file.original_filename,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source audio file missing from storage. Please re-upload the file."
        )
    except Exception as exc:
        logger.exception("Failed to split audio file %s: %s", audio_file_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to split audio file: {exc}"
        )

    created_entries: list[tuple[AudioFile, dict]] = []
    try:
        for chunk in chunks:
            metadata = {
                "source_audio_file_id": audio_file_id,
                "source_original_filename": audio_file.original_filename,
                "chunk_index": chunk["order_index"],
                "chunk_count": len(chunks),
                "chunk_duration_seconds": request.chunk_duration_seconds,
                "chunk_overlap_seconds": request.overlap_seconds,
                "chunk_start_seconds": chunk["start_seconds"],
                "chunk_end_seconds": chunk["end_seconds"],
                "chunk_total": chunk.get("chunk_total"),
                "chunk_label": chunk.get("chunk_label"),
                "model_size": request.model_size,
                "language": request.language,
                "include_diarization": request.include_diarization,
                "generated_at": datetime.utcnow().isoformat(),
            }

            new_file = AudioFile(
                project_id=audio_file.project_id,
                filename=chunk["unique_filename"],
                original_filename=chunk["original_filename"],
                file_path=chunk["file_path"],
                file_size=chunk["file_size"],
                duration=chunk["duration"],
                format=audio_file.format,
                language=request.language if request.language is not None else audio_file.language,
                transcription_status=TranscriptionStatus.PENDING,
                transcription_progress=0.0,
                transcription_metadata=json.dumps(metadata),
                parent_audio_file_id=audio_file.id,
                split_start_seconds=chunk["start_seconds"],
                split_end_seconds=chunk["end_seconds"],
                split_depth=(audio_file.split_depth if audio_file.split_depth is not None else 0) + 1,
                split_order=chunk["order_index"],
            )
            db.add(new_file)
            db.flush()
            created_entries.append((new_file, chunk))

        db.commit()
    except Exception as exc:
        db.rollback()
        for chunk in chunks:
            try:
                audio_service.delete_file(chunk["file_path"])
            except Exception:
                pass
        logger.exception("Failed to persist split audio records for file %s: %s", audio_file_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist split audio records: {exc}"
        )

    # Refresh instances to ensure we have generated IDs
    for new_file, _ in created_entries:
        db.refresh(new_file)

    results: list[SplitChunkResponse] = []
    service_ready = is_transcription_service_ready()

    if request.start_transcription:
        # Prepare transcription metadata updates
        now = datetime.utcnow()
        for new_file, _ in created_entries:
            if service_ready:
                new_file.transcription_status = TranscriptionStatus.PROCESSING
                new_file.transcription_started_at = now
                new_file.error_message = None
            else:
                add_pending_transcription(
                    new_file.id,
                    include_diarization=request.include_diarization,
                    model_size=request.model_size,
                    language=request.language if request.language is not None else audio_file.language,
                    force_restart=False,
                )
                new_file.transcription_status = TranscriptionStatus.PENDING
                new_file.transcription_started_at = None
                new_file.error_message = "Whisper model loading. Transcription will begin automatically once model is ready."

        db.commit()

        if service_ready:
            import threading

            for new_file, _ in created_entries:
                threading.Thread(
                    target=transcribe_task,
                    kwargs={
                        "audio_file_id": new_file.id,
                        "include_diarization": request.include_diarization,
                        "model_size": request.model_size,
                        "language": request.language if request.language is not None else audio_file.language,
                        "force_restart": False,
                    },
                    daemon=True,
                ).start()
        else:
            if not is_initialization_in_progress():
                try:
                    # Start initialization in background thread to avoid blocking API
                    import threading
                    init_thread = threading.Thread(
                        target=initialize_transcription_service, 
                        daemon=True,
                        name="whisper-init"
                    )
                    init_thread.start()
                    logger.info("🚀 Started Whisper model initialization in background thread")
                except Exception as exc:
                    logger.warning("Failed to start transcription service initialization in background: %s", exc)

    # Build response payload
    service_ready_post = is_transcription_service_ready()
    for new_file, chunk in created_entries:
        results.append(
            SplitChunkResponse(
                file_id=new_file.id,
                original_filename=new_file.original_filename,
                duration=new_file.duration or 0.0,
                order_index=chunk["order_index"],
                 chunk_label=chunk.get("chunk_label"),
                 chunk_total=chunk.get("chunk_total"),
                 split_start_seconds=new_file.split_start_seconds,
                 split_end_seconds=new_file.split_end_seconds,
                 parent_file_id=audio_file_id,
                transcription_requested=request.start_transcription,
                started_immediately=request.start_transcription and service_ready_post,
            )
        )

    return SplitBatchResponse(
        parent_file_id=audio_file_id,
        created_files=sorted(results, key=lambda item: item.order_index),
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
            print(f"RESUMED: Found and completed {len(segments)} existing segments")
        
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
            print(f"STARTED: Created {len(segments)} new segments")
        
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


@router.delete("/{file_id}/clear")
def clear_transcription(
    file_id: int,
    db: Session = Depends(get_db)
):
    """Clear all transcription data for a file (segments, speakers, etc.)."""
    # Verify the audio file exists
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found"
        )
    
    # Count existing data before deletion
    segments_count = db.query(Segment).filter(Segment.audio_file_id == file_id).count()
    speakers_count = db.query(Speaker).filter(Speaker.project_id == audio_file.project_id).count()
    
    # Delete all segments for this file
    db.query(Segment).filter(Segment.audio_file_id == file_id).delete()
    
    # Delete all speakers for the project (since speakers are project-wide)
    db.query(Speaker).filter(Speaker.project_id == audio_file.project_id).delete()
    
    # Reset file transcription status
    audio_file.transcription_status = TranscriptionStatus.PENDING
    audio_file.transcription_progress = 0.0
    audio_file.error_message = None
    audio_file.transcription_started_at = None
    audio_file.transcription_completed_at = None
    audio_file.transcription_duration_seconds = None
    audio_file.model_used = None
    audio_file.processing_stats = None
    audio_file.transcription_stage = "pending"
    audio_file.last_processed_segment = 0
    audio_file.processing_checkpoint = None
    audio_file.resume_token = None
    audio_file.transcription_metadata = None
    audio_file.interruption_count = 0
    audio_file.last_error_at = None
    audio_file.recovery_attempts = 0
    
    db.commit()
    
    return {
        "message": f"🧹 CLEARED: Deleted {segments_count} segments and {speakers_count} speakers",
        "action": "clear",
        "deleted_segments": segments_count,
        "deleted_speakers": speakers_count,
        "file_id": file_id
    }
