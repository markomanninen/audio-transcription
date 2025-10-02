"""
LLM service for managing text corrections.
"""
from typing import Dict, Any, Optional
from .base import LLMProvider
from .ollama_provider import OllamaProvider
from .openrouter_provider import OpenRouterProvider
from ...core.config import settings


class LLMService:
    """Service for managing LLM providers and text corrections."""

    def __init__(self):
        self._providers: Dict[str, LLMProvider] = {}
        self._initialize_providers()

    def _initialize_providers(self):
        """Initialize available LLM providers."""
        # Always add Ollama (local)
        try:
            ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://ollama:11434')
            ollama_model = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:1b')
            self._providers['ollama'] = OllamaProvider(
                base_url=ollama_url,
                model=ollama_model
            )
        except Exception as e:
            print(f"Warning: Could not initialize Ollama provider: {e}")

        # Add OpenRouter if API key is available
        openrouter_key = getattr(settings, 'OPENROUTER_API_KEY', None)
        if openrouter_key:
            try:
                openrouter_model = getattr(settings, 'OPENROUTER_MODEL', 'anthropic/claude-3-haiku')
                self._providers['openrouter'] = OpenRouterProvider(
                    api_key=openrouter_key,
                    model=openrouter_model
                )
            except Exception as e:
                print(f"Warning: Could not initialize OpenRouter provider: {e}")

    def get_provider(self, provider_name: str = "ollama") -> Optional[LLMProvider]:
        """
        Get a specific LLM provider.

        Args:
            provider_name: Name of provider ("ollama" or "openrouter")

        Returns:
            LLM provider instance or None
        """
        return self._providers.get(provider_name)

    def list_providers(self) -> list:
        """List available providers."""
        return list(self._providers.keys())

    async def correct_text(
        self,
        text: str,
        provider: str = "ollama",
        context: str = "",
        correction_type: str = "all"
    ) -> Dict[str, Any]:
        """
        Correct text using specified provider.

        Args:
            text: Text to correct
            provider: Provider to use ("ollama" or "openrouter")
            context: Optional context
            correction_type: Type of correction

        Returns:
            Correction results

        Raises:
            ValueError: If provider not found
            ConnectionError: If provider unavailable
        """
        llm_provider = self.get_provider(provider)

        if not llm_provider:
            raise ValueError(f"Provider '{provider}' not available. Available: {self.list_providers()}")

        # Check health before attempting correction
        is_healthy = await llm_provider.health_check()
        if not is_healthy:
            raise ConnectionError(f"Provider '{provider}' is not responding")

        return await llm_provider.correct_text(text, context, correction_type)

    async def health_check_all(self) -> Dict[str, bool]:
        """
        Check health of all providers.

        Returns:
            Dictionary mapping provider names to health status
        """
        results = {}
        for name, provider in self._providers.items():
            try:
                results[name] = await provider.health_check()
            except Exception:
                results[name] = False
        return results
