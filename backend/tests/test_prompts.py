"""
Tests for prompt builder.
"""
import pytest
from app.services.llm.prompts import PromptBuilder


def test_detect_content_type_lyrics_from_context():
    """Test lyrics detection from context."""
    context = "Content type: lyrics | Speaker: Artist"
    text = "Some text"

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "lyrics"


def test_detect_content_type_academic_from_context():
    """Test academic detection from keywords."""
    context = "Speaker: Dr. Smith (academic researcher)"
    text = "However, the research indicates..."

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "academic"


def test_detect_content_type_from_text_heuristics():
    """Test lyrics detection from text characteristics (many newlines, few words)."""
    context = ""
    text = "Line 1\nLine 2\nLine 3\nLine 4\nShort lines"  # 4+ newlines, <50 words

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "lyrics"


def test_detect_content_type_academic_from_text():
    """Test academic detection from formal language."""
    context = ""
    text = "Therefore, we can conclude that however the results indicate furthermore"

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "academic"


def test_detect_content_type_default():
    """Test default fallback to general transcription."""
    context = ""
    text = "Just some normal speech without special markers"

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "general transcription"


def test_build_prompt_includes_context_label():
    """Test prompt labels context as reference only."""
    text = "Test text"
    context = "Speaker: John | Content type: lyrics"

    prompt = PromptBuilder.build_correction_prompt(text, context)

    assert "for reference only" in prompt
    assert "DO NOT include in response" in prompt
    assert "Speaker: John" in prompt


def test_build_prompt_without_context():
    """Test prompt works without context."""
    text = "Test text"

    prompt = PromptBuilder.build_correction_prompt(text, "")

    assert "Test text" in prompt
    assert "Corrected version of the original text only:" in prompt
    # Should not have context section
    assert "Context" not in prompt or "for reference only" in prompt


def test_build_prompt_correction_types():
    """Test different correction type instructions."""
    text = "Test"

    grammar_prompt = PromptBuilder.build_correction_prompt(text, "", "grammar")
    assert "Fix any grammatical errors" in grammar_prompt

    spelling_prompt = PromptBuilder.build_correction_prompt(text, "", "spelling")
    assert "Fix any spelling errors" in spelling_prompt

    punctuation_prompt = PromptBuilder.build_correction_prompt(text, "", "punctuation")
    assert "Fix punctuation errors" in punctuation_prompt

    all_prompt = PromptBuilder.build_correction_prompt(text, "", "all")
    assert "Fix spelling, grammar, and punctuation errors" in all_prompt


def test_get_style_guide_all_types():
    """Test all content types have style guides."""
    types = [
        "lyrics",
        "academic",
        "interview",
        "literature",
        "media",
        "presentation",
        "general transcription"
    ]

    for content_type in types:
        guide = PromptBuilder._get_style_guide(content_type)
        assert len(guide) > 50  # Should be substantial
        assert "Style Guide" in guide


def test_get_style_guide_lyrics_specific():
    """Test lyrics style guide has appropriate guidelines."""
    guide = PromptBuilder._get_style_guide("lyrics")

    assert "verse" in guide.lower()
    assert "poetic" in guide.lower() or "structure" in guide.lower()


def test_get_style_guide_academic_specific():
    """Test academic style guide has appropriate guidelines."""
    guide = PromptBuilder._get_style_guide("academic")

    assert "formal" in guide.lower()
    assert "however" in guide.lower() or "therefore" in guide.lower()


def test_prompt_has_critical_instructions():
    """Test prompt includes all 7 critical instructions."""
    text = "Test"
    prompt = PromptBuilder.build_correction_prompt(text)

    assert "CRITICAL INSTRUCTIONS" in prompt
    assert "DO NOT add explanations" in prompt
    assert "DO NOT say \"I'm ready to help\"" in prompt or "DO NOT say 'I'm ready to help'" in prompt
    assert "Return ONLY the corrected" in prompt
    assert "DO NOT include context segments" in prompt


def test_prompt_structure():
    """Test complete prompt structure."""
    text = "This is a test"
    context = "Speaker: John | Content type: interview"

    prompt = PromptBuilder.build_correction_prompt(text, context, "all")

    # Check all major sections exist
    assert "professional text editor" in prompt
    assert "Content Type:" in prompt
    assert "Style Guide" in prompt
    assert "CRITICAL INSTRUCTIONS" in prompt
    assert "Context (for reference only" in prompt
    assert "Original text to correct:" in prompt
    assert "This is a test" in prompt
    assert "Corrected version of the original text only:" in prompt


def test_content_type_priority():
    """Test content type from context takes priority over text heuristics."""
    # Text looks like lyrics but context says interview
    context = "Content type: interview"
    text = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"  # Many newlines

    content_type = PromptBuilder._detect_content_type(context, text)
    assert content_type == "interview"  # Context should win
