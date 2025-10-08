# Documentation and Tests Update TODO

Generated: 2025-10-03

## Documentation Updates Needed

### 1. README.md

Add to "AI-Powered Corrections" section (line 58-73):

```markdown
- **AI Content Analysis** (NEW):
  - 🔍 Analyze project button for automatic content type detection
  - Analyzes first 10 segments to suggest content type
  - Provides confidence score and reasoning
  - Suggests project description
  - Weighted keyword scoring for accuracy
  - Visual explanations of how content type affects corrections

- **Surrounding Context** (NEW):
  - AI corrections now include previous and next segment text
  - Improves correction accuracy by understanding conversational flow
  - Automatically truncates context to 80 chars per segment
```

### 2. docs/AI_CONFIGURATION.md

**Section to Add** (after line 100):

```markdown
## AI Content Analysis

### Automatic Content Type Detection

The app can analyze your transcribed content and automatically suggest the best content type.

**How to use**:
1. Click the 🔍 button in the app header
2. Click "🔍 Analyze Content"
3. Review the suggested content type, confidence score, and reasoning
4. Click "✓ Apply & Use for Corrections" to set the content type

**How it works**:
- Analyzes first 10 segments of your transcription
- Uses weighted keyword scoring:
  - Strong indicators (e.g., "lyrics", "verse/chorus"): 3 points
  - Medium indicators (e.g., "verse", "chorus"): 2 points
  - Weak indicators (e.g., "poetic", "repetition"): 1 point
- Requires score ≥ 2 for confident match
- Post-processes LLM response to ensure consistency

**Confidence levels**:
- 0.9+: Very confident (clear indicators)
- 0.7-0.8: Likely match
- 0.5-0.6: Uncertain (use with caution)

### Context-Aware Corrections

AI corrections now include surrounding segment context for better accuracy:

- **Previous segment**: Last 80 characters
- **Next segment**: First 80 characters
- **Context marker**: Clearly labeled as "for reference only"

This helps the AI:
- Maintain conversational flow
- Understand context-dependent corrections
- Avoid breaking narrative continuity
- Better handle pronouns and references
```

**Section to Update** (line 60-64):

```markdown
**How It Works**:
- System detects content type from project settings
- 🔍 AI Analysis can automatically suggest content type
- Fallback: Auto-detection using keywords in context
- Includes surrounding segments (prev/next) for context
- Builds context-specific system prompt with appropriate style guidelines
```

### 3. docs/development/API.md

Add new section:

```markdown
## AI Analysis Endpoints

### POST /api/ai/analyze/project/{project_id}

Analyze project content and suggest content type.

**Parameters**:
- `project_id` (path): Project ID
- `provider` (query, optional): LLM provider (default: "ollama")

**Response**:
```json
{
  "suggested_content_type": "lyrics",
  "confidence": 0.95,
  "reasoning": "Clear verse/chorus structure with poetic language and repetition",
  "suggested_description": "Song lyrics with multiple verses and chorus"
}
```

**Content Type Detection**:
- Uses weighted keyword scoring
- Analyzes first 10 segments
- Post-processes for consistency
- Requires threshold score ≥ 2

**Keyword Weights**:
- Lyrics: "lyrics" (3), "verse/chorus" (3), "verse" (2), "chorus" (2), "poetic" (1)
- Academic: "academic" (3), "lecture" (3), "research" (2), "educational" (2)
- Interview: "interview" (3), "q&a" (3), "conversation" (2), "dialogue" (2)
- Literature: "fiction" (3), "novel" (3), "story" (2), "tale" (2)
- Media: "podcast" (3), "radio show" (3), "broadcast" (2), "show" (1)
- Presentation: "presentation" (3), "business talk" (2), "professional speech" (2)

### POST /api/ai/analyze/project/{project_id}/apply

Apply suggested content type and description to project.

**Parameters**:
- `project_id` (path): Project ID
- `content_type` (body): Content type to apply
- `description` (body, optional): Description to apply

**Response**:
```json
{
  "id": 1,
  "name": "My Project",
  "content_type": "lyrics",
  "description": "Song lyrics with multiple verses",
  "updated": true
}
```
```

### 4. Backend Code Documentation

Create `backend/app/services/llm/README.md`:

```markdown
# LLM Services Architecture

## Overview

Modular architecture for LLM-based text correction with multiple provider support.

## Components

### `prompts.py` - Shared Prompt Builder

**Purpose**: Single source of truth for all prompt logic

**Key Class**: `PromptBuilder`

**Methods**:
- `build_correction_prompt(text, context, correction_type)`: Builds context-aware prompts
- `_detect_content_type(context, text)`: Detects content type from context/text
- `_get_style_guide(content_type)`: Returns style-specific guidelines

**Content Types**:
- General transcription (default)
- Lyrics
- Academic
- Interview
- Literature
- Media
- Presentation

**Prompt Structure**:
1. Role and instruction
2. Content type declaration
3. Style guide (content-specific)
4. Critical instructions (7 rules)
5. Context (if provided, labeled as reference only)
6. Original text
7. Response request

### `base.py` - LLM Provider Interface

Abstract base class defining the LLM provider contract.

### `ollama_provider.py` - Local Ollama Provider

**Default Model**: llama3.2:1b

**Features**:
- Local inference (no API key needed)
- Fast responses for small models
- Privacy (data doesn't leave your machine)

**Response Parsing**:
- Removes commentary/greetings
- Extracts text matching original length
- Falls back to original if parsing fails

### `openrouter_provider.py` - Cloud OpenRouter Provider

**Default Model**: anthropic/claude-3-haiku

**Features**:
- Access to best commercial models
- Requires API key
- Better accuracy for complex corrections

**Same parsing** as Ollama provider.

### `llm_service.py` - Service Manager

**Purpose**: Manages multiple providers, health checks, provider selection

**Methods**:
- `get_provider(name)`: Get provider instance
- `list_providers()`: List available providers
- `health_check_all()`: Check all provider health
- `correct_text(text, provider, context, correction_type)`: Delegate to provider

## Adding a New Provider

1. Create `new_provider.py` extending `LLMProvider`
2. Implement `correct_text()` and `health_check()`
3. Use `PromptBuilder.build_correction_prompt()` for prompts
4. Implement `_parse_correction()` for response cleaning
5. Register in `llm_service.py`'s `_initialize_providers()`
```

## Tests Updates Needed

### 1. Create `backend/tests/test_ai_analysis.py`

```python
"""
Tests for AI analysis endpoints.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_analyze_project_success(test_db, sample_project, sample_audio_file, sample_segments):
    """Test successful project analysis."""
    # Mock LLM response
    # Test weighted keyword scoring
    # Verify consistency validation
    pass


def test_analyze_project_lyrics_detection(test_db, sample_project):
    """Test lyrics detection with verse/chorus keywords."""
    # Create segments with lyrics-like text
    # Verify weighted scoring: "verse/chorus" (3) + "verse" (2) = 5+ points
    pass


def test_analyze_project_consistency_correction(test_db, sample_project):
    """Test that inconsistent LLM responses are corrected."""
    # Mock LLM returning "academic" but reasoning says "lyrics"
    # Verify system corrects to "lyrics" based on keyword weights
    pass


def test_analyze_project_no_segments(test_db, sample_project):
    """Test analysis fails gracefully with no segments."""
    pass


def test_apply_analysis_success(test_db, sample_project):
    """Test applying analysis updates project."""
    pass


def test_apply_analysis_not_found(test_db):
    """Test apply fails for non-existent project."""
    pass
```

### 2. Update `backend/tests/test_ai_corrections.py`

Add tests:

```python
def test_correct_segment_with_surrounding_context(test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test correction includes previous and next segments."""
    segment = sample_segments[1]  # Middle segment

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama"
        }
    )

    assert response.status_code == 200
    # Verify context includes "Previous:" and "Next:"
    call_args = mock_llm_service.correct_text.call_args
    context = call_args[1]["context"]
    assert "Previous:" in context
    assert "Next:" in context


def test_correct_segment_with_content_type_context(test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test correction includes project content type."""
    # Set project content type
    sample_project.content_type = "lyrics"
    test_db.commit()

    segment = sample_segments[0]

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama"
        }
    )

    assert response.status_code == 200
    # Verify context includes content type
    call_args = mock_llm_service.correct_text.call_args
    assert "Content type: lyrics" in call_args[1]["context"]


def test_parse_correction_removes_context(test_db):
    """Test that parsing removes included context from LLM response."""
    from app.services.llm.ollama_provider import OllamaProvider

    provider = OllamaProvider()
    original = "But let go before it felt too right"  # 8 words

    # LLM included previous context (13 words total)
    llm_response = "One bridge, one's held tight But let go before it felt too right."

    result = provider._parse_correction(llm_response, original)

    # Should extract only the 8-word portion
    assert len(result.split()) <= 10  # Allow some tolerance
    assert "But let go" in result
    assert result != llm_response  # Should be different from full response
```

### 3. Create `backend/tests/test_prompts.py`

```python
"""
Tests for prompt builder.
"""
import pytest
from app.services.llm.prompts import PromptBuilder


def test_detect_content_type_lyrics():
    """Test lyrics detection from context."""
    context = "Content type: lyrics | Speaker: Artist"
    text = "Some text"

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "lyrics"


def test_detect_content_type_from_text_heuristics():
    """Test lyrics detection from text characteristics."""
    context = ""
    text = "Line 1\nLine 2\nLine 3\nLine 4\nShort"  # 4+ newlines, <50 words

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "lyrics"


def test_build_prompt_includes_context_label():
    """Test prompt labels context as reference only."""
    text = "Test text"
    context = "Speaker: John"

    prompt = PromptBuilder.build_correction_prompt(text, context)

    assert "for reference only" in prompt
    assert "DO NOT include in response" in prompt


def test_get_style_guide_all_types():
    """Test all content types have style guides."""
    types = ["lyrics", "academic", "interview", "literature", "media", "presentation", "general transcription"]

    for content_type in types:
        guide = PromptBuilder._get_style_guide(content_type)
        assert len(guide) > 50  # Should be substantial
        assert "Style Guide" in guide
```

## Summary

**Documentation**:
- ❌ README.md missing AI Analysis feature
- ❌ AI_CONFIGURATION.md missing analysis and context sections
- ❌ API.md missing analysis endpoints
- ❌ No architecture docs for prompts module

**Tests**:
- ❌ No test_ai_analysis.py (0% coverage)
- ❌ test_ai_corrections.py missing context tests
- ❌ No test_prompts.py (0% coverage)

**Estimated Work**: 4-6 hours to bring docs and tests up to date
