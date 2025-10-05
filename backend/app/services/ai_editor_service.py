"""
Service for advanced AI-powered text editing features.
"""
from typing import Dict, Any, Optional
import json

from .llm.llm_service import LLMService
from .llm.prompts import PromptBuilder
from ..models.project import Project
from sqlalchemy.orm import Session

class AIEditorService:
    """
    A service for handling advanced AI-driven text transformations.
    """

    def __init__(self, db: Session, llm_service: LLMService):
        self.db = db
        self.llm_service = llm_service

    async def _execute_task(
        self,
        prompt: str,
        provider: str,
        project_id: int,
        response_format: str = "text"
    ) -> Dict[str, Any]:
        """A helper to execute a task using the LLM provider."""
        if not self.llm_service.get_provider(provider):
            raise ValueError(f"Provider '{provider}' not available.")

        result = await self.llm_service.generate_text(
            prompt=prompt,
            provider=provider,
            project_id=project_id,
        )

        if response_format == "json":
            try:
                # Clean the response to ensure it's valid JSON
                json_str = result.strip().replace("```json", "").replace("```", "")
                return json.loads(json_str)
            except json.JSONDecodeError:
                raise ValueError("Failed to decode LLM response as JSON.")

        return {"result": result}

    async def semantic_reconstruction(
        self, text: str, provider: str, project_id: int
    ) -> Dict[str, Any]:
        """
        (R4) Corrects unclear words, colloquialisms, and dialects.
        """
        prompt = PromptBuilder.build_semantic_reconstruction_prompt(text)
        return await self._execute_task(prompt, provider, project_id)

    async def style_generation(
        self, text: str, target_style: str, provider: str, project_id: int
    ) -> Dict[str, Any]:
        """
        (R5) Modifies the text to a specific target style.
        """
        prompt = PromptBuilder.build_style_generation_prompt(text, target_style)
        return await self._execute_task(prompt, provider, project_id)

    async def nlp_analysis(
        self, text: str, provider: str, project_id: int
    ) -> Dict[str, Any]:
        """
        (R6) Produces a summary, identifies themes, and structures content.
        """
        prompt = PromptBuilder.build_nlp_analysis_prompt(text)
        return await self._execute_task(prompt, provider, project_id, response_format="json")

    async def fact_checking(
        self, text: str, domain: str, provider: str, project_id: int
    ) -> Dict[str, Any]:
        """
        (R7) Checks terminology, facts, and names against a specific domain.
        """
        prompt = PromptBuilder.build_fact_checking_prompt(text, domain)
        return await self._execute_task(prompt, provider, project_id, response_format="json")

    async def technical_check(
        self, text_with_metadata: str, target_format: str, provider: str, project_id: int
    ) -> Dict[str, Any]:
        """
        (R8) Generates a file in a specific format like SRT or VTT.
        """
        prompt = PromptBuilder.build_technical_check_prompt(text_with_metadata, target_format)
        return await self._execute_task(prompt, provider, project_id)