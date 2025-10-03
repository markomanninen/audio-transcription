"""
AudioFile model - represents an uploaded audio file.
"""
from sqlalchemy import String, Integer, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List
import enum

from .base import Base, TimestampMixin


class TranscriptionStatus(str, enum.Enum):
    """Status of transcription processing."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


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

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="audio_files")
    segments: Mapped[List["Segment"]] = relationship(
        "Segment", back_populates="audio_file", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AudioFile(id={self.id}, filename='{self.filename}', status={self.transcription_status})>"
