"""
ExportTemplate model - represents a user-defined export template.
"""
from sqlalchemy import String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin

class ExportTemplate(Base, TimestampMixin):
    """A user-defined template for exporting text content."""

    __tablename__ = "export_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:
        return f"<ExportTemplate(id={self.id}, name='{self.name}')>"