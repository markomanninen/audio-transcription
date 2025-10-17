"""
AudioFile model - represents an uploaded audio file.
"""
from sqlalchemy import String, Integer, Float, ForeignKey, Enum as SQLEnum, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from typing import List
import enum
from datetime import datetime

from .base import Base, TimestampMixin


class TranscriptionStatus(str, enum.Enum):
    """Status of transcription processing."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AudioFile(Base, TimestampMixin):
    """An audio file uploaded for transcription."""

    __tablename__ = "audio_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)

    # File information
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)  # seconds
    format: Mapped[str] = mapped_column(String(10), nullable=False)  # mp3, wav, etc.
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO 639-1 code (en, fi, sv, etc.) or None for auto-detect

    # Transcription status
    transcription_status: Mapped[TranscriptionStatus] = mapped_column(
        SQLEnum(TranscriptionStatus),
        default=TranscriptionStatus.PENDING,
        nullable=False
    )
    transcription_progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    
    # Audit fields for performance tracking
    transcription_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    transcription_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True) 
    transcription_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Whisper model size used
    processing_stats: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string with performance metrics
    
    # Enhanced state tracking for resume functionality
    audio_transformed: Mapped[bool] = mapped_column(Integer, default=False, nullable=False)  # Audio preprocessing completed
    audio_transformation_path: Mapped[str | None] = mapped_column(Text, nullable=True)  # Path to transformed audio file
    whisper_model_loaded: Mapped[str | None] = mapped_column(Text, nullable=True)  # Currently loaded Whisper model
    transcription_stage: Mapped[str] = mapped_column(Text, default='pending', nullable=False)  # Current processing stage
    last_processed_segment: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # Last completed segment index
    processing_checkpoint: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON checkpoint data
    resume_token: Mapped[str | None] = mapped_column(Text, nullable=True)  # Unique token for resume operations
    transcription_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON metadata about transcription
    interruption_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # Number of interruptions
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # Last error timestamp
    recovery_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # Number of recovery attempts

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="audio_files")
    segments: Mapped[List["Segment"]] = relationship(
        "Segment", back_populates="audio_file", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AudioFile(id={self.id}, filename='{self.filename}', status={self.transcription_status})>"

    @staticmethod
    def _coerce_status(value):
        """Coerce incoming values to TranscriptionStatus enum."""
        if value is None:
            return None

        if isinstance(value, TranscriptionStatus):
            return value

        if isinstance(value, str):
            upper_value = value.upper()
            if upper_value in TranscriptionStatus.__members__:
                return TranscriptionStatus[upper_value]

        raise ValueError(f"Invalid transcription status value: {value}")

    @validates("transcription_status")
    def validate_transcription_status(self, key, value):  # noqa: D401
        """Ensure transcription status values always map to the enum."""
        return self._coerce_status(value)
