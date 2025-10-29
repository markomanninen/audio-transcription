"""
Audio file handling service.
"""
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List
from io import BytesIO
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
            # Accept audio MIME types and specific video formats that contain audio
            allowed_mimes = ["audio/", "video/mp4", "video/x-m4v"]
            if not any(mime.startswith(prefix) for prefix in allowed_mimes):
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
        import logging
        logger = logging.getLogger(__name__)

        # Verify source file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Source audio file does not exist: {file_path}")

        logger.info(f"Converting audio file: {file_path} (size: {os.path.getsize(file_path)} bytes)")

        audio = AudioSegment.from_file(file_path)
        logger.info(f"Loaded audio: duration={len(audio)}ms, channels={audio.channels}, frame_rate={audio.frame_rate}Hz")

        # Set to mono, 16kHz sample rate (optimal for speech recognition)
        audio = audio.set_channels(1).set_frame_rate(16000)
        logger.info(f"Converted to mono 16kHz: duration={len(audio)}ms")

        # Save as WAV - use a more reliable path construction
        # For temp files, use the temp directory explicitly
        if '/tmp' in file_path or file_path.startswith('/var/folders'):
            # For temp files, create WAV in /tmp
            import tempfile
            fd, wav_path = tempfile.mkstemp(suffix='_converted.wav', prefix='audio_')
            os.close(fd)  # Close the file descriptor, pydub will open it
            logger.info(f"Using temp file for WAV output: {wav_path}")
        else:
            wav_path = file_path.rsplit(".", 1)[0] + "_converted.wav"
            logger.info(f"Using regular path for WAV output: {wav_path}")

        # Export to WAV file
        try:
            logger.info(f"Starting audio export to {wav_path}")
            result = audio.export(wav_path, format="wav")
            logger.info(f"Export call returned: {type(result)}")

            # Some versions of pydub return a file handle, ensure it's closed
            if result is not None and hasattr(result, 'close'):
                result.close()
                logger.info("Closed export file handle")
        except Exception as e:
            logger.error(f"Export failed with exception: {e}")
            raise RuntimeError(f"Failed to export WAV file to {wav_path}: {e}")

        # Verify file exists and has content
        logger.info(f"Verifying WAV file exists at {wav_path}")
        if not os.path.exists(wav_path):
            logger.error(f"WAV file was not created at {wav_path}")
            raise FileNotFoundError(f"Failed to create WAV file: {wav_path}")

        wav_size = os.path.getsize(wav_path)
        logger.info(f"WAV file created successfully: {wav_size} bytes")

        if wav_size == 0:
            raise ValueError(f"Created WAV file is empty: {wav_path}")

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

    def split_audio(
        self,
        file_path: str,
        chunk_duration_seconds: float,
        overlap_seconds: float = 0.0,
        original_display_name: str | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Split an audio file into multiple chunks.

        Args:
            file_path: Path to the source audio file
            chunk_duration_seconds: Desired chunk length in seconds
            overlap_seconds: Optional overlap between chunks in seconds
            original_display_name: Base display name used when generating chunk file names

        Returns:
            List of dictionaries containing metadata for each generated chunk

        Raises:
            ValueError: If input values are invalid or splitting cannot be performed
        """
        if chunk_duration_seconds <= 0:
            raise ValueError("Chunk duration must be greater than zero.")
        if overlap_seconds < 0:
            raise ValueError("Overlap cannot be negative.")

        audio = AudioSegment.from_file(file_path)
        total_duration_ms = len(audio)
        display_name = original_display_name or Path(file_path).name

        if total_duration_ms == 0:
            raise ValueError("Cannot split an empty audio file.")

        chunk_duration_ms = int(chunk_duration_seconds * 1000)
        overlap_duration_ms = int(overlap_seconds * 1000)

        if chunk_duration_ms <= 0:
            raise ValueError("Chunk duration too small, results in empty segments.")
        if overlap_duration_ms >= chunk_duration_ms:
            raise ValueError("Overlap must be smaller than chunk duration.")

        if chunk_duration_ms >= total_duration_ms:
            raise ValueError("Chunk duration covers the entire audio; splitting not required.")

        # Force use wav format for chunks to avoid FFmpeg codec issues
        extension = "wav"
        original_stem = Path(file_path).stem

        chunks: List[Dict[str, Any]] = []
        start_ms = 0
        index = 0

        while start_ms < total_duration_ms:
            end_ms = min(start_ms + chunk_duration_ms, total_duration_ms)
            segment = audio[start_ms:end_ms]

            buffer = BytesIO()
            segment.export(buffer, format=extension)
            buffer.seek(0)
            chunk_bytes = buffer.read()

            part_label = f"{index + 1:02d}"
            original_filename = f"{original_stem}_part_{part_label}.{extension}"
            unique_filename, stored_path = self.save_file(chunk_bytes, original_filename)

            chunks.append(
                {
                    "unique_filename": unique_filename,
                    "file_path": stored_path,
                    "original_filename": original_filename,
                    "file_size": len(chunk_bytes),
                    "duration": len(segment) / 1000.0,
                    "order_index": index,
                    "start_seconds": start_ms / 1000.0,
                    "end_seconds": end_ms / 1000.0,
                }
            )

            if end_ms >= total_duration_ms:
                break

            start_ms = end_ms - overlap_duration_ms
            index += 1

        if len(chunks) < 2:
            raise ValueError("Splitting produced fewer than two segments. Adjust chunk duration.")

        total_chunks = len(chunks)
        for chunk in chunks:
            prefix = f"{chunk['order_index'] + 1}/{total_chunks}"
            chunk["chunk_label"] = prefix
            chunk["chunk_total"] = total_chunks
            chunk["original_filename"] = f"{prefix} - {display_name}"

        return chunks
