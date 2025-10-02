"""
Audio file handling service.
"""
import os
import uuid
from pathlib import Path
from typing import BinaryIO
import magic
from pydub import AudioSegment

from ..core.config import settings


class AudioService:
    """Service for handling audio file storage and conversion."""

    ALLOWED_FORMATS = settings.ALLOWED_AUDIO_FORMATS
    MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE

    def __init__(self):
        self.storage_path = Path(settings.AUDIO_STORAGE_PATH)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def validate_file(self, file_content: bytes, filename: str) -> tuple[bool, str]:
        """
        Validate uploaded audio file.

        Args:
            file_content: File content bytes
            filename: Original filename

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file size
        if len(file_content) > self.MAX_FILE_SIZE:
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            return False, f"File size exceeds maximum allowed size of {max_mb}MB"

        # Check file extension
        file_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if file_ext not in self.ALLOWED_FORMATS:
            return False, f"File format '.{file_ext}' not supported. Allowed: {', '.join(self.ALLOWED_FORMATS)}"

        # Check file content type (magic bytes)
        try:
            mime = magic.from_buffer(file_content, mime=True)
            if not mime.startswith("audio/"):
                return False, f"File is not a valid audio file (detected: {mime})"
        except Exception as e:
            return False, f"Could not validate file type: {str(e)}"

        return True, ""

    def save_file(self, file_content: bytes, original_filename: str) -> tuple[str, str]:
        """
        Save uploaded file to storage.

        Args:
            file_content: File content bytes
            original_filename: Original filename

        Returns:
            Tuple of (unique_filename, file_path)
        """
        # Generate unique filename
        file_ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "mp3"
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = self.storage_path / unique_filename

        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)

        return unique_filename, str(file_path)

    def get_audio_duration(self, file_path: str) -> float:
        """
        Get duration of audio file in seconds.

        Args:
            file_path: Path to audio file

        Returns:
            Duration in seconds
        """
        audio = AudioSegment.from_file(file_path)
        return len(audio) / 1000.0  # Convert milliseconds to seconds

    def convert_to_wav(self, file_path: str) -> str:
        """
        Convert audio file to WAV format (required for Whisper/PyAnnote).

        Args:
            file_path: Path to source audio file

        Returns:
            Path to converted WAV file
        """
        audio = AudioSegment.from_file(file_path)

        # Set to mono, 16kHz sample rate (optimal for speech recognition)
        audio = audio.set_channels(1).set_frame_rate(16000)

        # Save as WAV
        wav_path = file_path.rsplit(".", 1)[0] + "_converted.wav"
        audio.export(wav_path, format="wav")

        return wav_path

    def delete_file(self, file_path: str) -> bool:
        """
        Delete audio file from storage.

        Args:
            file_path: Path to file to delete

        Returns:
            True if deleted successfully
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                # Also delete converted WAV if exists
                wav_path = file_path.rsplit(".", 1)[0] + "_converted.wav"
                if os.path.exists(wav_path):
                    os.remove(wav_path)
            return True
        except Exception:
            return False
