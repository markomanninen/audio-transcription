"""
Upload API endpoints.
"""
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import Optional

from ..core.database import get_db
from ..services.audio_service import AudioService
from ..models.project import Project
from ..models.audio_file import AudioFile, TranscriptionStatus


router = APIRouter(prefix="/api/upload", tags=["upload"])


class UploadResponse(BaseModel):
    """Response model for file upload."""
    model_config = ConfigDict(from_attributes=True)

    file_id: int
    filename: str
    original_filename: str
    file_size: int
    duration: float | None
    status: str
    parent_audio_file_id: int | None = None
    split_start_seconds: float | None = None
    split_end_seconds: float | None = None
    split_depth: int = 0
    split_order: int = 0
    # Add processing_stage and error_message for enhanced status detection
    processing_stage: str | None = None
    error_message: str | None = None


class ProjectCreateRequest(BaseModel):
    """Request model for creating a project."""
    name: str
    description: str | None = None
    content_type: str | None = "general"


class ProjectResponse(BaseModel):
    """Response model for project."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    content_type: str | None
    created_at: datetime


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

    # Delete audio file records
    db.query(AudioFile).filter(AudioFile.project_id == project_id).delete()

    # Delete LLM logs for this project
    db.query(LLMLog).filter(LLMLog.project_id == project_id).delete()

    # Delete speakers for this project
    db.query(Speaker).filter(Speaker.project_id == project_id).delete()

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
        status=audio_file.transcription_status.value.lower()
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

    children_map: dict[int | None, list[AudioFile]] = {}
    for file in files:
        children_map.setdefault(file.parent_audio_file_id, []).append(file)

    for siblings in children_map.values():
        siblings.sort(
            key=lambda f: (
                f.split_order or 0,
                f.created_at or datetime.min,
            )
        )

    ordered: list[AudioFile] = []
    visited: set[int] = set()

    def add_branch(node: AudioFile) -> None:
        if node.id in visited:
            return
        visited.add(node.id)
        ordered.append(node)
        for child in children_map.get(node.id, []):
            add_branch(child)

    root_candidates = children_map.get(None, [])
    root_candidates.sort(key=lambda f: f.created_at or datetime.min)
    for root in root_candidates:
        add_branch(root)

    # Include any remaining files (e.g., missing parents) in creation order
    for file in sorted(files, key=lambda f: f.created_at or datetime.min):
        if file.id not in visited:
            add_branch(file)

    return [
        UploadResponse(
            file_id=f.id,
            filename=f.filename,
            original_filename=f.original_filename,
            file_size=f.file_size,
            duration=f.duration,
            status=f.transcription_status.value.lower(),
            parent_audio_file_id=f.parent_audio_file_id,
            split_start_seconds=f.split_start_seconds,
            split_end_seconds=f.split_end_seconds,
            split_depth=f.split_depth,
            split_order=f.split_order,
            processing_stage=f.transcription_stage,
            error_message=f.error_message,
        )
        for f in ordered
    ]


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a specific uploaded file and all its associated data.

    This includes:
    - The audio file record from database
    - All child split files (if this is a parent file)
    - All segments and their LLM logs
    - All speakers associated with segments
    - Physical audio files from disk (original and converted WAV)
    """
    from ..models.audio_file import AudioFile
    from ..models.segment import Segment
    from ..models.speaker import Speaker
    from ..models.llm_log import LLMLog
    import os
    import glob

    # Find the file
    file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Collect all file IDs to delete (this file + any child split files)
    file_ids_to_delete = [file_id]

    # If this is a parent file, also delete all child split files
    child_files = db.query(AudioFile).filter(AudioFile.parent_audio_file_id == file_id).all()
    file_ids_to_delete.extend([child.id for child in child_files])

    # Delete related data for all files in correct order (foreign key constraints)
    for fid in file_ids_to_delete:
        # 1. Delete LLM logs related to segments
        segment_ids = db.query(Segment.id).filter(Segment.audio_file_id == fid).subquery()
        db.query(LLMLog).filter(LLMLog.segment_id.in_(segment_ids)).delete(synchronize_session=False)

        # 2. Delete speakers associated with segments of this file
        # First, get speaker IDs from segments
        speaker_ids_query = db.query(Segment.speaker_id).filter(
            Segment.audio_file_id == fid,
            Segment.speaker_id.isnot(None)
        ).distinct()
        speaker_ids = [sid[0] for sid in speaker_ids_query.all()]

        # 3. Delete segments
        db.query(Segment).filter(Segment.audio_file_id == fid).delete(synchronize_session=False)

        # 4. Delete speakers (now that segments are deleted)
        if speaker_ids:
            db.query(Speaker).filter(Speaker.id.in_(speaker_ids)).delete(synchronize_session=False)

        # 5. Delete physical files
        audio_file_to_delete = db.query(AudioFile).filter(AudioFile.id == fid).first()
        if audio_file_to_delete and audio_file_to_delete.file_path:
            # Delete the original audio file
            if os.path.exists(audio_file_to_delete.file_path):
                try:
                    os.remove(audio_file_to_delete.file_path)
                except OSError as e:
                    print(f"Warning: Could not delete {audio_file_to_delete.file_path}: {e}")

            # Delete converted WAV file if it exists
            # Pattern: original_path_without_extension + "_converted.wav"
            base_path = os.path.splitext(audio_file_to_delete.file_path)[0]
            converted_wav = f"{base_path}_converted.wav"
            if os.path.exists(converted_wav):
                try:
                    os.remove(converted_wav)
                except OSError as e:
                    print(f"Warning: Could not delete {converted_wav}: {e}")

            # Also check for any other converted files with similar patterns
            # (e.g., UUID_converted.wav in the same directory)
            file_dir = os.path.dirname(audio_file_to_delete.file_path)
            file_basename = os.path.basename(audio_file_to_delete.file_path)
            uuid_part = os.path.splitext(file_basename)[0]
            converted_pattern = os.path.join(file_dir, f"{uuid_part}_converted.*")
            for converted_file in glob.glob(converted_pattern):
                try:
                    os.remove(converted_file)
                except OSError as e:
                    print(f"Warning: Could not delete {converted_file}: {e}")

        # 6. Delete the audio file record from database
        if audio_file_to_delete:
            db.delete(audio_file_to_delete)

    db.commit()

    deleted_count = len(file_ids_to_delete)
    return {
        "message": f"Successfully deleted {deleted_count} file(s) including all associated data",
        "deleted_files": deleted_count
    }
