"""
Export service for generating transcription outputs in various formats.
"""
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.audio_file import AudioFile
from ..models.segment import Segment
from ..models.speaker import Speaker


class ExportService:
    """Service for exporting transcriptions to different formats."""

    def generate_srt(
        self,
        file_id: int,
        db: Session,
        use_edited: bool = True,
        include_speakers: bool = True
    ) -> str:
        """
        Generate SRT subtitle format.

        Args:
            file_id: ID of the audio file
            db: Database session
            use_edited: Use edited text if available
            include_speakers: Include speaker names in output

        Returns:
            SRT formatted string
        """
        segments = (
            db.query(Segment)
            .filter(Segment.audio_file_id == file_id)
            .order_by(Segment.sequence)
            .all()
        )

        # Get speakers if needed
        speakers_map = {}
        if include_speakers:
            audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
            if audio_file:
                speakers = (
                    db.query(Speaker)
                    .filter(Speaker.project_id == audio_file.project_id)
                    .all()
                )
                speakers_map = {s.id: s.display_name for s in speakers}

        srt_lines = []
        for idx, segment in enumerate(segments, 1):
            # Sequence number
            srt_lines.append(str(idx))

            # Timestamp
            start_time = self._format_srt_time(segment.start_time)
            end_time = self._format_srt_time(segment.end_time)
            srt_lines.append(f"{start_time} --> {end_time}")

            # Text content
            text = segment.edited_text if (use_edited and segment.edited_text) else segment.original_text

            # Add speaker if available
            if include_speakers and segment.speaker_id and segment.speaker_id in speakers_map:
                speaker_name = speakers_map[segment.speaker_id]
                text = f"[{speaker_name}] {text}"

            srt_lines.append(text)
            srt_lines.append("")  # Empty line between entries

        return "\n".join(srt_lines)

    def generate_html(
        self,
        file_id: int,
        db: Session,
        use_edited: bool = True,
        include_speakers: bool = True,
        include_timestamps: bool = True
    ) -> str:
        """
        Generate HTML formatted transcription.

        Args:
            file_id: ID of the audio file
            db: Database session
            use_edited: Use edited text if available
            include_speakers: Include speaker names
            include_timestamps: Include timestamps

        Returns:
            HTML formatted string
        """
        audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {file_id} not found")

        segments = (
            db.query(Segment)
            .filter(Segment.audio_file_id == file_id)
            .order_by(Segment.sequence)
            .all()
        )

        # Get speakers
        speakers_map = {}
        if include_speakers:
            speakers = (
                db.query(Speaker)
                .filter(Speaker.project_id == audio_file.project_id)
                .all()
            )
            speakers_map = {s.id: s.display_name for s in speakers}

        # Build HTML
        html_parts = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            "    <meta charset='UTF-8'>",
            f"    <title>Transcription - {audio_file.original_filename}</title>",
            "    <style>",
            "        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }",
            "        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }",
            "        .metadata { color: #666; font-size: 0.9em; margin-bottom: 30px; }",
            "        .segment { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #007bff; }",
            "        .speaker { font-weight: bold; color: #007bff; }",
            "        .timestamp { color: #666; font-size: 0.85em; }",
            "        .text { margin-top: 5px; }",
            "    </style>",
            "</head>",
            "<body>",
            f"    <h1>Transcription</h1>",
            "    <div class='metadata'>",
            f"        <p><strong>File:</strong> {audio_file.original_filename}</p>",
            f"        <p><strong>Duration:</strong> {self._format_duration(audio_file.duration)}</p>",
            f"        <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>",
            "    </div>",
        ]

        # Add segments
        for segment in segments:
            text = segment.edited_text if (use_edited and segment.edited_text) else segment.original_text

            html_parts.append("    <div class='segment'>")

            # Speaker and timestamp header
            header_parts = []
            if include_speakers and segment.speaker_id and segment.speaker_id in speakers_map:
                speaker_name = speakers_map[segment.speaker_id]
                header_parts.append(f"<span class='speaker'>{speaker_name}</span>")

            if include_timestamps:
                timestamp = f"{self._format_time(segment.start_time)} - {self._format_time(segment.end_time)}"
                header_parts.append(f"<span class='timestamp'>{timestamp}</span>")

            if header_parts:
                html_parts.append(f"        <div>{' | '.join(header_parts)}</div>")

            html_parts.append(f"        <div class='text'>{text}</div>")
            html_parts.append("    </div>")

        html_parts.extend([
            "</body>",
            "</html>"
        ])

        return "\n".join(html_parts)

    def generate_txt(
        self,
        file_id: int,
        db: Session,
        use_edited: bool = True,
        include_speakers: bool = True,
        include_timestamps: bool = False
    ) -> str:
        """
        Generate plain text transcription.

        Args:
            file_id: ID of the audio file
            db: Database session
            use_edited: Use edited text if available
            include_speakers: Include speaker names
            include_timestamps: Include timestamps

        Returns:
            Plain text string
        """
        audio_file = db.query(AudioFile).filter(AudioFile.id == file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {file_id} not found")

        segments = (
            db.query(Segment)
            .filter(Segment.audio_file_id == file_id)
            .order_by(Segment.sequence)
            .all()
        )

        # Get speakers
        speakers_map = {}
        if include_speakers:
            speakers = (
                db.query(Speaker)
                .filter(Speaker.project_id == audio_file.project_id)
                .all()
            )
            speakers_map = {s.id: s.display_name for s in speakers}

        # Build text
        lines = [
            f"Transcription: {audio_file.original_filename}",
            f"Duration: {self._format_duration(audio_file.duration)}",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "",
            "=" * 80,
            ""
        ]

        for segment in segments:
            text = segment.edited_text if (use_edited and segment.edited_text) else segment.original_text

            parts = []
            if include_timestamps:
                timestamp = f"[{self._format_time(segment.start_time)} - {self._format_time(segment.end_time)}]"
                parts.append(timestamp)

            if include_speakers and segment.speaker_id and segment.speaker_id in speakers_map:
                speaker_name = speakers_map[segment.speaker_id]
                parts.append(f"{speaker_name}:")

            parts.append(text)
            lines.append(" ".join(parts))
            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        """Format time for SRT (HH:MM:SS,mmm)."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    @staticmethod
    def _format_time(seconds: float) -> str:
        """Format time for display (MM:SS)."""
        if seconds is None:
            return "00:00"
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"

    @staticmethod
    def _format_duration(seconds: Optional[float]) -> str:
        """Format duration for display."""
        if seconds is None:
            return "Unknown"
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
