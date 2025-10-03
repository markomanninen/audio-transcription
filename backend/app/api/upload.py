"""
Upload API endpoints.
"""
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..core.database import get_db
from ..services.audio_service import AudioService
from ..models.project import Project
from ..models.audio_file import AudioFile, TranscriptionStatus


router = APIRouter(prefix="/api/upload", tags=["upload"])


class UploadResponse(BaseModel):
    """Response model for file upload."""
    file_id: int
    filename: str
    original_filename: str
    file_size: int
    duration: float | None
    status: str

    class Config:
        from_attributes = True


class ProjectCreateRequest(BaseModel):
    """Request model for creating a project."""
    name: str
    description: str | None = None
    content_type: str | None = "general"


class ProjectResponse(BaseModel):
    """Response model for project."""
    id: int
    name: str
    description: str | None
    content_type: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    """
    List all projects.
    """
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return projects


@router.post("/project", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: ProjectCreateRequest,
    db: Session = Depends(get_db)
) -> Project:
    """
    Create a new transcription project.
    """
    project = Project(
        name=request.name,
        description=request.description,
        content_type=request.content_type
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/project/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db)
) -> Project:
    """
    Get a specific project.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )
    return project


@router.put("/project/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    request: ProjectCreateRequest,
    db: Session = Depends(get_db)
) -> Project:
    """
    Update a project.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    project.name = request.name
    if request.description is not None:
        project.description = request.description
    if request.content_type is not None:
        project.content_type = request.content_type

    db.commit()
    db.refresh(project)
    return project


@router.delete("/project/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db)
) -> None:
    """
    Delete a project and all associated data (files, segments, speakers, logs).
    """
    import os
    from ..models.segment import Segment
    from ..models.speaker import Speaker
    from ..models.llm_log import LLMLog

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Get all audio files for this project
    audio_files = db.query(AudioFile).filter(AudioFile.project_id == project_id).all()

    # Delete physical audio files from disk
    for audio_file in audio_files:
        try:
            if audio_file.file_path and os.path.exists(audio_file.file_path):
                os.remove(audio_file.file_path)
        except Exception as e:
            print(f"Warning: Could not delete file {audio_file.file_path}: {e}")

        # Delete segments for this audio file
        db.query(Segment).filter(Segment.audio_file_id == audio_file.id).delete()

        # Delete speakers for this audio file
        db.query(Speaker).filter(Speaker.audio_file_id == audio_file.id).delete()

    # Delete audio file records
    db.query(AudioFile).filter(AudioFile.project_id == project_id).delete()

    # Delete LLM logs for this project
    db.query(LLMLog).filter(LLMLog.project_id == project_id).delete()

    # Finally delete the project
    db.delete(project)
    db.commit()


@router.post("/file/{project_id}", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    project_id: int,
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    db: Session = Depends(get_db)
) -> UploadResponse:
    """
    Upload an audio file for transcription.

    Args:
        project_id: ID of the project to add file to
        file: Uploaded audio file
        db: Database session

    Returns:
        UploadResponse with file details

    Raises:
        HTTPException: If validation fails or project not found
    """
    # Check if project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    # Read file content
    file_content = await file.read()

    # Initialize audio service
    audio_service = AudioService()

    # Validate file
    is_valid, error_message = audio_service.validate_file(file_content, file.filename or "unknown.mp3")
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )

    # Save file
    unique_filename, file_path = audio_service.save_file(file_content, file.filename or "unknown.mp3")

    # Get audio duration
    try:
        duration = audio_service.get_audio_duration(file_path)
    except Exception:
        duration = None

    # Create database record
    file_format = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "mp3"
    # Convert empty string to None for auto-detect
    lang_code = language if language and language.strip() else None
    audio_file = AudioFile(
        project_id=project_id,
        filename=unique_filename,
        original_filename=file.filename or "unknown.mp3",
        file_path=file_path,
        file_size=len(file_content),
        duration=duration,
        format=file_format,
        language=lang_code,  # None for auto-detect, or ISO 639-1 code (en, fi, sv, etc.)
        transcription_status=TranscriptionStatus.PENDING
    )

    db.add(audio_file)
    db.commit()
    db.refresh(audio_file)

    return UploadResponse(
        file_id=audio_file.id,
        filename=audio_file.filename,
        original_filename=audio_file.original_filename,
        file_size=audio_file.file_size,
        duration=audio_file.duration,
        status=audio_file.transcription_status.value
    )


@router.get("/files/{project_id}", response_model=list[UploadResponse])
async def list_project_files(
    project_id: int,
    db: Session = Depends(get_db)
) -> list[UploadResponse]:
    """
    List all audio files in a project.

    Args:
        project_id: ID of the project
        db: Database session

    Returns:
        List of audio files

    Raises:
        HTTPException: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found"
        )

    files = db.query(AudioFile).filter(AudioFile.project_id == project_id).all()

    return [
        UploadResponse(
            file_id=f.id,
            filename=f.filename,
            original_filename=f.original_filename,
            file_size=f.file_size,
            duration=f.duration,
            status=f.transcription_status.value
        )
        for f in files
    ]
