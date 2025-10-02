"""
OpenRouter LLM provider for cloud inference.
"""
import httpx
from typing import Dict, Any
from .base import LLMProvider


class OpenRouterProvider(LLMProvider):
    """OpenRouter provider for cloud LLM inference."""

    def __init__(self, api_key: str, model: str = "anthropic/claude-3-haiku"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://openrouter.ai/api/v1"
        self.timeout = 30.0

    async def correct_text(
        self,
        text: str,
        context: str = "",
        correction_type: str = "grammar"
    ) -> Dict[str, Any]:
        """
        Correct text using OpenRouter.

        Args:
            text: Text to correct
            context: Optional context
            correction_type: Type of correction

        Returns:
            Correction results
        """
        prompt = self._build_prompt(text, context, correction_type)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1000,
                    }
                )
                response.raise_for_status()

                result = response.json()
                corrected_text = result["choices"][0]["message"]["content"].strip()

                # Parse to extract just the corrected text
                corrected_text = self._parse_correction(corrected_text, text)

                return {
                    "corrected_text": corrected_text,
                    "original_text": text,
                    "changes": self._detect_changes(text, corrected_text),
                    "confidence": 0.9  # OpenRouter models generally high confidence
                }

        except httpx.RequestError as e:
            raise ConnectionError(f"Failed to connect to OpenRouter: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"OpenRouter request failed: {str(e)}")
        except KeyError as e:
            raise RuntimeError(f"Unexpected OpenRouter response format: {str(e)}")

    async def health_check(self) -> bool:
        """Check if OpenRouter API is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                return response.status_code == 200
        except Exception:
            return False

    def _build_prompt(self, text: str, context: str, correction_type: str) -> str:
        """Build the correction prompt."""
        correction_instructions = {
            "grammar": "Fix any grammatical errors",
            "spelling": "Fix any spelling errors",
            "punctuation": "Fix punctuation errors",
            "all": "Fix spelling, grammar, and punctuation errors"
        }

        instruction = correction_instructions.get(correction_type, correction_instructions["all"])

        prompt = f"""You are a professional text editor. {instruction} in the following text from an audio transcription.

Rules:
1. Only fix errors, do not rephrase or change the meaning
2. Preserve the original style and tone
3. Do not add explanations or comments
4. Return ONLY the corrected text, nothing else

"""
        if context:
            prompt += f"Context: {context}\n\n"

        prompt += f"Text to correct:\n{text}\n\nCorrected text:"

        return prompt

    def _parse_correction(self, llm_response: str, original: str) -> str:
        """Parse the LLM response to extract just the corrected text."""
        lines = llm_response.strip().split('\n')

        cleaned_lines = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith(("Here", "I ", "The corrected", "Corrected:")):
                continue
            cleaned_lines.append(line)

        corrected = ' '.join(cleaned_lines) if cleaned_lines else llm_response.strip()

        if not corrected or len(corrected) < len(original) * 0.5:
            return original

        return corrected

    def _detect_changes(self, original: str, corrected: str) -> list:
        """Detect specific changes between original and corrected text."""
        if original == corrected:
            return []

        changes = []
        orig_words = original.split()
        corr_words = corrected.split()

        if len(orig_words) != len(corr_words):
            changes.append(f"Word count changed from {len(orig_words)} to {len(corr_words)}")
        else:
            for i, (orig, corr) in enumerate(zip(orig_words, corr_words)):
                if orig != corr:
                    changes.append(f'"{orig}" → "{corr}"')

        return changes[:5]
