"""
TextDocument model - represents a standalone text document.
"""
from sqlalchemy import Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

class TextDocument(Base, TimestampMixin):
    """A standalone text document, not tied to an audio file."""

    __tablename__ = "text_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, unique=True)

    # The entire text content of the document
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # The history of the text content, stored as a JSON array of strings
    history: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    # Relationship
    project: Mapped["Project"] = relationship("Project", back_populates="text_document")

    def __repr__(self) -> str:
        return f"<TextDocument(id={self.id}, project_id={self.project_id})>"