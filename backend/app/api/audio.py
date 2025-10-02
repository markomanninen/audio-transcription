"""
Audio file serving endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os

from ..core.database import get_db
from ..models.audio_file import AudioFile

router = APIRouter(prefix="/api/audio", tags=["audio"])


@router.get("/{file_id}")
async def get_audio_file(
    file_id: int,
    db: Session = Depends(get_db)
):
    """
    Serve audio file for playback.

    Args:
        file_id: ID of the audio file
        db: Database session

    Returns:
        Audio file for streaming
    """
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    if not os.path.exists(audio_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file not found on disk"
        )

    return FileResponse(
        audio_file.file_path,
        media_type=f"audio/{audio_file.format}",
        filename=audio_file.original_filename
    )
