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
    analysis_prompt = f"""You are an expert content analyzer. Analyze the transcribed audio and identify its content type.

CONTENT TYPES:
- lyrics: Song lyrics with verse/chorus structure, poetic language, repetition
- interview: Conversation, Q&A, dialogue between speakers
- academic: Formal lecture, research, educational content with technical terms
- literature: Story narration, book reading, fictional or narrative content
- media: Podcast, radio show, casual entertainment content
- presentation: Business talk, professional presentation, structured speech
- general: Default for unclear or mixed content

SAMPLE TEXT:
{sample_content[:800]}

PROJECT INFO:
Name: {project.name}
Current Description: {project.description or "None"}

ANALYSIS RULES:
1. Choose the type that BEST matches the content characteristics
2. Be CONSISTENT: If reasoning says "lyrics", content_type MUST be "lyrics"
3. Confidence 0.9+ only if very clear, 0.7-0.8 if likely, 0.5-0.6 if uncertain
4. Keep description factual and concise (1-2 sentences)

OUTPUT (JSON only):
{{
    "content_type": "<exact type from list above>",
    "confidence": <0.5-1.0>,
    "reasoning": "<why this type matches the content>",
    "suggested_description": "<what this transcription contains>"
}}"""

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

        # Validate and correct inconsistencies
        content_type = analysis.get("content_type", "general")
        reasoning = analysis.get("reasoning", "").lower()

        print(f"[DEBUG] Original content_type: {content_type}")
        print(f"[DEBUG] Reasoning: {reasoning}")

        # Check for type mentions in reasoning - prioritize most specific matches
        # Use weighted scoring: some keywords are stronger indicators than others
        type_keywords = {
            "lyrics": [
                ("lyrics", 3), ("song lyrics", 3), ("verse/chorus", 3),
                ("verse", 2), ("chorus", 2), ("refrain", 2),
                ("poetic", 1), ("repetition", 1)
            ],
            "interview": [
                ("interview", 3), ("q&a", 3), ("conversation", 2),
                ("dialogue", 2), ("speakers discussing", 2)
            ],
            "academic": [
                ("academic", 3), ("lecture", 3), ("research", 2),
                ("educational", 2), ("scholarly", 2)
            ],
            "literature": [
                ("fiction", 3), ("novel", 3), ("story", 2),
                ("tale", 2), ("book reading", 2)
                # Removed "narrative flow" as it's too ambiguous
            ],
            "media": [
                ("podcast", 3), ("radio show", 3), ("broadcast", 2),
                ("show", 1)
            ],
            "presentation": [
                ("presentation", 3), ("business talk", 2),
                ("professional speech", 2)
            ]
        }

        # Calculate weighted scores for each type
        match_scores = {}
        for type_name, keyword_weights in type_keywords.items():
            score = sum(weight for keyword, weight in keyword_weights if keyword in reasoning)
            if score > 0:
                match_scores[type_name] = score

        print(f"[DEBUG] Weighted match scores: {match_scores}")

        # If we have matches, use the type with highest weighted score
        if match_scores:
            best_match = max(match_scores.items(), key=lambda x: x[1])
            # Use matched type if score >= 2 (indicating strong match)
            if best_match[1] >= 2:
                content_type = best_match[0]
                print(f"[DEBUG] Corrected to: {content_type} (weighted score: {best_match[1]})")

        print(f"[DEBUG] Final content_type: {content_type}")

        return ProjectAnalysisResponse(
            suggested_content_type=content_type,
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
