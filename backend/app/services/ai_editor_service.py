"""
Service for advanced AI-powered text editing features.
"""
from typing import Dict, Any
import json

from .llm.llm_service import LLMService
from .llm.prompts import PromptBuilder
from sqlalchemy.orm import Session

class AIEditorService:
    """
    A service for handling advanced AI-driven text transformations.
    """

    def __init__(self, db: Session, llm_service: LLMService):
        self.db = db
        self.llm_service = llm_service

    @staticmethod
    def _strip_markdown_fence(text: str) -> str:
        stripped = text.strip()
        if stripped.startswith("```"):
            stripped = stripped.split("\n", 1)[1] if "\n" in stripped else ""
        if stripped.endswith("```"):
            stripped = stripped.rsplit("\n", 1)[0]
        return stripped.strip()

    @staticmethod
    def _clean_plain_text(text: str) -> str:
        cleaned = AIEditorService._strip_markdown_fence(text).lstrip()
        lower = cleaned.lower()
        prefixes = [
            "here is the reconstructed text:",
            "here's the reconstructed text:",
            "reconstructed text:",
            "here is the text rewritten in",
            "here is the rewritten text:",
            "rewritten text:",
        ]
        for prefix in prefixes:
            if lower.startswith(prefix):
                cleaned = cleaned[len(prefix):].lstrip()
                lower = cleaned.lower()
                break

        filtered_lines = []
        skip_markers = {
            "---",
            "```",
            "reconstructed text:",
            "here is the reconstructed text:",
            "here's the reconstructed text:",
            "here is the text rewritten in",
            "here is the rewritten text:",
            "rewritten text:",
        }
        for line in cleaned.splitlines():
            stripped = line.strip()
            if stripped.lower() in skip_markers:
                continue
            filtered_lines.append(line.rstrip())

        collapsed = "\n".join(filtered_lines).strip()
        return collapsed

    @staticmethod
    def _clean_formatted_output(text: str) -> str:
        cleaned = AIEditorService._strip_markdown_fence(text)
        lines = [line.rstrip() for line in cleaned.splitlines()]
        result = "\n".join(lines).strip("\n")
        return result

    async def _execute_task(
        self,
        prompt: str,
        provider: str,
        project_id: int,
        response_format: str = "text",
        text_sanitiser=None
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
                cleaned = result.strip()
                start = cleaned.find("{")
                end = cleaned.rfind("}")
                if start != -1 and end != -1 and end > start:
                    candidate = cleaned[start:end + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        pass
                raise ValueError("Failed to decode LLM response as JSON.")

        if text_sanitiser:
            cleaned = text_sanitiser(result)
        else:
            cleaned = result.strip()

        if text_sanitiser:
            refusal_window = cleaned.lower()[:200]
            refusal_indicators = [
                "i cannot provide",
                "i cannot write",
                "i can't provide",
                "i can't write",
                "i cannot fulfill",
                "i can't fulfill",
                "i am unable to",
                "i'm unable to",
                "unable to comply",
                "cannot comply",
                "is there anything else i can help you with",
                "can i help you with anything else",
            ]
            if any(indicator in refusal_window for indicator in refusal_indicators):
                raise ValueError("LLM refusal: non-compliant response")

        return {"result": cleaned}

    async def semantic_reconstruction(
        self, text: str, provider: str, project_id: int
    ) -> Dict[str, Any]:
        """
        (R4) Corrects unclear words, colloquialisms, and dialects.
        """
        prompt = PromptBuilder.build_semantic_reconstruction_prompt(text)
        return await self._execute_task(
            prompt,
            provider,
            project_id,
            text_sanitiser=self._clean_plain_text,
        )

    async def style_generation(
        self, text: str, target_style: str, provider: str, project_id: int
    ) -> Dict[str, Any]:
        """
        (R5) Modifies the text to a specific target style.
        """
        prompt = PromptBuilder.build_style_generation_prompt(text, target_style)
        return await self._execute_task(
            prompt,
            provider,
            project_id,
            text_sanitiser=self._clean_plain_text,
        )

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
        return await self._execute_task(
            prompt,
            provider,
            project_id,
            text_sanitiser=self._clean_formatted_output,
        )
