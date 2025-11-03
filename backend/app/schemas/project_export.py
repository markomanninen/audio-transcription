"""
Schemas for project export and import functionality.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class ExportedAudioFile(BaseModel):
    """Schema for exported audio file metadata."""
    id: int
    filename: str
    original_filename: str
    file_size: int
    duration: Optional[float]
    format: str
    language: Optional[str]
    transcription_status: str
    transcription_progress: float
    parent_audio_file_id: Optional[int]
    split_start_seconds: Optional[float]
    split_end_seconds: Optional[float]
    split_depth: int
    split_order: int
    # Metadata fields
    transcription_started_at: Optional[datetime]
    transcription_completed_at: Optional[datetime]
    transcription_duration_seconds: Optional[float]
    model_used: Optional[str]
    processing_stats: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ExportedSegment(BaseModel):
    """Schema for exported segment data."""
    id: int
    audio_file_id: int
    speaker_id: Optional[int]
    start_time: float
    end_time: float
    original_text: str
    edited_text: Optional[str]
    sequence: int
    is_passive: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ExportedSpeaker(BaseModel):
    """Schema for exported speaker data."""
    id: int
    project_id: int
    speaker_id: str
    display_name: str
    color: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ExportedEdit(BaseModel):
    """Schema for exported edit history."""
    id: int
    segment_id: int
    previous_text: str
    new_text: str
    edit_type: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ExportedProject(BaseModel):
    """Schema for exported project metadata."""
    id: int
    name: str
    description: Optional[str]
    project_type: str
    content_type: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ProjectExportData(BaseModel):
    """Complete project export data structure."""
    # Export metadata
    export_version: str = "1.0"
    export_timestamp: datetime
    
    # Project data
    project: ExportedProject
    audio_files: List[ExportedAudioFile]
    segments: List[ExportedSegment]
    speakers: List[ExportedSpeaker]
    edits: List[ExportedEdit]
    
    # File mappings (original file ID -> new filename in ZIP)
    audio_file_mappings: Dict[int, str]
    
    # Additional metadata
    export_stats: Dict[str, Any]


class ProjectImportRequest(BaseModel):
    """Request schema for project import."""
    project_name: Optional[str] = None
    project_description: Optional[str] = None
    overwrite_existing: bool = False
    validate_only: bool = False


class ProjectImportResult(BaseModel):
    """Result schema for project import."""
    success: bool
    project_id: Optional[int]
    errors: List[str]
    warnings: List[str]
    import_stats: Dict[str, Any]
    validation_only: bool = False


class ProjectImportValidation(BaseModel):
    """Validation result for project import."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    project_info: Optional[Dict[str, Any]]
    file_info: Optional[Dict[str, Any]]