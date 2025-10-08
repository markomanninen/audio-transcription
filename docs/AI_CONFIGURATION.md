# AI Configuration Guide

Complete guide to configuring AI-powered corrections in the Audio Transcription app.

## Overview

The AI correction system uses Large Language Models (LLMs) to automatically suggest spelling, grammar, and punctuation improvements to your transcriptions. It supports both local (Ollama) and cloud (OpenRouter) inference.

**📖 For External Ollama Setup**: See the [External Ollama Configuration Guide](./EXTERNAL_OLLAMA_SETUP.md) for detailed instructions on using remote Ollama services.

## Content-Aware Correction

The system automatically adapts its correction style based on the content type:

### Supported Content Types

1. **General Transcription** (default)
   - Balanced approach for general audio
   - Fixes clear errors while preserving natural speech

2. **Interview / Conversation**
   - Preserves conversational tone
   - Keeps natural speech patterns and filler words (when meaningful)
   - Allows incomplete sentences if contextually clear

3. **Song Lyrics**
   - Preserves line breaks and verse structure
   - Allows poetic license and intentional deviations
   - Maintains rhyme schemes
   - Fixes only obvious spelling errors

4. **Academic / Research**
   - Uses formal language
   - Ensures proper logical connectors (however, therefore, etc.)
   - Maintains technical vocabulary
   - Enforces complete sentences

5. **Book / Literature**
   - Maintains narrative voice and style
   - Preserves author's stylistic choices
   - Keeps dialogue natural and character-appropriate

6. **Podcast / Show**
   - Keeps casual, engaging tone
   - Preserves humor and personality
   - Allows informal language

7. **Lecture / Presentation**
   - Uses clear, professional language
   - Maintains educational tone
   - Ensures logical flow

### Setting Content Type

**Option 1: Automatic Detection (Recommended)**:
1. Click the 🔍 button in the app header
2. Click "🔍 Analyze Content"
3. Review the suggested content type, confidence score, and reasoning
4. Click "✓ Apply & Use for Corrections" to apply

The AI will analyze the first 10 segments and suggest the best content type.

**Option 2: Manual Selection**:
1. Open project settings (✏️ edit button)
2. Select "Content Type" from dropdown
3. Save

The selected content type will be used for all AI corrections in that project.

**How It Works**:
- System detects content type from project settings
- AI corrections include surrounding segments (previous & next) for context
- Builds context-specific system prompt with appropriate style guidelines
- Uses weighted keyword scoring for accurate auto-detection

## Provider Configuration

### Option 1: Environment Variables (Recommended for Production)

Edit `backend/.env`:

```env
# Ollama (Local)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:1b

# OpenRouter (Cloud)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-3-haiku

# Default Provider
DEFAULT_LLM_PROVIDER=ollama
```

**Advantages**:
- Secure (not exposed to browser)
- Centralized configuration
- Works across all sessions

### Option 2: UI Settings (Development/Testing)

1. Click AI provider dropdown in app header
2. Select "⚙️ Advanced Settings"
3. Configure providers

**Advantages**:
- No server restart needed
- Quick testing of different models
- Per-user configuration

**Note**: UI settings are stored in localStorage (browser-only).

## Ollama Setup

### Installation

**Docker (Included)**:
```bash
# Already running if you used docker-compose
docker-compose up ollama
```

**Standalone**:
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from: https://ollama.ai
```

### Pulling Models

```bash
# Using docker-compose
docker-compose exec ollama ollama pull llama3.2:1b
docker-compose exec ollama ollama pull mistral:7b

# Standalone
ollama pull llama3.2:1b
ollama pull mistral:7b
```

### Recommended Models

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| llama3.2:1b | 1B | ⚡️⚡️⚡️ | ⭐️⭐️ | Quick corrections, testing |
| llama3.2:3b | 3B | ⚡️⚡️ | ⭐️⭐️⭐️ | Balanced speed/quality |
| mistral:7b | 7B | ⚡️ | ⭐️⭐️⭐️⭐️ | Best quality, slower |
| phi3:mini | 3.8B | ⚡️⚡️ | ⭐️⭐️⭐️ | Good balance |

### Configuration

**In `.env`**:
```env
OLLAMA_BASE_URL=http://ollama:11434  # or http://localhost:11434 for standalone
OLLAMA_MODEL=llama3.2:1b
```

**In UI**:
1. Advanced Settings → Ollama section
2. Set URL and model
3. Save

### Health Check

The app automatically monitors Ollama health:
- Green dot = Connected and ready
- Red dot = Unavailable (check if service is running)

## OpenRouter Setup

### Getting API Key

1. Visit [openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up / Log in
3. Create new API key
4. Copy key (starts with `sk-or-v1-...`)

### Model Selection

Popular models for corrections:

**Fast & Cheap**:
- `anthropic/claude-3-haiku` - Best balance ($0.25/$1.25 per 1M tokens)
- `openai/gpt-4o-mini` - Very fast ($0.15/$0.60 per 1M tokens)
- `google/gemini-pro` - Free tier available

**High Quality**:
- `anthropic/claude-3-sonnet` - Better reasoning ($3/$15 per 1M tokens)
- `openai/gpt-4o` - Latest OpenAI ($5/$15 per 1M tokens)

See all models: [openrouter.ai/models](https://openrouter.ai/models)

### Configuration

**In `.env`**:
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=anthropic/claude-3-haiku
```

**In UI**:
1. Advanced Settings → OpenRouter section
2. Enter API key
3. Select model
4. Save

**Cost Estimation**:
- Average segment: ~50 words = ~65 tokens
- System prompt: ~200 tokens
- Total per correction: ~330 tokens (input + output)
- 1000 corrections ≈ $0.10-$0.50 (depending on model)

## AI Content Analysis

### Overview

The app can automatically analyze your transcribed content and suggest the best content type, eliminating guesswork.

### How to Use

1. **Transcribe your audio first** - Analysis requires at least some transcribed segments
2. **Click the 🔍 button** in the app header
3. **Click "🔍 Analyze Content"** - The AI will analyze your project
4. **Review the results**:
   - **Suggested Content Type**: Best match (e.g., "lyrics", "academic")
   - **Confidence Score**: 0.5-1.0 (higher = more confident)
   - **Reasoning**: Why this type was chosen
   - **Suggested Description**: Auto-generated project description
5. **Apply or re-analyze**:
   - Click "✓ Apply & Use for Corrections" to set the content type
   - Click "🔄 Re-analyze" to try again
   - Click "Cancel" to close without applying

### How It Works

**Analysis Process**:
1. Fetches first 10 segments from your transcription
2. Sends sample text to the LLM with analysis prompt
3. LLM analyzes characteristics and suggests content type
4. System validates consistency using weighted keyword scoring
5. Returns suggestion with confidence and reasoning

**Weighted Keyword Scoring**:

The system post-processes LLM responses to ensure accuracy:

| Content Type | Strong Indicators (3 pts) | Medium (2 pts) | Weak (1 pt) |
|--------------|--------------------------|----------------|-------------|
| Lyrics | "lyrics", "song lyrics", "verse/chorus" | "verse", "chorus", "refrain" | "poetic", "repetition" |
| Academic | "academic", "lecture", "research" | "educational", "scholarly" | "formal" |
| Interview | "interview", "q&a" | "conversation", "dialogue" | "discussion" |
| Literature | "fiction", "novel" | "story", "tale", "book reading" | "narrative" |
| Media | "podcast", "radio show" | "broadcast" | "show" |
| Presentation | "presentation" | "business talk", "professional speech" | - |

**Consistency Validation**:
- Compares LLM's suggested type against reasoning text
- Calculates weighted scores for each type based on keywords found
- Requires score ≥ 2 for confident match
- Corrects inconsistencies (e.g., if reasoning says "lyrics" but LLM said "academic", changes to "lyrics")

**Confidence Levels**:
- **0.9-1.0**: Very confident - Clear indicators present
- **0.7-0.8**: Likely match - Some indicators found
- **0.5-0.6**: Uncertain - Mixed signals, use with caution

### Best Practices

- **Run after transcription**: Need at least 5-10 segments for good results
- **Review reasoning**: Read why the AI chose this type
- **Check confidence**: Low confidence (<0.7) may need manual selection
- **Re-analyze if needed**: Different segments may give different results
- **Verify with content**: You know your content best - override if needed

## Surrounding Context

### Overview

AI corrections now include surrounding segment text for better contextual understanding.

### How It Works

When correcting a segment, the system includes:
- **Previous segment**: Last 80 characters (if available)
- **Next segment**: First 80 characters (if available)
- **Content type**: From project settings
- **Speaker**: Speaker name/label (if assigned)

**Example Context**:
```
Speaker: John Doe | Content type: lyrics | Previous: ...end of verse one | Next: beginning of chorus...
```

### Benefits

1. **Better conversational flow**: Understands sentence continuation
2. **Pronoun resolution**: Knows what "it", "they", "this" refers to
3. **Maintains consistency**: Keeps terminology consistent across segments
4. **Narrative coherence**: Respects story/argument progression
5. **Improved accuracy**: Reduces context-dependent errors

### Privacy Note

Surrounding context is sent to the LLM provider along with the target segment. If using OpenRouter (cloud), this means adjacent segments are also sent to external APIs.

For maximum privacy, use Ollama (local) which keeps all data on your machine.

## System Prompts

The system automatically builds context-aware prompts based on:

1. **Correction Type**: grammar, spelling, punctuation, or all
2. **Content Type**: From project settings or auto-detected
3. **Speaker Context**: Speaker name/label if available

### Prompt Structure

```
You are a professional text editor. {instruction} in the following text from an audio transcription.

Content Type: {detected_content_type}

{style_guide_for_content_type}

General Rules:
1. Only fix errors, do not rephrase or change the meaning
2. Preserve the original style and tone
3. Do not add explanations or comments
4. Return ONLY the corrected text, nothing else

Context: {speaker_info} | Content type: {project_content_type}

Text to correct:
{original_text}

Corrected text:
```

### Customizing Prompts

Prompts are centrally defined in `backend/app/services/llm/prompts.py` using the `PromptBuilder` class.

To add custom style guides:
1. Edit `backend/app/services/llm/prompts.py`
2. Add your content type to `_get_style_guide()` dictionary
3. Add detection keywords to `_detect_content_type()` logic
4. Restart the backend

**Example**:
```python
# In _get_style_guide() method
"technical_documentation": """Style Guide for Technical Docs:
- Use precise technical terminology
- Maintain consistent formatting
- Preserve code snippets and commands exactly
- Fix only grammar/spelling, not technical content
- Keep imperative mood for instructions"""

# In _detect_content_type() method
elif any(keyword in context_lower for keyword in ["technical", "documentation", "api", "code"]):
    return "technical_documentation"
```

All LLM providers (Ollama, OpenRouter) automatically use the shared `PromptBuilder`.

## Usage Workflow

### Step-by-Step

1. **Analyze Content** (optional but recommended)
   - Click 🔍 in header → "🔍 Analyze Content"
   - Review confidence and reasoning
   - Apply suggested content type

2. **Or Set Content Type Manually**
   - Edit project → Select content type → Save

3. **Select Provider**
   - Click AI provider dropdown
   - Choose Ollama (local, free) or OpenRouter (cloud, paid)

4. **Correct Segments**
   - Click ✨ button on any segment
   - System automatically includes surrounding context
   - Review suggestion in dialog
   - Accept or reject

5. **Review Changes**
   - Original text shown in red background
   - Corrected text in green background
   - Specific changes listed
   - Confidence score displayed

### Tips

- **Start with content analysis**: Automatically sets optimal correction style
- **Use Ollama for privacy**: All data stays on your machine, including context
- **Use OpenRouter for quality**: Better for complex corrections, academic text
- **Check surrounding context**: System includes prev/next segments automatically
- **Review suggestions**: AI isn't perfect, especially for domain-specific terms
- **Batch corrections**: Use batch endpoint for multiple segments (API only, UI coming soon)

## Troubleshooting

### Ollama Issues

**"Provider unavailable" error**:
```bash
# Check if Ollama is running
docker-compose ps ollama

# View logs
docker-compose logs ollama

# Restart
docker-compose restart ollama
```

**"Model not found" error**:
```bash
# List installed models
docker-compose exec ollama ollama list

# Pull missing model
docker-compose exec ollama ollama pull llama3.2:1b
```

### OpenRouter Issues

**"Invalid API key" error**:
- Verify key is correct in settings or `.env`
- Check key hasn't expired at [openrouter.ai/keys](https://openrouter.ai/keys)

**"Rate limited" error**:
- You've exceeded free tier limits
- Add credits at [openrouter.ai/credits](https://openrouter.ai/credits)

**Slow responses**:
- Try a faster model (e.g., gpt-4o-mini instead of gpt-4o)
- Check your internet connection

### General Issues

**Corrections don't match content type**:
- Ensure content type is set in project settings
- Check speaker names don't contain conflicting keywords
- Try manual context override (coming soon)

**Low confidence scores**:
- Text might be technically correct
- Try a different model
- Consider the content type might be wrong

**Unexpected changes**:
- Review the style guide for your content type
- Some models are more aggressive than others
- Use "reject" and manually edit instead

## API Reference

### Endpoints

**Correct Single Segment**:
```bash
POST /api/ai/correct-segment
{
  "segment_id": 123,
  "provider": "ollama",
  "correction_type": "all"
}
```

**Correct Batch**:
```bash
POST /api/ai/correct-batch
{
  "segment_ids": [123, 124, 125],
  "provider": "openrouter",
  "correction_type": "grammar"
}
```

**List Providers**:
```bash
GET /api/ai/providers
```

**Health Check**:
```bash
GET /api/ai/health
```

### Response Format

```json
{
  "segment_id": 123,
  "original_text": "This is a test sentance.",
  "corrected_text": "This is a test sentence.",
  "changes": ["\"sentance\" → \"sentence\""],
  "confidence": 0.95
}
```

## Best Practices

### For Accuracy
1. Always set the correct content type
2. Use appropriate speaker labels
3. Start with smaller, faster models for testing
4. Upgrade to larger models for final corrections

### For Cost Efficiency
1. Use Ollama for most corrections (free)
2. Reserve OpenRouter for complex/important segments
3. Batch corrections when possible
4. Choose cheaper models for drafts, quality models for finals

### For Privacy
1. Use Ollama for sensitive content
2. Keep API keys secure (use `.env`, not UI settings)
3. Consider self-hosting OpenRouter alternatives

### For Best Results
1. Review and customize style guides for your use case
2. Train users on when to accept/reject suggestions
3. Keep original text visible for reference
4. Use confidence scores as guidance, not gospel

## Future Enhancements

Planned features:
- Custom system prompts per project
- Fine-tuned models for specific domains
- Batch correction UI
- Correction history and undo
- Multi-language support
- Integration with more providers (Azure, AWS Bedrock, etc.)
