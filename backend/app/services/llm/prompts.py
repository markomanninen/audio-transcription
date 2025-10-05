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

    @staticmethod
    def build_semantic_reconstruction_prompt(text: str) -> str:
        """
        Build a prompt for semantic reconstruction (R4).
        Corrects unclear words, colloquialisms, and dialects while preserving meaning.
        """
        return f"""You are a 'Meaning and Context Editor'. Your task is to refine the following transcribed text.

CRITICAL INSTRUCTIONS:
1.  **Clarify Ambiguities**: Resolve unclear words or phrases using context.
2.  **Normalize Language**: Replace colloquialisms, slang, and strong dialectal expressions with standard, neutral language.
3.  **Preserve Core Meaning**: The original message and intent must be fully retained. Do not add new information or opinions.
4.  **Maintain Flow**: Ensure the resulting text is natural and easy to read.
5.  **Output**: Return ONLY the reconstructed text. Do not add explanations, greetings, or comments.

Original Text:
---
{text}
---

Reconstructed Text:"""

    @staticmethod
    def build_style_generation_prompt(text: str, target_style: str) -> str:
        """
        Build a prompt for style generation (R5).
        Modifies the text to a specific target style (e.g., scientific, blog).
        """
        return f"""You are a 'Style Editor'. Your task is to rewrite the following text to match a specific style.

Target Style: **{target_style}**

CRITICAL INSTRUCTIONS:
1.  **Adopt the Tone**: Fully embody the requested style in terms of vocabulary, sentence structure, and tone. (e.g., formal and objective for 'scientific'; engaging and personal for 'blog').
2.  **Retain All Information**: Ensure all key points and information from the original text are present in the new version.
3.  **Be Consistent**: Maintain the target style consistently throughout the entire text.
4.  **Output**: Return ONLY the rewritten text in the target style. Do not add explanations, greetings, or comments.

Original Text:
---
{text}
---

Text in '{target_style}' style:"""

    @staticmethod
    def build_nlp_analysis_prompt(text: str) -> str:
        """
        Build a prompt for content analysis and summarization (R6).
        Produces a summary, identifies themes, and can structure content (e.g., Q&A).
        """
        return f"""You are an 'NLP Analyzer'. Your task is to analyze the following text and extract structured insights.

CRITICAL INSTRUCTIONS:
1.  **Summarize**: Provide a concise summary of the text's main points.
2.  **Identify Themes**: List the key themes or topics discussed.
3.  **Extract Structure**: If the text contains a clear structure (like a Q&A, presentation points, or a debate), outline it. If not, state that no clear structure was found.
4.  **Format as JSON**: Return the analysis in a valid JSON object with the following keys: "summary", "themes" (as an array of strings), and "structure" (as a string or an array of objects).
5.  **Output**: Return ONLY the JSON object. Do not add explanations, greetings, or comments outside of the JSON structure.

Original Text:
---
{text}
---

JSON Analysis:"""

    @staticmethod
    def build_fact_checking_prompt(text: str, domain: str) -> str:
        """
        Build a prompt for expert fact-checking (R7).
        Checks terminology, facts, and names against a specific domain.
        """
        return f"""You are a 'Domain-Aware Fact-Checker'. Your area of expertise is **{domain}**. Your task is to review the following text for factual accuracy within your domain.

CRITICAL INSTRUCTIONS:
1.  **Verify Information**: Check all claims, names, dates, statistics, and terminology against established knowledge in '{domain}'.
2.  **Identify Inaccuracies**: Pinpoint any statements that are factually incorrect, misleading, or questionable.
3.  **Provide Corrections**: For each identified inaccuracy, provide the correct information and a brief, clear explanation.
4.  **Format as JSON**: Return the analysis in a valid JSON object. The object should contain a single key, "verifications", which is an array of objects. Each object should have:
    - "original_statement": The piece of text being checked.
    - "is_accurate": A boolean value (true/false).
    - "verification_details": A string explaining the finding (e.g., "Confirmed accurate." or "Incorrect. The actual value is X, because...").
5.  **Handle Accuracy**: If the entire text is accurate, the "verifications" array should contain a single object stating that all facts were confirmed.
6.  **Output**: Return ONLY the JSON object.

Original Text:
---
{text}
---

JSON Fact-Check Analysis:"""

    @staticmethod
    def build_technical_check_prompt(text_with_metadata: str, target_format: str) -> str:
        """
        Build a prompt for technical format checking (R8).
        Generates a file in a specific format like SRT or VTT.
        The input text should be structured with metadata (timestamps, speakers).
        """
        return f"""You are a 'Technical Publication Checker'. Your task is to convert the provided text with metadata into the **{target_format}** format.

CRITICAL INSTRUCTIONS:
1.  **Parse Input**: The input contains segments with speakers and timestamps.
2.  **Adhere to Format Specs**: Strictly follow the official specification for the '{target_format}' format.
    - For SRT: `sequence_number\\nHH:MM:SS,ms --> HH:MM:SS,ms\\nText\\n`
    - For VTT: `WEBVTT\\n\\nHH:MM:SS.ms --> HH:MM:SS.ms\\n<v Speaker>Text`
3.  **Maintain Integrity**: Ensure all text, speakers, and timestamps are accurately transferred to the new format.
4.  **Handle Speakers**: If the format supports speaker labels (like VTT), include them. If not (like SRT), omit them but ensure the text is correctly assigned to its time block.
5.  **Output**: Return ONLY the formatted content as a single block of text, ready to be saved to a file. Do not add explanations or comments.

Input Text with Metadata:
---
{text_with_metadata}
---

Formatted {target_format} Output:"""
