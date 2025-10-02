"""
Base LLM provider interface.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def correct_text(
        self,
        text: str,
        context: str = "",
        correction_type: str = "grammar"
    ) -> Dict[str, Any]:
        """
        Correct text using LLM.

        Args:
            text: Text to correct
            context: Optional context (e.g., speaker name, previous segment)
            correction_type: Type of correction ("grammar", "spelling", "punctuation", "all")

        Returns:
            Dictionary with:
                - corrected_text: The corrected text
                - original_text: The original text
                - changes: List of specific changes made
                - confidence: Confidence score (0-1)
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the LLM provider is available and responding.

        Returns:
            True if healthy, False otherwise
        """
        pass
