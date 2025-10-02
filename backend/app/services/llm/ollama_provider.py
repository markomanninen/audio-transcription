"""
Ollama LLM provider for local inference.
"""
import httpx
import json
from typing import Dict, Any
from .base import LLMProvider


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
        prompt = self._build_prompt(text, context, correction_type)

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

    def _build_prompt(self, text: str, context: str, correction_type: str) -> str:
        """Build the correction prompt with context awareness."""
        correction_instructions = {
            "grammar": "Fix any grammatical errors",
            "spelling": "Fix any spelling errors",
            "punctuation": "Fix punctuation errors",
            "all": "Fix spelling, grammar, and punctuation errors"
        }

        instruction = correction_instructions.get(correction_type, correction_instructions["all"])

        # Detect content type from context or text characteristics
        content_type = self._detect_content_type(context, text)
        style_guide = self._get_style_guide(content_type)

        prompt = f"""You are a professional text editor. {instruction} in the following text from an audio transcription.

Content Type: {content_type}

{style_guide}

General Rules:
1. Only fix errors, do not rephrase or change the meaning
2. Preserve the original style and tone
3. Do not add explanations or comments
4. Return ONLY the corrected text, nothing else

"""
        if context:
            prompt += f"Context: {context}\n\n"

        prompt += f"Text to correct:\n{text}\n\nCorrected text:"

        return prompt

    def _detect_content_type(self, context: str, text: str) -> str:
        """Detect the type of content being corrected."""
        context_lower = context.lower() if context else ""
        text_lower = text.lower()

        # Check for explicit content type markers
        if any(keyword in context_lower for keyword in ["lyrics", "song", "music"]):
            return "lyrics"
        elif any(keyword in context_lower for keyword in ["academic", "research", "paper", "thesis"]):
            return "academic"
        elif any(keyword in context_lower for keyword in ["interview", "conversation", "discussion"]):
            return "interview"
        elif any(keyword in context_lower for keyword in ["ebook", "book", "novel", "story"]):
            return "literature"
        elif any(keyword in context_lower for keyword in ["show", "podcast", "broadcast"]):
            return "media"
        elif any(keyword in context_lower for keyword in ["lecture", "presentation", "talk"]):
            return "presentation"

        # Heuristic detection based on text characteristics
        if text.count("\n") > 3 and len(text.split()) < 50:  # Short lines, few words = likely lyrics
            return "lyrics"
        elif any(word in text_lower for word in ["therefore", "however", "furthermore", "consequently"]):
            return "academic"

        # Default to general transcription
        return "general transcription"

    def _get_style_guide(self, content_type: str) -> str:
        """Get style-specific correction guidelines."""
        style_guides = {
            "lyrics": """Style Guide for Lyrics:
- Preserve line breaks and verse structure
- Allow poetic license and intentional grammar deviations
- Keep repetitions and refrains intact
- Maintain rhyme schemes where present
- Fix only obvious spelling errors, not stylistic choices""",

            "academic": """Style Guide for Academic Text:
- Use formal language and proper terminology
- Ensure logical connectors are correct (however, therefore, etc.)
- Fix citation format inconsistencies
- Maintain technical vocabulary accurately
- Use complete sentences and proper punctuation""",

            "interview": """Style Guide for Interview/Conversation:
- Preserve conversational tone and natural speech patterns
- Keep filler words if they add meaning (umm, well, you know)
- Fix only clear errors, not colloquialisms
- Maintain speaker's voice and personality
- Allow incomplete sentences if contextually clear""",

            "literature": """Style Guide for Literature/Books:
- Maintain narrative voice and style
- Preserve author's intentional stylistic choices
- Fix only clear spelling and grammar errors
- Keep dialogue natural and character-appropriate
- Respect paragraph structure and pacing""",

            "media": """Style Guide for Shows/Podcasts:
- Keep casual, engaging tone
- Preserve humor and personality
- Allow informal language where appropriate
- Fix technical errors but keep conversational flow
- Maintain energy and enthusiasm in text""",

            "presentation": """Style Guide for Lectures/Presentations:
- Use clear, professional language
- Fix technical terminology carefully
- Maintain educational tone
- Ensure logical flow between points
- Keep examples and explanations intact""",

            "general transcription": """Style Guide for General Transcription:
- Fix clear spelling and grammar errors
- Maintain natural speech patterns
- Preserve meaning and intent
- Use context to disambiguate homophones
- Keep the transcription accurate to the spoken word"""
        }

        return style_guides.get(content_type, style_guides["general transcription"])

    def _parse_correction(self, llm_response: str, original: str) -> str:
        """
        Parse the LLM response to extract just the corrected text.
        Sometimes LLMs add extra commentary.
        """
        # Remove common prefixes
        lines = llm_response.strip().split('\n')

        # Skip any lines that look like metadata or commentary
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            # Skip empty lines and common LLM artifacts
            if not line or line.startswith(("Here", "I ", "The corrected", "Corrected:")):
                continue
            cleaned_lines.append(line)

        corrected = ' '.join(cleaned_lines) if cleaned_lines else llm_response.strip()

        # If the correction is empty or too different, return original
        if not corrected or len(corrected) < len(original) * 0.5:
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
