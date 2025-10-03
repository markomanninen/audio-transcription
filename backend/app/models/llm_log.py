"""
LLM request/response logging model for debugging and monitoring.
"""
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class LLMLog(Base):
    """
    Log of LLM API requests and responses for debugging.

    Stores prompt, response, timing, and metadata for troubleshooting
    and understanding LLM behavior.
    """
    __tablename__ = "llm_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Request metadata
    provider: Mapped[str] = mapped_column(String(50))  # ollama, openrouter
    model: Mapped[str] = mapped_column(String(100))  # llama3.2:1b, claude-3-haiku, etc.
    operation: Mapped[str] = mapped_column(String(50))  # correct_text, analyze_content, etc.

    # Request data
    prompt: Mapped[str] = mapped_column(Text)  # Full prompt sent
    original_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # Original text being corrected
    context: Mapped[str | None] = mapped_column(Text, nullable=True)  # Context provided

    # Response data
    response: Mapped[str] = mapped_column(Text)  # Raw response from LLM
    corrected_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # Parsed corrected text

    # Metadata
    status: Mapped[str] = mapped_column(String(20), default="success")  # success, error
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)  # Request duration in milliseconds

    # Reference data
    segment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Related segment ID if applicable
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Related project ID if applicable

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<LLMLog(id={self.id}, provider={self.provider}, model={self.model}, operation={self.operation})>"
