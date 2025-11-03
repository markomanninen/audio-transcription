"""
Export service for generating transcription outputs in various formats.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..models.project import Project
from ..models.audio_file import AudioFile, TranscriptionStatus
from ..models.segment import Segment
from ..models.speaker import Speaker
from ..models.export_template import ExportTemplate


class ExportService:
    """Service for exporting transcriptions to different formats."""

    def __init__(self):
        # In a real app, you might configure the template loader differently
        self.jinja_env = Environment(
            loader=FileSystemLoader("."),  # A dummy loader, we'll load from string
            autoescape=select_autoescape(['html', 'xml'])
        )

    def generate_from_template(self, project_id: int, template_id: int, db: Session) -> str:
        """
        Generates an export file based on a user-defined template.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        template = db.query(ExportTemplate).filter(ExportTemplate.id == template_id).first()
        if not template:
            raise ValueError(f"Template {template_id} not found")

        context = {
            "project_name": project.name,
            "project_description": project.description,
            "generation_date": datetime.now().strftime('%Y-%m-%d %H:%M'),
        }

        if project.project_type == 'audio' and project.audio_files:
            # For simplicity, we'll use the first audio file of the project
            audio_file = project.audio_files[0]
            segments = db.query(Segment).filter(Segment.audio_file_id == audio_file.id).order_by(Segment.sequence).all()
            speakers_map = {s.id: s.display_name for s in project.speakers}

            segments_data = [
                {
                    "start_time": self._format_time(s.start_time),
                    "end_time": self._format_time(s.end_time),
                    "text": s.edited_text if s.edited_text is not None else s.original_text,
                    "speaker": speakers_map.get(s.speaker_id) if s.speaker_id else "Unknown"
                }
                for s in segments
            ]
            context["segments"] = segments_data
            context["text"] = "\n".join([s["text"] for s in segments_data])

        elif project.project_type == 'text' and project.text_document:
            context["text"] = project.text_document.content
            context["history"] = project.text_document.history

        jinja_template = self.jinja_env.from_string(template.content)
        return jinja_template.render(context)


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
            .filter(Segment.is_passive.is_(False))
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
            .filter(Segment.is_passive.is_(False))
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
            "        .controls { margin-bottom: 20px; padding: 15px; background: #e9ecef; border-radius: 5px; }",
            "        .toggle-btn { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9em; margin-right: 10px; }",
            "        .toggle-btn:hover { background: #0056b3; }",
            "        .toggle-btn.inactive { background: #6c757d; }",
            "        .segment { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #007bff; transition: all 0.3s ease; min-height: auto; }",
            "        .header { display: flex; align-items: center; min-height: 1.2em; transition: all 0.3s ease; }",
            "        .header:empty { min-height: 0; padding: 0; margin: 0; }",
            "        .speaker { font-weight: bold; color: #007bff; transition: all 0.3s ease; }",
            "        .speaker.hidden { opacity: 0; width: 0; height: 0; overflow: hidden; margin: 0; padding: 0; }",
            "        .separator { margin: 0 8px; color: #666; transition: all 0.3s ease; }",
            "        .separator.hidden { opacity: 0; width: 0; margin: 0; }",
            "        .timestamp { color: #666; font-size: 0.85em; transition: all 0.3s ease; }",
            "        .timestamp.hidden { opacity: 0; width: 0; height: 0; overflow: hidden; margin: 0; padding: 0; }",
            "        .text { margin-top: 5px; }",
            "    </style>",
            "    <script>",
            "        function toggleTimestamps() {",
            "            const timestamps = document.querySelectorAll('.timestamp');",
            "            const button = document.getElementById('timestamp-toggle');",
            "            const isHidden = timestamps[0] && timestamps[0].classList.contains('hidden');",
            "            ",
            "            timestamps.forEach(timestamp => {",
            "                if (isHidden) {",
            "                    timestamp.classList.remove('hidden');",
            "                    button.textContent = 'Hide Timestamps';",
            "                    button.classList.remove('inactive');",
            "                } else {",
            "                    timestamp.classList.add('hidden');",
            "                    button.textContent = 'Show Timestamps';",
            "                    button.classList.add('inactive');",
            "                }",
            "            });",
            "            updateSeparators();",
            "        }",
            "        ",
            "        function toggleSpeakers() {",
            "            const speakers = document.querySelectorAll('.speaker');",
            "            const button = document.getElementById('speaker-toggle');",
            "            const isHidden = speakers[0] && speakers[0].classList.contains('hidden');",
            "            ",
            "            speakers.forEach(speaker => {",
            "                if (isHidden) {",
            "                    speaker.classList.remove('hidden');",
            "                    button.textContent = 'Hide Speakers';",
            "                    button.classList.remove('inactive');",
            "                } else {",
            "                    speaker.classList.add('hidden');",
            "                    button.textContent = 'Show Speakers';",
            "                    button.classList.add('inactive');",
            "                }",
            "            });",
            "            updateSeparators();",
            "        }",
            "        ",
            "        function updateSeparators() {",
            "            const separators = document.querySelectorAll('.separator');",
            "            separators.forEach(separator => {",
            "                const segment = separator.closest('.segment');",
            "                const speaker = segment.querySelector('.speaker');",
            "                const timestamp = segment.querySelector('.timestamp');",
            "                ",
            "                const speakerVisible = speaker && !speaker.classList.contains('hidden');",
            "                const timestampVisible = timestamp && !timestamp.classList.contains('hidden');",
            "                ",
            "                if (speakerVisible && timestampVisible) {",
            "                    separator.classList.remove('hidden');",
            "                } else {",
            "                    separator.classList.add('hidden');",
            "                }",
            "            });",
            "            ",
            "            // Update header visibility for dynamic segment height",
            "            const headers = document.querySelectorAll('.header');",
            "            headers.forEach(header => {",
            "                const visibleContent = Array.from(header.children).some(child => ",
            "                    !child.classList.contains('hidden') && child.textContent.trim() !== ''",
            "                );",
            "                if (!visibleContent) {",
            "                    header.style.display = 'none';",
            "                } else {",
            "                    header.style.display = 'flex';",
            "                }",
            "            });",
            "        }",
            "    </script>",
            "</head>",
            "<body>",
            "    <h1>Transcription</h1>",
            "    <div class='metadata'>",
            f"        <p><strong>File:</strong> {audio_file.original_filename}</p>",
            f"        <p><strong>Duration:</strong> {self._format_duration(audio_file.duration)}</p>",
            f"        <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>",
            "    </div>",
            "    <div class='controls'>",
            f"        <button id='timestamp-toggle' class='toggle-btn{' inactive' if not include_timestamps else ''}' onclick='toggleTimestamps()'>",
            f"            {'Show Timestamps' if not include_timestamps else 'Hide Timestamps'}",
            "        </button>",
            f"        <button id='speaker-toggle' class='toggle-btn{' inactive' if not include_speakers else ''}' onclick='toggleSpeakers()'>",
            f"            {'Show Speakers' if not include_speakers else 'Hide Speakers'}",
            "        </button>",
            "    </div>",
        ]

        # Add segments
        for segment in segments:
            text = segment.edited_text if (use_edited and segment.edited_text) else segment.original_text

            html_parts.append("    <div class='segment'>")

            # Speaker and timestamp header
            header_html = ""
            has_speaker = segment.speaker_id and segment.speaker_id in speakers_map
            
            if has_speaker:
                speaker_name = speakers_map[segment.speaker_id]
                speaker_class = "speaker" + ("" if include_speakers else " hidden")
                header_html += f"<span class='{speaker_class}'>{speaker_name}</span>"

            # Add separator that will be hidden/shown based on visibility of both elements
            if has_speaker:
                header_html += "<span class='separator'>|</span>"

            if include_timestamps:
                timestamp = f"{self._format_time(segment.start_time)} - {self._format_time(segment.end_time)}"
                timestamp_class = "timestamp" + ("" if include_timestamps else " hidden")
                header_html += f"<span class='{timestamp_class}'>{timestamp}</span>"
            else:
                # Always include timestamp span but hidden by default if include_timestamps is False
                timestamp = f"{self._format_time(segment.start_time)} - {self._format_time(segment.end_time)}"
                header_html += f"<span class='timestamp hidden'>{timestamp}</span>"

            if header_html:
                html_parts.append(f"        <div class='header'>{header_html}</div>")

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
            .filter(Segment.is_passive.is_(False))
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

    def generate_project_srt(
        self,
        project_id: int,
        db: Session,
        use_edited: bool = True,
        include_speakers: bool = True
    ) -> str:
        """
        Generate SRT subtitle format for all files in a project.

        Args:
            project_id: ID of the project
            db: Database session
            use_edited: Use edited text if available
            include_speakers: Include speaker names in output

        Returns:
            SRT formatted string combining all project files
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Get all audio files in the project, ordered by creation date
        audio_files = (
            db.query(AudioFile)
            .filter(AudioFile.project_id == project_id)
            .order_by(AudioFile.created_at)
            .all()
        )

        if not audio_files:
            raise ValueError(f"No audio files found in project {project_id}")

        # Get all segments from all files, maintaining time continuity
        all_segments = []
        cumulative_offset = 0.0

        # Get speakers if needed
        speakers_map = {}
        if include_speakers:
            speakers = (
                db.query(Speaker)
                .filter(Speaker.project_id == project_id)
                .all()
            )
            speakers_map = {s.id: s.display_name for s in speakers}

        for audio_file in audio_files:
            segments = (
                db.query(Segment)
                .filter(Segment.audio_file_id == audio_file.id)
                .filter(Segment.is_passive.is_(False))
                .order_by(Segment.sequence)
                .all()
            )

            # Add segments with adjusted timestamps for project continuity
            for segment in segments:
                adjusted_segment = type('AdjustedSegment', (), {
                    'start_time': segment.start_time + cumulative_offset,
                    'end_time': segment.end_time + cumulative_offset,
                    'original_text': segment.original_text,
                    'edited_text': segment.edited_text,
                    'speaker_id': segment.speaker_id,
                    'audio_file': audio_file
                })()
                all_segments.append(adjusted_segment)

            # Update cumulative offset for next file
            if audio_file.duration:
                cumulative_offset += audio_file.duration

        # Generate SRT content
        srt_lines = []
        for idx, segment in enumerate(all_segments, 1):
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

            # Add file context if multiple files
            if len(audio_files) > 1:
                text = f"[{segment.audio_file.original_filename}] {text}"

            srt_lines.append(text)
            srt_lines.append("")  # Empty line between entries

        return "\n".join(srt_lines)

    def generate_project_html(
        self,
        project_id: int,
        db: Session,
        use_edited: bool = True,
        include_speakers: bool = True,
        include_timestamps: bool = True
    ) -> str:
        """
        Generate HTML formatted transcription for all files in a project.

        Args:
            project_id: ID of the project
            db: Database session
            use_edited: Use edited text if available
            include_speakers: Include speaker names
            include_timestamps: Include timestamps

        Returns:
            HTML formatted string combining all project files
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Get all audio files in the project, ordered by creation date
        audio_files = (
            db.query(AudioFile)
            .filter(AudioFile.project_id == project_id)
            .order_by(AudioFile.created_at)
            .all()
        )

        if not audio_files:
            raise ValueError(f"No audio files found in project {project_id}")

        # Get speakers if needed
        speakers_map = {}
        if include_speakers:
            speakers = (
                db.query(Speaker)
                .filter(Speaker.project_id == project_id)
                .all()
            )
            speakers_map = {s.id: s.display_name for s in speakers}

        # Calculate total duration for only transcribed files
        transcribed_files = [f for f in audio_files if f.transcription_status == TranscriptionStatus.COMPLETED]
        total_duration = sum(f.duration or 0 for f in transcribed_files)

        # Build HTML
        html_parts = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            "    <meta charset='UTF-8'>",
            f"    <title>Project Transcription - {project.name}</title>",
            "    <style>",
            "        body { font-family: Arial, sans-serif; max-width: 1000px; margin: 40px auto; padding: 20px; line-height: 1.6; }",
            "        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }",
            "        h2 { color: #444; margin-top: 40px; margin-bottom: 20px; border-left: 4px solid #28a745; padding-left: 15px; }",
            "        .metadata { color: #666; font-size: 0.9em; margin-bottom: 30px; }",
            "        .controls { margin-bottom: 20px; padding: 15px; background: #e9ecef; border-radius: 5px; }",
            "        .toggle-btn { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9em; margin-right: 10px; }",
            "        .toggle-btn:hover { background: #0056b3; }",
            "        .toggle-btn.inactive { background: #6c757d; }",
            "        .file-section { margin-bottom: 40px; }",
            "        .segment { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #007bff; transition: all 0.3s ease; min-height: auto; }",
            "        .header { display: flex; align-items: center; min-height: 1.2em; transition: all 0.3s ease; }",
            "        .header:empty { min-height: 0; padding: 0; margin: 0; }",
            "        .speaker { font-weight: bold; color: #007bff; transition: all 0.3s ease; }",
            "        .speaker.hidden { opacity: 0; width: 0; height: 0; overflow: hidden; margin: 0; padding: 0; }",
            "        .separator { margin: 0 8px; color: #666; transition: all 0.3s ease; }",
            "        .separator.hidden { opacity: 0; width: 0; margin: 0; }",
            "        .timestamp { color: #666; font-size: 0.85em; transition: all 0.3s ease; }",
            "        .timestamp.hidden { opacity: 0; width: 0; height: 0; overflow: hidden; margin: 0; padding: 0; }",
            "        .text { margin-top: 5px; }",
            "        .file-metadata { color: #888; font-size: 0.85em; margin-bottom: 15px; }",
            "    </style>",
            "    <script>",
            "        function toggleTimestamps() {",
            "            const timestamps = document.querySelectorAll('.timestamp');",
            "            const button = document.getElementById('timestamp-toggle');",
            "            const isHidden = timestamps[0] && timestamps[0].classList.contains('hidden');",
            "            ",
            "            timestamps.forEach(timestamp => {",
            "                if (isHidden) {",
            "                    timestamp.classList.remove('hidden');",
            "                    button.textContent = 'Hide Timestamps';",
            "                    button.classList.remove('inactive');",
            "                } else {",
            "                    timestamp.classList.add('hidden');",
            "                    button.textContent = 'Show Timestamps';",
            "                    button.classList.add('inactive');",
            "                }",
            "            });",
            "            updateSeparators();",
            "        }",
            "        ",
            "        function toggleSpeakers() {",
            "            const speakers = document.querySelectorAll('.speaker');",
            "            const button = document.getElementById('speaker-toggle');",
            "            const isHidden = speakers[0] && speakers[0].classList.contains('hidden');",
            "            ",
            "            speakers.forEach(speaker => {",
            "                if (isHidden) {",
            "                    speaker.classList.remove('hidden');",
            "                    button.textContent = 'Hide Speakers';",
            "                    button.classList.remove('inactive');",
            "                } else {",
            "                    speaker.classList.add('hidden');",
            "                    button.textContent = 'Show Speakers';",
            "                    button.classList.add('inactive');",
            "                }",
            "            });",
            "            updateSeparators();",
            "        }",
            "        ",
            "        function updateSeparators() {",
            "            const separators = document.querySelectorAll('.separator');",
            "            separators.forEach(separator => {",
            "                const segment = separator.closest('.segment');",
            "                const speaker = segment.querySelector('.speaker');",
            "                const timestamp = segment.querySelector('.timestamp');",
            "                ",
            "                const speakerVisible = speaker && !speaker.classList.contains('hidden');",
            "                const timestampVisible = timestamp && !timestamp.classList.contains('hidden');",
            "                ",
            "                if (speakerVisible && timestampVisible) {",
            "                    separator.classList.remove('hidden');",
            "                } else {",
            "                    separator.classList.add('hidden');",
            "                }",
            "            });",
            "            ",
            "            // Update header visibility for dynamic segment height",
            "            const headers = document.querySelectorAll('.header');",
            "            headers.forEach(header => {",
            "                const visibleContent = Array.from(header.children).some(child => ",
            "                    !child.classList.contains('hidden') && child.textContent.trim() !== ''",
            "                );",
            "                if (!visibleContent) {",
            "                    header.style.display = 'none';",
            "                } else {",
            "                    header.style.display = 'flex';",
            "                }",
            "            });",
            "        }",
            "    </script>",
            "</head>",
            "<body>",
            f"    <h1>Project: {project.name}</h1>",
            "    <div class='metadata'>",
            f"        <p><strong>Description:</strong> {project.description or 'No description'}</p>",
        ]
        
        # Add content type if available
        if project.content_type:
            html_parts.append(f"        <p><strong>Content Type:</strong> {project.content_type}</p>")
            
        html_parts.extend([
            f"        <p><strong>Files:</strong> {len(audio_files)}</p>",
            f"        <p><strong>Total Duration:</strong> {self._format_duration(total_duration)}</p>",
            f"        <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>",
            "    </div>",
            "    <div class='controls'>",
            f"        <button id='timestamp-toggle' class='toggle-btn{' inactive' if not include_timestamps else ''}' onclick='toggleTimestamps()'>",
            f"            {'Show Timestamps' if not include_timestamps else 'Hide Timestamps'}",
            "        </button>",
            f"        <button id='speaker-toggle' class='toggle-btn{' inactive' if not include_speakers else ''}' onclick='toggleSpeakers()'>",
            f"            {'Show Speakers' if not include_speakers else 'Hide Speakers'}",
            "        </button>",
            "    </div>",
        ])

        # Process each file
        cumulative_offset = 0.0
        for file_idx, audio_file in enumerate(audio_files):
            segments = (
                db.query(Segment)
                .filter(Segment.audio_file_id == audio_file.id)
                .filter(Segment.is_passive.is_(False))
                .order_by(Segment.sequence)
                .all()
            )

            if not segments:
                continue

            # File header
            html_parts.append("    <div class='file-section'>")
            html_parts.append(f"        <h2>File {file_idx + 1}: {audio_file.original_filename}</h2>")
            html_parts.append("        <div class='file-metadata'>")
            html_parts.append(f"            Duration: {self._format_duration(audio_file.duration)} | ")
            html_parts.append(f"            Segments: {len(segments)}")
            html_parts.append("        </div>")

            # Add segments
            for segment in segments:
                text = segment.edited_text if (use_edited and segment.edited_text) else segment.original_text

                html_parts.append("        <div class='segment'>")

                # Speaker and timestamp header
                header_html = ""
                has_speaker = segment.speaker_id and segment.speaker_id in speakers_map
                
                if has_speaker:
                    speaker_name = speakers_map[segment.speaker_id]
                    speaker_class = "speaker" + ("" if include_speakers else " hidden")
                    header_html += f"<span class='{speaker_class}'>{speaker_name}</span>"

                # Add separator that will be hidden/shown based on visibility of both elements
                if has_speaker:
                    header_html += "<span class='separator'>|</span>"

                if include_timestamps:
                    # Adjust timestamps for project continuity
                    adj_start = segment.start_time + cumulative_offset
                    adj_end = segment.end_time + cumulative_offset
                    timestamp = f"{self._format_time(adj_start)} - {self._format_time(adj_end)}"
                    timestamp_class = "timestamp" + ("" if include_timestamps else " hidden")
                    header_html += f"<span class='{timestamp_class}'>{timestamp}</span>"
                else:
                    # Always include timestamp span but hidden by default if include_timestamps is False
                    adj_start = segment.start_time + cumulative_offset
                    adj_end = segment.end_time + cumulative_offset
                    timestamp = f"{self._format_time(adj_start)} - {self._format_time(adj_end)}"
                    header_html += f"<span class='timestamp hidden'>{timestamp}</span>"

                if header_html:
                    html_parts.append(f"            <div class='header'>{header_html}</div>")

                html_parts.append(f"            <div class='text'>{text}</div>")
                html_parts.append("        </div>")

            html_parts.append("    </div>")

            # Update cumulative offset for next file
            if audio_file.duration:
                cumulative_offset += audio_file.duration

        html_parts.extend([
            "</body>",
            "</html>"
        ])

        return "\n".join(html_parts)

    def generate_project_txt(
        self,
        project_id: int,
        db: Session,
        use_edited: bool = True,
        include_speakers: bool = True,
        include_timestamps: bool = False
    ) -> str:
        """
        Generate plain text transcription for all files in a project.

        Args:
            project_id: ID of the project
            db: Database session
            use_edited: Use edited text if available
            include_speakers: Include speaker names
            include_timestamps: Include timestamps

        Returns:
            Plain text string combining all project files
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Get all audio files in the project, ordered by creation date
        audio_files = (
            db.query(AudioFile)
            .filter(AudioFile.project_id == project_id)
            .order_by(AudioFile.created_at)
            .all()
        )

        if not audio_files:
            raise ValueError(f"No audio files found in project {project_id}")

        # Get speakers if needed
        speakers_map = {}
        if include_speakers:
            speakers = (
                db.query(Speaker)
                .filter(Speaker.project_id == project_id)
                .all()
            )
            speakers_map = {s.id: s.display_name for s in speakers}

        # Calculate total duration for only transcribed files
        transcribed_files = [f for f in audio_files if f.transcription_status == TranscriptionStatus.COMPLETED]
        total_duration = sum(f.duration or 0 for f in transcribed_files)

        # Build text
        lines = [
            f"Project: {project.name}",
            f"Description: {project.description or 'No description'}",
        ]
        
        # Add content type if available
        if project.content_type:
            lines.append(f"Content Type: {project.content_type}")
            
        lines.extend([
            f"Files: {len(audio_files)}",
            f"Total Duration: {self._format_duration(total_duration)}",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "",
            "=" * 80,
            ""
        ])

        # Process each file
        cumulative_offset = 0.0
        for file_idx, audio_file in enumerate(audio_files):
            segments = (
                db.query(Segment)
                .filter(Segment.audio_file_id == audio_file.id)
                .filter(Segment.is_passive.is_(False))
                .order_by(Segment.sequence)
                .all()
            )

            if not segments:
                continue

            # File header
            lines.extend([
                f"FILE {file_idx + 1}: {audio_file.original_filename}",
                f"Duration: {self._format_duration(audio_file.duration)} | Segments: {len(segments)}",
                "-" * 60,
                ""
            ])

            # Add segments
            for segment in segments:
                text = segment.edited_text if (use_edited and segment.edited_text) else segment.original_text

                parts = []
                if include_timestamps:
                    # Adjust timestamps for project continuity
                    adj_start = segment.start_time + cumulative_offset
                    adj_end = segment.end_time + cumulative_offset
                    timestamp = f"[{self._format_time(adj_start)} - {self._format_time(adj_end)}]"
                    parts.append(timestamp)

                if include_speakers and segment.speaker_id and segment.speaker_id in speakers_map:
                    speaker_name = speakers_map[segment.speaker_id]
                    parts.append(f"{speaker_name}:")

                parts.append(text)
                lines.append(" ".join(parts))
                lines.append("")

            lines.append("")  # Extra space between files

            # Update cumulative offset for next file
            if audio_file.duration:
                cumulative_offset += audio_file.duration

        return "\n".join(lines)

    @staticmethod
    def _format_duration(seconds: Optional[float]) -> str:
        """Format duration for display."""
        if seconds is None:
            return "Unknown"
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"