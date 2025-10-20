"""
LLM request/response logging API endpoints.
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..core.database import get_db
from ..models.llm_log import LLMLog

router = APIRouter(prefix="/api/llm", tags=["llm"])


class LLMLogResponse(BaseModel):
    """Response model for LLM log entries."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    model: str
    operation: str
    prompt: str
    original_text: Optional[str]
    context: Optional[str]
    response: str
    corrected_text: Optional[str]
    status: str
    error_message: Optional[str]
    duration_ms: Optional[float]
    segment_id: Optional[int]
    project_id: Optional[int]
    created_at: datetime


@router.get("/logs", response_model=List[LLMLogResponse])
async def get_llm_logs(
    limit: int = Query(50, ge=1, le=500),
    project_id: Optional[int] = Query(None),
    provider: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    operation: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> List[LLMLogResponse]:
    """
    Get LLM request/response logs with optional filters.

    Args:
        limit: Maximum number of logs to return (1-500, default 50)
        project_id: Filter by project ID
        provider: Filter by provider name (ollama, openrouter)
        status: Filter by status (success, error)
        operation: Filter by operation type (correct_text, analyze_content)
        db: Database session

    Returns:
        List of LLM log entries sorted by creation time (newest first)
    """
    query = db.query(LLMLog).order_by(LLMLog.created_at.desc())

    if project_id:
        query = query.filter(LLMLog.project_id == project_id)
    if provider:
        query = query.filter(LLMLog.provider == provider)
    if status:
        query = query.filter(LLMLog.status == status)
    if operation:
        query = query.filter(LLMLog.operation == operation)

    logs = query.limit(limit).all()
    return logs
