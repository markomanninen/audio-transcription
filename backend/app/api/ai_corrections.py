"""
AI-powered text correction endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from ..core.database import get_db
from ..models.segment import Segment
from ..services.llm.llm_service import LLMService

router = APIRouter(prefix="/api/ai", tags=["ai"])


class SegmentCorrectionRequest(BaseModel):
    """Request model for correcting a single segment."""
    segment_id: int
    provider: str = "ollama"
    correction_type: str = "all"


class BatchCorrectionRequest(BaseModel):
    """Request model for correcting multiple segments."""
    segment_ids: List[int]
    provider: str = "ollama"
    correction_type: str = "all"


class CorrectionResponse(BaseModel):
    """Response model for correction results."""
    segment_id: int
    original_text: str
    corrected_text: str
    changes: List[str]
    confidence: float


class ProviderInfo(BaseModel):
    """Provider information model."""
    name: str
    available: bool


@router.post("/correct-segment", response_model=CorrectionResponse)
async def correct_segment(
    request: SegmentCorrectionRequest,
    db: Session = Depends(get_db)
) -> CorrectionResponse:
    """
    Correct a single segment using specified LLM provider.

    Args:
        request: Correction request with segment_id, provider, correction_type
        db: Database session

    Returns:
        Correction results with suggested changes

    Raises:
        HTTPException: If segment not found or provider unavailable
    """
    # Get segment
    segment = db.query(Segment).filter(Segment.id == request.segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment {request.segment_id} not found")
    if segment.is_passive:
        raise HTTPException(
            status_code=400,
            detail="Passive segments are excluded from AI corrections. Reactivate the segment before requesting a correction."
        )

    # Use edited text if available, otherwise original
    text_to_correct = segment.edited_text or segment.original_text

    # Build context with speaker, content type, and surrounding segments
    context_parts = []

    if segment.speaker:
        context_parts.append(f"Speaker: {segment.speaker.display_name or segment.speaker.label}")

    # Get content type from project
    if segment.audio_file and segment.audio_file.project:
        content_type = segment.audio_file.project.content_type
        if content_type and content_type != "general":
            context_parts.append(f"Content type: {content_type}")

    # Get surrounding segments for context (1 before, 1 after)
    if segment.audio_file_id:
        # Get previous segment
        prev_segment = db.query(Segment).filter(
            Segment.audio_file_id == segment.audio_file_id,
            Segment.sequence == segment.sequence - 1
        ).first()

        # Get next segment
        next_segment = db.query(Segment).filter(
            Segment.audio_file_id == segment.audio_file_id,
            Segment.sequence == segment.sequence + 1
        ).first()

        # Add surrounding context
        surrounding = []
        if prev_segment:
            prev_text = prev_segment.edited_text or prev_segment.original_text
            surrounding.append(f"Previous: ...{prev_text[-80:]}" if len(prev_text) > 80 else f"Previous: {prev_text}")
        if next_segment:
            next_text = next_segment.edited_text or next_segment.original_text
            surrounding.append(f"Next: {next_text[:80]}..." if len(next_text) > 80 else f"Next: {next_text}")

        if surrounding:
            context_parts.append(" ".join(surrounding))

    context = " | ".join(context_parts) if context_parts else ""

    # Initialize LLM service with database session
    llm_service = LLMService(db=db)

    # Get project_id from segment
    project_id = segment.audio_file.project_id if segment.audio_file else None

    try:
        # Perform correction
        result = await llm_service.correct_text(
            text=text_to_correct,
            provider=request.provider,
            context=context,
            correction_type=request.correction_type,
            segment_id=segment.id,
            project_id=project_id
        )

        return CorrectionResponse(
            segment_id=segment.id,
            original_text=result["original_text"],
            corrected_text=result["corrected_text"],
            changes=result["changes"],
            confidence=result["confidence"]
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Correction failed: {str(e)}")


@router.post("/correct-batch", response_model=List[CorrectionResponse])
async def correct_batch(
    request: BatchCorrectionRequest,
    db: Session = Depends(get_db)
) -> List[CorrectionResponse]:
    """
    Correct multiple segments using specified LLM provider.

    Args:
        request: Batch correction request with segment_ids, provider, correction_type
        db: Database session

    Returns:
        List of correction results for each segment

    Raises:
        HTTPException: If any segment not found or provider unavailable
    """
    # Get all segments
    segments = db.query(Segment).filter(Segment.id.in_(request.segment_ids)).all()

    if len(segments) != len(request.segment_ids):
        found_ids = {seg.id for seg in segments}
        missing_ids = set(request.segment_ids) - found_ids
        raise HTTPException(
            status_code=404,
            detail=f"Segments not found: {missing_ids}"
        )

    passive_segments = [seg.id for seg in segments if seg.is_passive]
    if passive_segments:
        raise HTTPException(
            status_code=400,
            detail=f"Passive segments cannot be corrected: {passive_segments}"
        )

    segments = [seg for seg in segments if not seg.is_passive]

    # Initialize LLM service with database session
    llm_service = LLMService(db=db)

    results = []
    for segment in segments:
        # Use edited text if available, otherwise original
        text_to_correct = segment.edited_text or segment.original_text

        # Build context with speaker, content type, and surrounding segments
        context_parts = []

        if segment.speaker:
            context_parts.append(f"Speaker: {segment.speaker.display_name or segment.speaker.label}")

        # Get content type from project
        if segment.audio_file and segment.audio_file.project:
            content_type = segment.audio_file.project.content_type
            if content_type and content_type != "general":
                context_parts.append(f"Content type: {content_type}")

        # Get surrounding segments for context (1 before, 1 after)
        if segment.audio_file_id:
            # Get previous segment
            prev_segment = db.query(Segment).filter(
                Segment.audio_file_id == segment.audio_file_id,
                Segment.sequence == segment.sequence - 1
            ).first()

            # Get next segment
            next_segment = db.query(Segment).filter(
                Segment.audio_file_id == segment.audio_file_id,
                Segment.sequence == segment.sequence + 1
            ).first()

            # Add surrounding context
            surrounding = []
            if prev_segment:
                prev_text = prev_segment.edited_text or prev_segment.original_text
                surrounding.append(f"Previous: ...{prev_text[-80:]}" if len(prev_text) > 80 else f"Previous: {prev_text}")
            if next_segment:
                next_text = next_segment.edited_text or next_segment.original_text
                surrounding.append(f"Next: {next_text[:80]}..." if len(next_text) > 80 else f"Next: {next_text}")

            if surrounding:
                context_parts.append(" ".join(surrounding))

        context = " | ".join(context_parts) if context_parts else ""

        # Get project_id from segment
        project_id = segment.audio_file.project_id if segment.audio_file else None

        try:
            # Perform correction
            result = await llm_service.correct_text(
                text=text_to_correct,
                provider=request.provider,
                context=context,
                correction_type=request.correction_type,
                segment_id=segment.id,
                project_id=project_id
            )

            results.append(CorrectionResponse(
                segment_id=segment.id,
                original_text=result["original_text"],
                corrected_text=result["corrected_text"],
                changes=result["changes"],
                confidence=result["confidence"]
            ))

        except Exception as e:
            # Continue with other segments even if one fails
            results.append(CorrectionResponse(
                segment_id=segment.id,
                original_text=text_to_correct,
                corrected_text=text_to_correct,
                changes=[f"Error: {str(e)}"],
                confidence=0.0
            ))

    return results


@router.get("/providers", response_model=List[ProviderInfo])
async def list_providers() -> List[ProviderInfo]:
    """
    List available LLM providers.

    Returns:
        List of provider names and availability status
    """
    llm_service = LLMService()
    provider_names = llm_service.list_providers()

    return [
        ProviderInfo(name=name, available=True)
        for name in provider_names
    ]


@router.get("/health", response_model=Dict[str, bool])
async def health_check() -> Dict[str, bool]:
    """
    Check health status of all LLM providers.
    
    Returns:
        Dictionary mapping provider names to health status
    """
    llm_service = LLMService()
    return await llm_service.health_check_all()


@router.get("/models/{provider}", response_model=List[str])
async def list_models(provider: str) -> List[str]:
    """
    List available models for a provider.
    
    Args:
        provider: Provider name (ollama, openrouter)
    
    Returns:
        List of available model names
    """
    llm_service = LLMService()
    return await llm_service.list_models(provider)


@router.get("/models/{provider}/{model}/check")
async def check_model(provider: str, model: str) -> Dict[str, bool]:
    """
    Check if a specific model is available for a provider.
    
    Args:
        provider: Provider name
        model: Model name
    
    Returns:
        Dictionary with availability status
    """
    llm_service = LLMService()
    available = await llm_service.check_model_availability(provider, model)
    return {"available": available}
