"""
Project model - represents a transcription project/session.
"""
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List

from .base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    """A transcription project containing audio files and their transcriptions."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    content_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        default="general",
        comment="Type of content: lyrics, academic, interview, literature, media, presentation, general"
    )

    # Relationships
    audio_files: Mapped[List["AudioFile"]] = relationship(
        "AudioFile", back_populates="project", cascade="all, delete-orphan"
    )
    speakers: Mapped[List["Speaker"]] = relationship(
        "Speaker", back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}')>"
