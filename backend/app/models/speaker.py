"""
Speaker model - represents a speaker identified in the audio.
"""
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List

from .base import Base, TimestampMixin


class Speaker(Base, TimestampMixin):
    """A speaker identified through diarization."""

    __tablename__ = "speakers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)

    # Speaker information
    speaker_id: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "SPEAKER_00"
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)  # User-editable name
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#3B82F6")  # Hex color

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="speakers")
    segments: Mapped[List["Segment"]] = relationship("Segment", back_populates="speaker")

    def __repr__(self) -> str:
        return f"<Speaker(id={self.id}, speaker_id='{self.speaker_id}', name='{self.display_name}')>"
