"""
Ollama LLM provider for local inference.
"""
import httpx
import json
from typing import Dict, Any
from .base import LLMProvider
from .prompts import PromptBuilder


class OllamaProvider(LLMProvider):
    """Ollama provider for local LLM inference."""

    def __init__(self, base_url: str = "http://ollama:11434", model: str = "llama3.2:1b"):
        self.base_url = base_url
        self.model = model
        self.timeout = 30.0

    async def correct_text(
        self,
        text: str,
        context: str = "",
        correction_type: str = "grammar"
    ) -> Dict[str, Any]:
        """
        Correct text using Ollama.

        Args:
            text: Text to correct
            context: Optional context
            correction_type: Type of correction

        Returns:
            Correction results
        """
        prompt = PromptBuilder.build_correction_prompt(text, context, correction_type)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,  # Lower temperature for more deterministic corrections
                            "top_p": 0.9,
                        }
                    }
                )
                response.raise_for_status()

                result = response.json()
                corrected_text = result.get("response", "").strip()

                # Parse the response to extract just the corrected text
                corrected_text = self._parse_correction(corrected_text, text)

                return {
                    "corrected_text": corrected_text,
                    "original_text": text,
                    "changes": self._detect_changes(text, corrected_text),
                    "confidence": 0.85  # Ollama doesn't provide confidence scores
                }

        except httpx.RequestError as e:
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama request failed: {str(e)}")

    async def health_check(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    def _parse_correction(self, llm_response: str, original: str) -> str:
        """
        Parse the LLM response to extract just the corrected text.
        Sometimes LLMs add extra commentary or include context.
        """
        response = llm_response.strip()

        # Skip any lines that look like metadata or commentary
        lines = response.split('\n')
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            # Skip empty lines and common LLM artifacts
            if not line or line.startswith(("Here", "I ", "The corrected", "Corrected:", "Context:")):
                continue
            cleaned_lines.append(line)

        corrected = ' '.join(cleaned_lines) if cleaned_lines else response

        # If LLM included context, try to extract just the target segment
        # Look for the original text at the end of the response
        original_words = original.strip().split()
        if len(original_words) > 0:
            # Check if response ends with something similar to original
            response_words = corrected.split()

            # Try to find where the actual correction starts by matching word count
            # If word count is significantly larger, try to extract the last N words
            if len(response_words) > len(original_words) * 1.5:
                # LLM likely included context - take the portion that matches original length better
                # Look for the last sentence or phrase that's closer to original length
                for i in range(len(response_words)):
                    candidate = ' '.join(response_words[i:])
                    candidate_words = candidate.split()
                    # If this portion is within 50% of original length, use it
                    if abs(len(candidate_words) - len(original_words)) <= max(3, len(original_words) * 0.5):
                        corrected = candidate
                        break

        # If the correction is empty or way too different, return original
        if not corrected or len(corrected) < len(original) * 0.3:
            return original

        return corrected

    def _detect_changes(self, original: str, corrected: str) -> list:
        """
        Detect specific changes between original and corrected text.
        Returns a list of change descriptions.
        """
        if original == corrected:
            return []

        changes = []

        # Simple word-level diff
        orig_words = original.split()
        corr_words = corrected.split()

        if len(orig_words) != len(corr_words):
            changes.append(f"Word count changed from {len(orig_words)} to {len(corr_words)}")
        else:
            for i, (orig, corr) in enumerate(zip(orig_words, corr_words)):
                if orig != corr:
                    changes.append(f'"{orig}" → "{corr}"')

        # Limit to first 5 changes to avoid overwhelming output
        return changes[:5]
