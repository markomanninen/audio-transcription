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

    def __init__(self, db=None):
        self._providers: Dict[str, LLMProvider] = {}
        self.db = db
        self._initialize_providers()

    def _initialize_providers(self):
        """Initialize available LLM providers."""
        # Always add Ollama (local or external)
        try:
            self._providers['ollama'] = OllamaProvider(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                timeout=settings.OLLAMA_TIMEOUT,
                api_key=settings.OLLAMA_API_KEY if settings.OLLAMA_API_KEY else None,
                verify_ssl=settings.OLLAMA_VERIFY_SSL,
                external=settings.OLLAMA_EXTERNAL,
                db=self.db
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

    def _create_provider_with_model(self, provider: str, model: Optional[str] = None, timeout: Optional[int] = None) -> Optional[LLMProvider]:
        """Create a provider instance with a specific model and/or timeout."""
        
        if provider == "ollama":
            final_timeout = timeout or settings.OLLAMA_TIMEOUT
            
            return OllamaProvider(
                base_url=settings.OLLAMA_BASE_URL,
                model=model or settings.OLLAMA_MODEL,  # Use provided model or default
                timeout=final_timeout,
                api_key=settings.OLLAMA_API_KEY if settings.OLLAMA_API_KEY else None,
                verify_ssl=settings.OLLAMA_VERIFY_SSL,
                external=settings.OLLAMA_EXTERNAL,
                db=self.db
            )
        elif provider == "openrouter":
            openrouter_key = getattr(settings, 'OPENROUTER_API_KEY', None)
            if openrouter_key:
                return OpenRouterProvider(
                    api_key=openrouter_key,
                    model=model or getattr(settings, 'OPENROUTER_MODEL', 'meta-llama/llama-3.2-1b-instruct:free'),
                    timeout=timeout or 30,  # Use provided timeout or default to 30
                    db=self.db
                )
        return None

    async def correct_text(
        self,
        text: str,
        provider: str = "ollama",
        model: Optional[str] = None,
        context: str = "",
        correction_type: str = "all",
        segment_id: Optional[int] = None,
        project_id: Optional[int] = None,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Correct text using specified provider.

        Args:
            text: Text to correct
            provider: Provider to use ("ollama" or "openrouter")
            model: Optional specific model to use (overrides default)
            context: Optional context
            correction_type: Type of correction
            segment_id: Optional segment ID for logging
            project_id: Optional project ID for logging

        Returns:
            Correction results

        Raises:
            ValueError: If provider not found
            ConnectionError: If provider unavailable
        """
        # If a specific model is requested, create a new provider instance
        if model:
            llm_provider = self._create_provider_with_model(provider, model, timeout)
        elif timeout:
            # If timeout is specified but no model, create provider with timeout
            llm_provider = self._create_provider_with_model(provider, None, timeout)
        else:
            llm_provider = self.get_provider(provider)

        if not llm_provider:
            raise ValueError(f"Provider '{provider}' not available. Available: {self.list_providers()}")

        # Check health before attempting correction
        is_healthy = await llm_provider.health_check()
        if not is_healthy:
            raise ConnectionError(f"Provider '{provider}' is not responding")

        return await llm_provider.correct_text(
            text,
            context,
            correction_type,
            segment_id=segment_id,
            project_id=project_id
        )

    async def generate_text(
        self,
        prompt: str,
        provider: str = "ollama",
        project_id: Optional[int] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text using the specified provider.

        Args:
            prompt: The prompt to use for generation.
            provider: The provider to use.
            project_id: Optional project ID for logging.
            max_tokens: Maximum tokens for the response.
            temperature: The creativity of the response.

        Returns:
            The generated text.
        """
        llm_provider = self.get_provider(provider)

        if not llm_provider:
            raise ValueError(f"Provider '{provider}' not available. Available: {self.list_providers()}")

        is_healthy = await llm_provider.health_check()
        if not is_healthy:
            raise ConnectionError(f"Provider '{provider}' is not responding")

        # The `generate_text` method in providers may have different signatures.
        # We need to call it with the arguments it expects.
        # A more robust solution might inspect the signature, but for now we can handle it like this.
        if provider == "ollama":
            return await llm_provider.generate_text(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                project_id=project_id
            )
        else: # For openrouter and potentially others
             return await llm_provider.generate_text(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature
            )

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

    async def list_models(self, provider: str = "ollama") -> list:
        """
        List available models for a provider.

        Args:
            provider: Provider name

        Returns:
            List of available model names
        """
        llm_provider = self.get_provider(provider)
        if not llm_provider:
            return []
        
        # Check if provider has list_models method
        if hasattr(llm_provider, 'list_models'):
            return await llm_provider.list_models()
        
        return []

    async def check_model_availability(self, provider: str, model: str) -> bool:
        """
        Check if a model is available for a provider.

        Args:
            provider: Provider name
            model: Model name

        Returns:
            True if model is available
        """
        llm_provider = self.get_provider(provider)
        if not llm_provider:
            return False
        
        # Check if provider has check_model_availability method
        if hasattr(llm_provider, 'check_model_availability'):
            return await llm_provider.check_model_availability(model)
        
        return False
