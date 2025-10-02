"""
Transcription API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from ..core.database import get_db
from ..services.transcription_service import TranscriptionService
from ..services.speaker_service import SpeakerService
from ..models.segment import Segment
from ..models.speaker import Speaker


router = APIRouter(prefix="/api/transcription", tags=["transcription"])


class TranscriptionStatusResponse(BaseModel):
    """Response model for transcription status."""
    file_id: int
    status: str
    progress: float
    error_message: str | None
    segment_count: int
    duration: float | None

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


class SegmentUpdateRequest(BaseModel):
    """Request to update a segment's edited text."""
    edited_text: str


def transcribe_task(audio_file_id: int, include_diarization: bool):
    """Background task for transcription."""
    from ..core.database import SessionLocal

    db = SessionLocal()
    try:
        # Transcribe
        transcription_service = TranscriptionService()
        transcription_service.transcribe_audio(audio_file_id, db)

        # Perform speaker diarization if requested
        if include_diarization:
            speaker_service = SpeakerService()
            speaker_service.perform_diarization(audio_file_id, db)

    finally:
        db.close()


@router.post("/{file_id}/start", status_code=status.HTTP_202_ACCEPTED)
async def start_transcription(
    file_id: int,
    request: StartTranscriptionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> dict:
    """
    Start transcription of an audio file in the background.

    Args:
        file_id: ID of audio file to transcribe
        request: Transcription options
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Acknowledgment message
    """
    # Add transcription task to background
    background_tasks.add_task(transcribe_task, file_id, request.include_diarization)

    return {
        "message": "Transcription started",
        "file_id": file_id,
        "include_diarization": request.include_diarization
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
    transcription_service = TranscriptionService()
    try:
        info = transcription_service.get_transcription_info(file_id, db)
        return TranscriptionStatusResponse(**info)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


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
        List of speakers
    """
    from ..models.audio_file import AudioFile

    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    speakers = (
        db.query(Speaker)
        .filter(Speaker.project_id == audio_file.project_id)
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
