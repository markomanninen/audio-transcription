"""
Ollama LLM provider for local and external inference.
"""
import httpx
import json
import time
import logging
from typing import Dict, Any, Optional
from .base import LLMProvider
from .prompts import PromptBuilder

logger = logging.getLogger(__name__)


class OllamaProvider(LLMProvider):
    """Ollama provider for local or external LLM inference."""

    def __init__(
        self, 
        base_url: str = "http://ollama:11434", 
        model: str = "llama3.2:1b", 
        timeout: int = 30,
        api_key: Optional[str] = None,
        verify_ssl: bool = True,
        external: bool = False,
        db=None
    ):
        self.base_url = base_url.rstrip('/')  # Remove trailing slash
        self.model = model
        self.timeout = float(timeout)
        self.api_key = api_key
        self.verify_ssl = verify_ssl
        self.external = external
        self.db = db  # Optional database session for logging
        
        # Prepare headers for external services
        self.headers = {}
        if self.api_key:
            self.headers['Authorization'] = f'Bearer {self.api_key}'

    async def correct_text(
        self,
        text: str,
        context: str = "",
        correction_type: str = "grammar",
        segment_id: Optional[int] = None,
        project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Correct text using Ollama with logging."""
        logger.debug(f"🦙 OllamaProvider.correct_text: timeout={self.timeout}s")
        
        prompt = PromptBuilder.build_correction_prompt(text, context, correction_type)
        start_time = time.time()

        try:
            # Configure HTTP client with total timeout
            logger.debug(f"🌐 Setting httpx timeout to {self.timeout} seconds")
            client_kwargs = {
                'timeout': self.timeout,  # Total timeout for the entire request
                'verify': self.verify_ssl,
                'headers': self.headers
            }
            
            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "top_p": 0.9,
                        }
                    }
                )
                response.raise_for_status()

                result = response.json()
                raw_response = result.get("response", "").strip()
                corrected_text = self._parse_correction(raw_response, text)

                duration_ms = (time.time() - start_time) * 1000

                logger.debug(f"✅ Ollama request completed in {duration_ms:.0f}ms")

                # Log successful request
                self._log_request(
                    prompt=prompt,
                    response=raw_response,
                    original_text=text,
                    context=context,
                    corrected_text=corrected_text,
                    duration_ms=duration_ms,
                    segment_id=segment_id,
                    project_id=project_id,
                    status="success"
                )

                return {
                    "corrected_text": corrected_text,
                    "original_text": text,
                    "changes": self._detect_changes(text, corrected_text),
                    "confidence": 0.85
                }

        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"❌ Ollama request failed after {duration_ms:.0f}ms: {e}")
            
            # Log failed request
            self._log_request(
                prompt=prompt,
                response=str(e),
                original_text=text,
                context=context,
                corrected_text=text,  # Return original on error
                duration_ms=duration_ms,
                segment_id=segment_id,
                project_id=project_id,
                status="error"
            )
            
            raise ConnectionError(f"Ollama request failed: {e}")

            # Log error
            self._log_request(
                prompt=prompt,
                response="",
                original_text=text,
                context=context,
                duration_ms=duration_ms,
                segment_id=segment_id,
                project_id=project_id,
                status="error",
                error_message=str(e)
            )

            if isinstance(e, httpx.RequestError):
                raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
            else:
                raise RuntimeError(f"Ollama request failed: {str(e)}")

    async def generate_text(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        project_id: Optional[int] = None
    ) -> str:
        """Generate text using Ollama with a generic prompt."""
        start_time = time.time()
        options = {
            "temperature": temperature,
        }
        if max_tokens != 2048:
             options["num_predict"] = max_tokens

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": options
                    }
                )
                response.raise_for_status()

                result = response.json()
                generated_text = result.get("response", "").strip()
                duration_ms = (time.time() - start_time) * 1000

                self._log_request(
                    prompt=prompt,
                    response=generated_text,
                    duration_ms=duration_ms,
                    project_id=project_id,
                    status="success",
                    operation="generate_text"
                )

                return generated_text

        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            duration_ms = (time.time() - start_time) * 1000
            self._log_request(
                prompt=prompt,
                response="",
                duration_ms=duration_ms,
                project_id=project_id,
                status="error",
                error_message=str(e),
                operation="generate_text"
            )
            if isinstance(e, httpx.RequestError):
                raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
            else:
                raise RuntimeError(f"Ollama request failed: {str(e)}")

    def _log_request(
        self,
        prompt: str,
        response: str,
        original_text: str = "",
        context: str = "",
        corrected_text: str = "",
        duration_ms: float = 0,
        segment_id: int = None,
        project_id: int = None,
        status: str = "success",
        error_message: str = None,
        operation: str = "correct_text"
    ):
        """Log LLM request/response to database."""
        if not self.db:
            return

        try:
            from ...models.llm_log import LLMLog

            log_entry = LLMLog(
                provider="ollama",
                model=self.model,
                operation=operation,
                prompt=prompt,
                original_text=original_text,
                context=context,
                response=response,
                corrected_text=corrected_text,
                status=status,
                error_message=error_message,
                duration_ms=duration_ms,
                segment_id=segment_id,
                project_id=project_id
            )
            self.db.add(log_entry)
            self.db.commit()
        except Exception as e:
            # Don't fail the request if logging fails
            logger.warning(f"Failed to log LLM request: {e}")

    async def health_check(self) -> bool:
        """Check if Ollama is available (local or external)."""
        try:
            # Configure HTTP client for external services
            client_kwargs = {
                'timeout': 5.0,
                'verify': self.verify_ssl,
                'headers': self.headers
            }
            
            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception as e:
            # Log the error for debugging external service issues
            if self.external:
                logger.warning(f"External Ollama health check failed ({self.base_url}): {e}")
            return False

    async def list_models(self) -> list:
        """List available models from Ollama."""
        try:
            # Configure HTTP client for external services
            client_kwargs = {
                'timeout': 5.0,
                'verify': self.verify_ssl,
                'headers': self.headers
            }
            
            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                
                data = response.json()
                models = data.get('models', [])
                return [model.get('name', '') for model in models if model.get('name')]
        except Exception as e:
            if self.external:
                logger.warning(f"External Ollama model listing failed ({self.base_url}): {e}")
            return []

    async def check_model_availability(self, model: str) -> bool:
        """Check if a specific model is available."""
        available_models = await self.list_models()
        return model in available_models

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
