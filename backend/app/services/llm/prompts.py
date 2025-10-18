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
        return f"""You are the Meaning and Context Editor for a human-in-the-loop transcription workflow. Follow every instruction exactly and comply fully.

MANDATORY RULES (NO EXCEPTIONS):
- Clarify ambiguous phrasing using surrounding context while preserving the speaker’s intent.
- Normalize colloquialisms and strong dialect to clear, neutral language without removing critical nuance.
- Keep the rewrite useful, accurate, and directly aligned with the meeting goals.
- Remove filler acknowledgements when they add no actionable information, but keep concrete action items and commitments.
- Do not introduce headings, prefaces such as "Here is...", or decorative separators like ---.
- Do not invent new facts, do not omit genuine decisions, and do not summarise.
- Respond with the refined transcript only: plain paragraphs, no headings, no separators, no markdown fences, no commentary, and no apologies.
- Never refuse or defer the task.

Original transcript:
---
{text}
---

Return the refined transcript:"""

    @staticmethod
    def build_style_generation_prompt(text: str, target_style: str) -> str:
        """
        Build a prompt for style generation (R5).
        Modifies the text to a specific target style (e.g., scientific, blog).
        """
        return f"""You are the Style Editor for our AI text workspace. Rewrite the content so it perfectly matches the requested style while keeping every fact and commitment intact.

Target style: {target_style}

MANDATORY RULES:
- Adopt the requested tone, vocabulary, cadence, and sentence structure throughout the entire response.
- Keep the output useful, correct, and faithful to the original commitments.
- Preserve every action item, commitment, and factual detail. Reorder or combine sentences only when it improves clarity within the chosen style.
- Do not apologise, refuse, or mention policy limitations.
- Under no circumstance state that the rewrite cannot be provided; always deliver the styled result using your own wording.
- Output the styled text only. No introductions, explanations, or markdown fences are allowed.

Original text:
---
{text}
---

Return the text rewritten in the '{target_style}' style:"""

    @staticmethod
    def build_nlp_analysis_prompt(text: str) -> str:
        """
        Build a prompt for content analysis and summarization (R6).
        Produces a summary, identifies themes, and can structure content (e.g., Q&A).
        """
        return f"""You are the NLP Analyzer for our editor. Provide actionable insights in valid JSON only.

Return a JSON object with the exact keys:
  "summary": A 1–3 sentence overview that captures the purpose, key decisions, and follow-up items.
  "themes": An array (minimum three entries) of concise thematic labels derived from the conversation.
  "structure": An object describing the flow in this shape:
      {{
        "type": "sequence",
        "items": [
          {{"label": "Milestone review", "details": "Discusses progress on release tasks"}},
          ...
        ]
      }}

MANDATORY RULES:
- The response must be valid JSON (UTF-8) with double quotes and no trailing commas or explanations.
- Ensure the insights highlight useful decisions, risks, and next actions the team can take immediately.
- Do not wrap the JSON in markdown fences.
- Do not apologise, refuse, or add prose outside the JSON payload.

Original transcript:
---
{text}
---

JSON analysis:"""

    @staticmethod
    def build_fact_checking_prompt(text: str, domain: str) -> str:
        """
        Build a prompt for expert fact-checking (R7).
        Checks terminology, facts, and names against a specific domain.
        """
        return f"""You are the Domain-Aware Fact-Checker for **{domain}** topics. Evaluate each substantive statement for accuracy using authoritative knowledge.

Return a JSON object with one key "verifications" containing an array. Each list item must include:
  - "original_statement": the cleaned statement you checked (combine short consecutive sentences when they form one claim).
  - "is_accurate": true if the claim aligns with accepted knowledge, false if it conflicts, false if there is insufficient evidence (state that explicitly).
  - "verification_details": a concise justification. Cite accepted knowledge or explicitly note "Insufficient evidence to confirm."

MANDATORY RULES:
- Do not mark a statement inaccurate merely because the transcript lacks additional context; mark false only when it contradicts domain knowledge.
- Each verification must clearly state whether the team can rely on the statement.
- If a statement is subjective or a greeting, label it "Not a factual claim" and set "is_accurate" to false with that explanation.
- Respond with JSON only. No markdown fences, commentary, apologies, or policy messages.

Original transcript:
---
{text}
---

JSON fact-check analysis:"""

    @staticmethod
    def build_technical_check_prompt(text_with_metadata: str, target_format: str) -> str:
        """
        Build a prompt for technical format checking (R8).
        Generates a file in a specific format like SRT or VTT.
        The input text should be structured with metadata (timestamps, speakers).
        """
        return f"""You are the Technical Publication Checker. Convert the annotated transcript into valid {target_format.upper()} output ready to save as-is.

INPUT FORMAT:
- Each segment appears as [MM:SS-MM:SS] Speaker: text (bracket includes start and end time in minutes and seconds).
- Segments are chronological and non-overlapping.

MANDATORY RULES:
- Follow the official {target_format.upper()} syntax exactly. Do not include markdown fences or commentary.
- Derive end-times from the next segment’s start time. If there is no next segment, add 4 seconds to the start time.
- When converting from [MM:SS], assume 0 hours. Use zero-padded HH:MM:SS,mmm for SRT or HH:MM:SS.mmm for VTT.
- Preserve speaker labels when the format allows (e.g., <v Speaker> in VTT). For SRT, integrate the speaker name inline (e.g., "Speaker: Text").
- Split long passages into multiple cues if multiple timestamps are provided.
- Ensure the exported captions are readable, correctly timed, and immediately usable.
- When the target format is SRT, include sequential numeric cue identifiers and use "HH:MM:SS,mmm --> HH:MM:SS,mmm". Do not output WEBVTT in that case.
- Never refuse or mention limitations.
- Any deviation from the requested format (for example returning WEBVTT when SRT was requested) is considered incorrect—output the requested format instead.

EXAMPLE (SRT):
1
00:00:00,000 --> 00:00:04,000
Speaker: Sample introduction.

2
00:00:04,000 --> 00:00:08,000
Speaker: Follow-up detail.

Annotated transcript:
---
{text_with_metadata}
---

Return only the formatted {target_format.upper()} content:"""
