# Patch for correct_text method with logging
async def correct_text(
    self,
    text: str,
    context: str = "",
    correction_type: str = "grammar",
    segment_id = None,
    project_id = None
) -> Dict[str, Any]:
    """Correct text using Ollama with logging."""
    prompt = PromptBuilder.build_correction_prompt(text, context, correction_type)
    start_time = time.time()

    try:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
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
