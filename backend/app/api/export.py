"""
Export API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..services.export_service import ExportService
from ..models.audio_file import AudioFile
from ..models.project import Project


router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/{file_id}/srt")
async def export_srt(
    file_id: int,
    use_edited: bool = Query(True, description="Use edited text if available"),
    include_speakers: bool = Query(True, description="Include speaker names"),
    db: Session = Depends(get_db)
):
    """
    Export transcription as SRT subtitle file.

    Args:
        file_id: ID of the audio file
        use_edited: Use edited text if available
        include_speakers: Include speaker names
        db: Database session

    Returns:
        SRT file download
    """
    # Verify file exists
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Generate SRT
    export_service = ExportService()
    srt_content = export_service.generate_srt(
        file_id=file_id,
        db=db,
        use_edited=use_edited,
        include_speakers=include_speakers
    )

    # Create filename
    base_name = audio_file.original_filename.rsplit(".", 1)[0]
    filename = f"{base_name}_transcription.srt"

    return Response(
        content=srt_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/project/{project_id}/template/{template_id}")
async def export_with_template(
    project_id: int,
    template_id: int,
    db: Session = Depends(get_db)
):
    """
    Export a project's content using a custom template.
    """
    try:
        export_service = ExportService()
        content = export_service.generate_from_template(project_id, template_id, db)

        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
             raise HTTPException(status_code=404, detail="Project not found")

        base_name = project.name.replace(" ", "_")
        filename = f"{base_name}_export.txt"

        return Response(
            content=content,
            media_type="text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{file_id}/html")
async def export_html(
    file_id: int,
    use_edited: bool = Query(True, description="Use edited text if available"),
    include_speakers: bool = Query(True, description="Include speaker names"),
    include_timestamps: bool = Query(True, description="Include timestamps"),
    db: Session = Depends(get_db)
):
    """
    Export transcription as HTML file.

    Args:
        file_id: ID of the audio file
        use_edited: Use edited text if available
        include_speakers: Include speaker names
        include_timestamps: Include timestamps
        db: Database session

    Returns:
        HTML file download
    """
    # Verify file exists
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Generate HTML
    export_service = ExportService()
    html_content = export_service.generate_html(
        file_id=file_id,
        db=db,
        use_edited=use_edited,
        include_speakers=include_speakers,
        include_timestamps=include_timestamps
    )

    # Create filename
    base_name = audio_file.original_filename.rsplit(".", 1)[0]
    filename = f"{base_name}_transcription.html"

    return Response(
        content=html_content,
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/{file_id}/txt")
async def export_txt(
    file_id: int,
    use_edited: bool = Query(True, description="Use edited text if available"),
    include_speakers: bool = Query(True, description="Include speaker names"),
    include_timestamps: bool = Query(False, description="Include timestamps"),
    db: Session = Depends(get_db)
):
    """
    Export transcription as plain text file.

    Args:
        file_id: ID of the audio file
        use_edited: Use edited text if available
        include_speakers: Include speaker names
        include_timestamps: Include timestamps
        db: Database session

    Returns:
        Text file download
    """
    # Verify file exists
    audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
    if not audio_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file {file_id} not found"
        )

    # Generate text
    export_service = ExportService()
    txt_content = export_service.generate_txt(
        file_id=file_id,
        db=db,
        use_edited=use_edited,
        include_speakers=include_speakers,
        include_timestamps=include_timestamps
    )

    # Create filename
    base_name = audio_file.original_filename.rsplit(".", 1)[0]
    filename = f"{base_name}_transcription.txt"

    return Response(
        content=txt_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
