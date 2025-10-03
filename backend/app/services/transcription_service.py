"""
Transcription service using Whisper.
"""
import whisper
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.audio_file import AudioFile, TranscriptionStatus
from ..models.segment import Segment
from .audio_service import AudioService


class TranscriptionService:
    """Service for transcribing audio files using Whisper."""

    def __init__(self):
        self.model_size = settings.WHISPER_MODEL_SIZE
        self.device = settings.WHISPER_DEVICE
        self.model = None

    def load_model(self):
        """Load Whisper model (lazy loading)."""
        if self.model is None:
            self.model = whisper.load_model(
                self.model_size,
                device=self.device
            )

    def transcribe_audio(
        self,
        audio_file_id: int,
        db: Session
    ) -> List[Segment]:
        """
        Transcribe audio file and create segments.

        Args:
            audio_file_id: ID of audio file to transcribe
            db: Database session

        Returns:
            List of created Segment objects

        Raises:
            ValueError: If audio file not found or already transcribed
        """
        # Get audio file record
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {audio_file_id} not found")

        if audio_file.transcription_status == TranscriptionStatus.COMPLETED:
            raise ValueError(f"Audio file {audio_file_id} already transcribed")

        try:
            # Update status to processing
            audio_file.transcription_status = TranscriptionStatus.PROCESSING
            audio_file.transcription_progress = 0.0
            db.commit()

            # Convert to WAV if needed
            audio_service = AudioService()
            wav_path = audio_service.convert_to_wav(audio_file.file_path)

            # Load model
            self.load_model()

            # Transcribe with word-level timestamps
            # Use specified language or auto-detect (None)
            language = audio_file.language if audio_file.language else None
            result = self.model.transcribe(
                wav_path,
                word_timestamps=True,
                language=language,  # Auto-detect if None, or use specified language code
                task="transcribe"
            )

            # Update progress
            audio_file.transcription_progress = 0.5
            db.commit()

            # Create segments from transcription
            segments = []
            for i, segment_data in enumerate(result["segments"]):
                segment = Segment(
                    audio_file_id=audio_file_id,
                    start_time=segment_data["start"],
                    end_time=segment_data["end"],
                    original_text=segment_data["text"].strip(),
                    sequence=i
                )
                db.add(segment)
                segments.append(segment)

            # Update status to completed
            audio_file.transcription_status = TranscriptionStatus.COMPLETED
            audio_file.transcription_progress = 1.0
            db.commit()

            return segments

        except Exception as e:
            # Update status to failed
            audio_file.transcription_status = TranscriptionStatus.FAILED
            audio_file.error_message = str(e)
            db.commit()
            raise

    def get_transcription_info(self, audio_file_id: int, db: Session) -> Dict[str, Any]:
        """
        Get transcription status and info.

        Args:
            audio_file_id: ID of audio file
            db: Database session

        Returns:
            Dictionary with transcription info
        """
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {audio_file_id} not found")

        segment_count = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).count()

        return {
            "file_id": audio_file.id,
            "status": audio_file.transcription_status.value,
            "progress": audio_file.transcription_progress,
            "error_message": audio_file.error_message,
            "segment_count": segment_count,
            "duration": audio_file.duration
        }
