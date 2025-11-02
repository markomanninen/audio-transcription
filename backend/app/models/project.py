"""
Project model - represents a transcription or text project.
"""
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional

from .base import Base, TimestampMixin
from .text_document import TextDocument


class Project(Base, TimestampMixin):
    """A project that can contain either audio files for transcription or a standalone text document."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    project_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="audio",
        comment="Type of project: 'audio' or 'text'"
    )

    content_type: Mapped[Optional[str]] = mapped_column(
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
    text_document: Mapped[Optional["TextDocument"]] = relationship(
        "TextDocument", back_populates="project", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}', type='{self.project_type}')>"
