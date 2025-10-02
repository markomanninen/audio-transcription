# LLM Services Architecture

Modular architecture for LLM-based text correction with multiple provider support.

## Overview

The LLM services provide AI-powered text corrections with:
- **Multiple providers**: Ollama (local) and OpenRouter (cloud)
- **Context awareness**: Adapts to content type (lyrics, academic, interview, etc.)
- **Surrounding context**: Includes previous and next segments
- **Unified interface**: Single `PromptBuilder` for all providers

## Architecture

```
llm/
├── base.py              # Abstract LLMProvider interface
├── prompts.py           # Shared PromptBuilder (single source of truth)
├── ollama_provider.py   # Local Ollama implementation
├── openrouter_provider.py  # Cloud OpenRouter implementation
└── llm_service.py       # Service manager & provider registry
```

## Components

### `prompts.py` - Shared Prompt Builder

**Purpose**: Single source of truth for all prompt logic and style guides.

**Key Class**: `PromptBuilder`

**Methods**:
```python
@staticmethod
def build_correction_prompt(text: str, context: str = "", correction_type: str = "all") -> str:
    """
    Build context-aware correction prompt.

    Args:
        text: Text to correct
        context: Context string (speaker, content type, prev/next segments)
        correction_type: "grammar", "spelling", "punctuation", or "all"

    Returns:
        Formatted prompt string
    """
```

**Prompt Structure**:
1. Role and instruction (based on correction_type)
2. Content type declaration (auto-detected or from context)
3. Style guide (content-specific guidelines)
4. Critical instructions (7 rules for LLM behavior)
5. Context (labeled as "for reference only")
6. Original text
7. Response request

**Content Types** (with detection logic):
- `lyrics`: Detected from keywords like "lyrics", "song", "verse/chorus" or text with many line breaks
- `academic`: Keywords like "academic", "research", "lecture" or formal language
- `interview`: Keywords like "interview", "conversation", "q&a"
- `literature`: Keywords like "book", "novel", "story"
- `media`: Keywords like "podcast", "show", "broadcast"
- `presentation`: Keywords like "lecture", "presentation", "talk"
- `general transcription`: Default fallback

**Style Guides**:

Each content type has specific correction guidelines:

```python
"lyrics": """
- Preserve line breaks and verse structure
- Allow poetic license and intentional grammar deviations
- Keep repetitions and refrains intact
- Maintain rhyme schemes where present
- Fix only obvious spelling errors, not stylistic choices
"""

"academic": """
- Use formal language and proper terminology
- Ensure logical connectors are correct (however, therefore, etc.)
- Fix citation format inconsistencies
- Maintain technical vocabulary accurately
- Use complete sentences and proper punctuation
"""

# ... 5 more style guides
```

### `base.py` - LLM Provider Interface

Abstract base class defining the contract all providers must implement:

```python
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def correct_text(
        self,
        text: str,
        context: str = "",
        correction_type: str = "grammar"
    ) -> Dict[str, Any]:
        """Correct text and return results."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is available."""
        pass
```

### `ollama_provider.py` - Local Ollama Provider

**Purpose**: Local inference using Ollama.

**Configuration**:
- **Base URL**: Default `http://ollama:11434`
- **Model**: Default `llama3.2:1b` (configurable)
- **Timeout**: 30 seconds

**Key Features**:
- No API key required
- Privacy-preserving (all data stays local)
- Fast for small models (<3B parameters)
- Uses `PromptBuilder.build_correction_prompt()`

**Response Parsing**:
```python
def _parse_correction(self, llm_response: str, original: str) -> str:
    """
    Parse LLM response to extract corrected text.

    - Removes commentary/greetings ("I'm ready to help", "Here is...")
    - Extracts text matching original length
    - Handles cases where LLM includes surrounding context
    - Falls back to original if parsing fails
    """
```

**Health Check**:
```python
async def health_check(self) -> bool:
    """Checks Ollama /api/tags endpoint."""
    try:
        response = await client.get(f"{self.base_url}/api/tags")
        return response.status_code == 200
    except:
        return False
```

### `openrouter_provider.py` - Cloud OpenRouter Provider

**Purpose**: Cloud inference using OpenRouter API.

**Configuration**:
- **Base URL**: `https://openrouter.ai/api/v1`
- **API Key**: Required (from environment or UI settings)
- **Model**: Default `anthropic/claude-3-haiku`

**Key Features**:
- Access to best commercial models (Claude, GPT-4, Gemini)
- Better accuracy for complex corrections
- Pay-per-use pricing
- Uses same `PromptBuilder` and parsing as Ollama

**API Call**:
```python
response = await client.post(
    f"{self.base_url}/chat/completions",
    headers={"Authorization": f"Bearer {self.api_key}"},
    json={
        "model": self.model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3
    }
)
```

### `llm_service.py` - Service Manager

**Purpose**: Manages multiple providers, health checks, and provider selection.

**Initialization**:
```python
class LLMService:
    def __init__(self):
        self._providers: Dict[str, LLMProvider] = {}
        self._initialize_providers()

    def _initialize_providers(self):
        # Always add Ollama
        self._providers['ollama'] = OllamaProvider(...)

        # Add OpenRouter if API key available
        if settings.OPENROUTER_API_KEY:
            self._providers['openrouter'] = OpenRouterProvider(...)
```

**Key Methods**:
- `get_provider(name)`: Get provider instance by name
- `list_providers()`: List all available provider names
- `health_check_all()`: Check health of all providers
- `correct_text(text, provider, context, correction_type)`: Delegate to provider

## Context Building

Context is built in `backend/app/api/ai_corrections.py` and passed to LLM providers:

```python
context_parts = []

# Add speaker
if segment.speaker:
    context_parts.append(f"Speaker: {segment.speaker.display_name}")

# Add content type
if segment.audio_file.project.content_type != "general":
    context_parts.append(f"Content type: {content_type}")

# Add surrounding segments (prev & next)
if prev_segment:
    prev_text = prev_segment.edited_text or prev_segment.original_text
    context_parts.append(f"Previous: ...{prev_text[-80:]}")

if next_segment:
    next_text = next_segment.edited_text or next_segment.original_text
    context_parts.append(f"Next: {next_text[:80]}...")

context = " | ".join(context_parts)
```

## Adding a New Provider

1. **Create provider file** `new_provider.py`:
```python
from .base import LLMProvider
from .prompts import PromptBuilder

class NewProvider(LLMProvider):
    async def correct_text(self, text, context="", correction_type="all"):
        # Build prompt using shared builder
        prompt = PromptBuilder.build_correction_prompt(text, context, correction_type)

        # Call your LLM API
        response = await your_api_call(prompt)

        # Parse response
        corrected = self._parse_correction(response, text)

        return {
            "corrected_text": corrected,
            "original_text": text,
            "changes": self._detect_changes(text, corrected),
            "confidence": 0.85
        }

    async def health_check(self):
        # Check if your API is available
        return True

    def _parse_correction(self, llm_response, original):
        # Extract just the corrected text
        pass

    def _detect_changes(self, original, corrected):
        # List specific changes
        pass
```

2. **Register in `llm_service.py`**:
```python
def _initialize_providers(self):
    # ... existing providers

    # Add your provider
    if settings.YOUR_API_KEY:
        self._providers['your_provider'] = NewProvider(
            api_key=settings.YOUR_API_KEY,
            model=settings.YOUR_MODEL
        )
```

3. **Update environment variables** in `backend/.env.example`:
```env
YOUR_PROVIDER_API_KEY=
YOUR_PROVIDER_MODEL=
```

4. **Restart backend**:
```bash
docker-compose restart backend
```

## Customizing Style Guides

Edit `backend/app/services/llm/prompts.py`:

```python
# In _get_style_guide() method, add new style:
"technical_documentation": """Style Guide for Technical Docs:
- Use precise technical terminology
- Maintain consistent formatting
- Preserve code snippets and commands exactly
- Fix only grammar/spelling, not technical content
- Keep imperative mood for instructions"""

# In _detect_content_type() method, add detection:
elif any(keyword in context_lower for keyword in ["technical", "documentation", "api", "code"]):
    return "technical_documentation"
```

## Testing

See `backend/tests/`:
- `test_ai_corrections.py`: Tests for correction endpoints
- `test_ai_analysis.py`: Tests for content analysis
- `test_prompts.py`: Tests for PromptBuilder

Run tests:
```bash
docker-compose exec backend pytest tests/test_ai_corrections.py -v
```

## Monitoring

Health check all providers:
```bash
curl http://localhost:8000/api/ai/health
```

Response:
```json
{
  "ollama": true,
  "openrouter": false
}
```

## Best Practices

1. **Always use PromptBuilder**: Don't create prompts directly in providers
2. **Parse responses carefully**: LLMs may include commentary or context
3. **Handle failures gracefully**: Return original text if correction fails
4. **Test with different models**: Results vary significantly by model
5. **Monitor costs**: Cloud providers charge per token
6. **Respect privacy**: Use Ollama for sensitive content

## Troubleshooting

**Ollama not responding**:
```bash
# Check if running
docker-compose ps ollama

# View logs
docker-compose logs ollama

# Pull model if missing
docker-compose exec ollama ollama pull llama3.2:1b
```

**OpenRouter errors**:
- Check API key is valid
- Verify model name is correct
- Check rate limits and credits

**Parsing issues**:
- Review debug logs in `_parse_correction()`
- Test prompt in Ollama CLI directly
- Adjust temperature (lower = more deterministic)
