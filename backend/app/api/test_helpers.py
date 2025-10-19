"""
Test helper API endpoints for E2E testing.
These endpoints allow tests to directly insert data into the database.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..core.database import get_db
from ..models.segment import Segment
from ..models.speaker import Speaker
from ..models.audio_file import AudioFile

router = APIRouter(prefix="/api/test", tags=["test-helpers"])


class CreateSegmentRequest(BaseModel):
    """Request to create a test segment."""
    file_id: int
    sequence: int
    start_time: float
    end_time: float
    original_text: str
    speaker_id: Optional[int] = None


class CreateSpeakerRequest(BaseModel):
    """Request to create a test speaker."""
    file_id: int
    speaker_id: str
    display_name: str


@router.post("/segment")
async def create_test_segment(request: CreateSegmentRequest, db: Session = Depends(get_db)):
    """Create a test segment directly in the database."""

    # Verify file exists
    audio_file = db.query(AudioFile).filter(AudioFile.id == request.file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Create segment
    segment = Segment(
        audio_file_id=request.file_id,
        sequence=request.sequence,
        start_time=request.start_time,
        end_time=request.end_time,
        original_text=request.original_text,
        speaker_id=request.speaker_id,
    )

    db.add(segment)
    db.commit()
    db.refresh(segment)

    return {
        "id": segment.id,
        "audio_file_id": segment.audio_file_id,
        "sequence": segment.sequence,
    }


@router.post("/speaker")
async def create_test_speaker(request: CreateSpeakerRequest, db: Session = Depends(get_db)):
    """Create a test speaker directly in the database."""

    # Verify file exists and get project_id
    audio_file = db.query(AudioFile).filter(AudioFile.id == request.file_id).first()
    if not audio_file:
        raise HTTPException(status_code=404, detail="Audio file not found")

    project_id = audio_file.project_id

    # Check if speaker already exists
    existing_speaker = db.query(Speaker).filter(
        Speaker.project_id == project_id,
        Speaker.speaker_id == request.speaker_id
    ).first()

    if existing_speaker:
        return {
            "id": existing_speaker.id,
            "speaker_id": existing_speaker.speaker_id,
            "display_name": existing_speaker.display_name,
        }

    # Create speaker
    speaker = Speaker(
        project_id=project_id,
        speaker_id=request.speaker_id,
        display_name=request.display_name,
        color="#3B82F6",  # Default blue color
    )

    db.add(speaker)
    db.commit()
    db.refresh(speaker)

    return {
        "id": speaker.id,
        "speaker_id": speaker.speaker_id,
        "display_name": speaker.display_name,
    }
