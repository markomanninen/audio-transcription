"""
Shared prompt templates and builders for LLM providers.
"""
from typing import Dict


class PromptBuilder:
    """Builds prompts for text correction with context awareness."""

    @staticmethod
    def build_correction_prompt(
        text: str,
        context: str = "",
        correction_type: str = "all"
    ) -> str:
        """
        Build a correction prompt with context awareness.

        Args:
            text: Text to correct
            context: Optional context (speaker, content type, surrounding segments)
            correction_type: Type of correction (grammar, spelling, punctuation, all)

        Returns:
            Formatted prompt string
        """
        correction_instructions = {
            "grammar": "Fix any grammatical errors",
            "spelling": "Fix any spelling errors",
            "punctuation": "Fix punctuation errors",
            "all": "Fix spelling, grammar, and punctuation errors"
        }

        instruction = correction_instructions.get(correction_type, correction_instructions["all"])

        # Detect content type from context or text characteristics
        content_type = PromptBuilder._detect_content_type(context, text)
        style_guide = PromptBuilder._get_style_guide(content_type)

        prompt = f"""You are a professional text editor. {instruction} in the following text from an audio transcription.

Content Type: {content_type}

{style_guide}

CRITICAL INSTRUCTIONS:
1. Only fix errors, do not rephrase or change the meaning
2. Preserve the original style and tone
3. DO NOT add explanations, greetings, or comments
4. DO NOT say "I'm ready to help" or ask questions
5. Return ONLY the corrected version of "Original text" below
6. DO NOT include context segments (Previous/Next) in your response
7. If no corrections needed, return the original text exactly

"""
        if context:
            prompt += f"Context (for reference only, DO NOT include in response): {context}\n\n"

        prompt += f"Original text to correct:\n{text}\n\nCorrected version of the original text only:"

        return prompt

    @staticmethod
    def _detect_content_type(context: str, text: str) -> str:
        """Detect the type of content being corrected."""
        context_lower = context.lower() if context else ""
        text_lower = text.lower()

        # Check for explicit content type markers in context
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

    @staticmethod
    def _get_style_guide(content_type: str) -> str:
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
