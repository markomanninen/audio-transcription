"""
API endpoints for the AI-powered text editor.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Dict, Any

from ..core.database import get_db
from ..services.ai_editor_service import AIEditorService
from ..services.llm.llm_service import LLMService

router = APIRouter(prefix="/api/ai_editor", tags=["ai_editor"])

# --- Request Models ---

class BaseEditorRequest(BaseModel):
    text: str = Field(..., description="The full text to be processed.")
    project_id: int = Field(..., description="The ID of the project this text belongs to.")
    provider: str = Field("ollama", description="The LLM provider to use.")

class StyleGenerationRequest(BaseModel):
    text: str = Field(..., description="The full text to be processed.")
    project_id: int = Field(..., description="The ID of the project this text belongs to.")
    provider: str = Field("ollama", description="The LLM provider to use.")
    target_style: str = Field(..., description="The target style for the text (e.g., 'scientific', 'blog').")

class FactCheckingRequest(BaseModel):
    text: str = Field(..., description="The full text to be processed.")
    project_id: int = Field(..., description="The ID of the project this text belongs to.")
    provider: str = Field("ollama", description="The LLM provider to use.")
    domain: str = Field("general knowledge", description="The domain for fact-checking (e.g., 'history', 'physics').")

class TechnicalCheckRequest(BaseModel):
    text_with_metadata: str = Field(..., description="The text with metadata (timestamps, speakers).")
    project_id: int = Field(..., description="The ID of the project this text belongs to.")
    provider: str = Field("ollama", description="The LLM provider to use.")
    target_format: str = Field(..., description="The target format for the output (e.g., 'srt', 'vtt').")

# --- Helper for Service Initialization ---

def get_ai_editor_service(db: Session = Depends(get_db)) -> AIEditorService:
    """Dependency injector for the AIEditorService."""
    llm_service = LLMService(db=db)
    return AIEditorService(db=db, llm_service=llm_service)

# --- API Endpoints ---

@router.post("/semantic-reconstruction", response_model=Dict[str, Any])
async def semantic_reconstruction(
    request: BaseEditorRequest,
    service: AIEditorService = Depends(get_ai_editor_service)
):
    """(R4) Run semantic reconstruction on the text."""
    try:
        result = await service.semantic_reconstruction(
            text=request.text,
            provider=request.provider,
            project_id=request.project_id
        )
        return result
    except (ValueError, ConnectionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.post("/style-generation", response_model=Dict[str, Any])
async def style_generation(
    request: StyleGenerationRequest,
    service: AIEditorService = Depends(get_ai_editor_service)
):
    """(R5) Run style generation on the text."""
    try:
        result = await service.style_generation(
            text=request.text,
            target_style=request.target_style,
            provider=request.provider,
            project_id=request.project_id
        )
        return result
    except (ValueError, ConnectionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.post("/nlp-analysis", response_model=Dict[str, Any])
async def nlp_analysis(
    request: BaseEditorRequest,
    service: AIEditorService = Depends(get_ai_editor_service)
):
    """(R6) Run NLP analysis on the text."""
    try:
        result = await service.nlp_analysis(
            text=request.text,
            provider=request.provider,
            project_id=request.project_id
        )
        return result
    except (ValueError, ConnectionError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.post("/fact-checking", response_model=Dict[str, Any])
async def fact_checking(
    request: FactCheckingRequest,
    service: AIEditorService = Depends(get_ai_editor_service)
):
    """(R7) Run fact-checking on the text."""
    try:
        result = await service.fact_checking(
            text=request.text,
            domain=request.domain,
            provider=request.provider,
            project_id=request.project_id
        )
        return result
    except (ValueError, ConnectionError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.post("/technical-check", response_model=Dict[str, Any])
async def technical_check(
    request: TechnicalCheckRequest,
    service: AIEditorService = Depends(get_ai_editor_service)
):
    """(R8) Run technical format check on the text."""
    try:
        result = await service.technical_check(
            text_with_metadata=request.text_with_metadata,
            target_format=request.target_format,
            provider=request.provider,
            project_id=request.project_id
        )
        return result
    except (ValueError, ConnectionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")