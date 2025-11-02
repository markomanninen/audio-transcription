"""Edit model - tracks edit history for segments."""
from __future__ import annotations

from sqlalchemy import String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .segment import Segment


class Edit(Base, TimestampMixin):
    """Edit history for a segment."""

    __tablename__ = "edits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("segments.id"), nullable=False)

    # Edit information
    previous_text: Mapped[str] = mapped_column(Text, nullable=False)
    new_text: Mapped[str] = mapped_column(Text, nullable=False)
    edit_type: Mapped[str] = mapped_column(String(50), nullable=False)  # manual, ai_correction, etc.

    # Relationships
    segment: Mapped["Segment"] = relationship("Segment", back_populates="edits")

    def __repr__(self) -> str:
        return f"<Edit(id={self.id}, segment_id={self.segment_id}, type='{self.edit_type}')>"
