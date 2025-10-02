"""
AI-powered project content analysis endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from ..core.database import get_db
from ..models.project import Project
from ..models.segment import Segment
from ..services.llm.llm_service import LLMService

router = APIRouter(prefix="/api/ai/analyze", tags=["ai-analysis"])


class ProjectAnalysisResponse(BaseModel):
    """Response model for project analysis."""
    suggested_content_type: str
    confidence: float
    reasoning: str
    suggested_description: Optional[str] = None


@router.post("/project/{project_id}", response_model=ProjectAnalysisResponse)
async def analyze_project(
    project_id: int,
    provider: str = "ollama",
    db: Session = Depends(get_db)
) -> ProjectAnalysisResponse:
    """
    Analyze project content and suggest content type and description.

    Args:
        project_id: Project ID to analyze
        provider: LLM provider to use
        db: Database session

    Returns:
        Analysis results with suggested content type and description

    Raises:
        HTTPException: If project not found or analysis fails
    """
    # Get project and its segments
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # Get sample of segments (first 10 for analysis)
    segments = db.query(Segment).join(Segment.audio_file).filter(
        Segment.audio_file.has(project_id=project_id)
    ).order_by(Segment.sequence).limit(10).all()

    if not segments:
        raise HTTPException(
            status_code=400,
            detail="No transcribed segments available for analysis. Please transcribe audio first."
        )

    # Build sample text from segments
    sample_texts = []
    for seg in segments:
        text = seg.edited_text or seg.original_text
        sample_texts.append(text)

    sample_content = " ".join(sample_texts)

    # Build analysis prompt
    analysis_prompt = f"""Analyze the following transcribed audio content and determine:
1. The most appropriate content type
2. A brief description of what this content is about

Content Types Available:
- general: General transcription (default for mixed or unclear content)
- interview: Interview or conversation between people
- lyrics: Song lyrics or musical content
- academic: Academic lecture, research presentation, or educational content
- literature: Book narration, storytelling, or literary content
- media: Podcast, radio show, or entertainment content
- presentation: Business presentation, talk, or professional lecture

Transcribed Content Sample:
{sample_content[:1000]}...

Current Project Name: {project.name}
Current Description: {project.description or "None"}

Respond in the following JSON format:
{{
    "content_type": "one of the types above",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of why you chose this type",
    "suggested_description": "a concise 1-2 sentence description of the content"
}}

Return ONLY valid JSON, no other text.
"""

    # Initialize LLM service
    llm_service = LLMService()

    try:
        # Get LLM provider
        llm_provider = llm_service.get_provider(provider)
        if not llm_provider:
            raise ValueError(f"Provider '{provider}' not available")

        # Check health
        is_healthy = await llm_provider.health_check()
        if not is_healthy:
            raise ConnectionError(f"Provider '{provider}' is not responding")

        # Call LLM for analysis
        # Use the provider's API directly for this custom prompt
        if provider == "ollama":
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{llm_provider.base_url}/api/generate",
                    json={
                        "model": llm_provider.model,
                        "prompt": analysis_prompt,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.3}
                    }
                )
                response.raise_for_status()
                result = response.json()
                llm_response = result.get("response", "").strip()
        else:  # openrouter
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{llm_provider.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {llm_provider.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": llm_provider.model,
                        "messages": [{"role": "user", "content": analysis_prompt}],
                        "temperature": 0.3,
                        "response_format": {"type": "json_object"}
                    }
                )
                response.raise_for_status()
                result = response.json()
                llm_response = result["choices"][0]["message"]["content"].strip()

        # Parse JSON response
        import json
        try:
            analysis = json.loads(llm_response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', llm_response, re.DOTALL)
            if json_match:
                analysis = json.loads(json_match.group(0))
            else:
                raise ValueError("Could not parse LLM response as JSON")

        return ProjectAnalysisResponse(
            suggested_content_type=analysis.get("content_type", "general"),
            confidence=float(analysis.get("confidence", 0.5)),
            reasoning=analysis.get("reasoning", "Analysis completed"),
            suggested_description=analysis.get("suggested_description")
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/project/{project_id}/apply")
async def apply_analysis(
    project_id: int,
    content_type: str,
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Apply suggested content type and description to project.

    Args:
        project_id: Project ID
        content_type: Content type to apply
        description: Description to apply (optional)
        db: Database session

    Returns:
        Updated project

    Raises:
        HTTPException: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    project.content_type = content_type
    if description:
        project.description = description

    db.commit()
    db.refresh(project)

    return {
        "id": project.id,
        "name": project.name,
        "content_type": project.content_type,
        "description": project.description,
        "updated": True
    }
