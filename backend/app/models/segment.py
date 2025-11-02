"""
Segment model - represents a transcribed text segment with timing and speaker.
"""
from sqlalchemy import String, Integer, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional

from .base import Base, TimestampMixin


class Segment(Base, TimestampMixin):
    """A transcribed segment of audio with timing and speaker information."""

    __tablename__ = "segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audio_file_id: Mapped[int] = mapped_column(ForeignKey("audio_files.id"), nullable=False)
    speaker_id: Mapped[Optional[int]] = mapped_column(ForeignKey("speakers.id"), nullable=True)

    # Timing information
    start_time: Mapped[float] = mapped_column(Float, nullable=False)  # seconds
    end_time: Mapped[float] = mapped_column(Float, nullable=False)  # seconds

    # Transcription text
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    edited_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Segment order
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)  # Order in the file
    
    # Segment export control
    is_passive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    audio_file: Mapped["AudioFile"] = relationship("AudioFile", back_populates="segments")
    speaker: Mapped["Optional[Speaker]"] = relationship("Speaker", back_populates="segments")
    edits: Mapped[List["Edit"]] = relationship(
        "Edit", back_populates="segment", cascade="all, delete-orphan"
    )

    @property
    def current_text(self) -> str:
        """Get the current text (edited if available, otherwise original)."""
        return self.edited_text if self.edited_text is not None else self.original_text

    def __repr__(self) -> str:
        return f"<Segment(id={self.id}, start={self.start_time:.2f}s, end={self.end_time:.2f}s)>"
