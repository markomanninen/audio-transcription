"""
Audio file serving endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pathlib import Path

from ..core.database import get_db
from ..models.audio_file import AudioFile

router = APIRouter(prefix="/api/audio", tags=["audio"])


def ranged_file_response(
    file_path: Path,
    request: Request,
    media_type: str,
    chunk_size: int = 1024 * 1024  # 1MB chunks
):
    """
    Create a streaming response with range request support for audio/video.

    Args:
        file_path: Path to the file
        request: FastAPI request object
        media_type: MIME type of the file
        chunk_size: Size of chunks to stream

    Returns:
        StreamingResponse with proper headers
    """
    file_size = file_path.stat().st_size
    range_header = request.headers.get('range')

    # If no range header, send entire file
    if not range_header:
        def iter_file():
            with open(file_path, 'rb') as f:
                while chunk := f.read(chunk_size):
                    yield chunk

        return StreamingResponse(
            iter_file(),
            media_type=media_type,
            headers={
                'Accept-Ranges': 'bytes',
                'Content-Length': str(file_size),
            }
        )

    # Parse range header
    range_match = range_header.replace('bytes=', '').split('-')
    start = int(range_match[0]) if range_match[0] else 0
    end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1

    # Validate range
    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(
            status_code=416,
            detail="Requested range not satisfiable"
        )

    content_length = end - start + 1

    def iter_range():
        with open(file_path, 'rb') as f:
            f.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk_to_read = min(chunk_size, remaining)
                data = f.read(chunk_to_read)
                if not data:
                    break
                remaining -= len(data)
                yield data

    return StreamingResponse(
        iter_range(),
        status_code=206,  # Partial Content
        media_type=media_type,
        headers={
            'Content-Range': f'bytes {start}-{end}/{file_size}',
            'Accept-Ranges': 'bytes',
            'Content-Length': str(content_length),
        }
    )


@router.get("/{file_id}")
async def get_audio_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Serve audio file for playback with range request support.

    Args:
        file_id: ID of the audio file
        request: FastAPI request object
        db: Database session

    Returns:
        Audio file stream
    """
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Handle both absolute and relative paths
    file_path = Path(audio_file.file_path)
    if not file_path.is_absolute():
        # If relative, make it absolute using the working directory
        file_path = Path.cwd() / file_path

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file not found on disk: {file_path}"
        )

    # Map file formats to proper MIME types
    mime_types = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'mp4': 'audio/mp4',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
        'webm': 'audio/webm',
    }

    media_type = mime_types.get(audio_file.format.lower(), f'audio/{audio_file.format}')

    return ranged_file_response(file_path, request, media_type)
