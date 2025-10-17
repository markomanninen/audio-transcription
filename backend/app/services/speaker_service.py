"""
Speaker diarization service using PyAnnote Audio.
"""
from typing import List, Dict
from sqlalchemy.orm import Session
from pyannote.audio import Pipeline
import torch

from ..core.config import settings
from ..models.audio_file import AudioFile
from ..models.segment import Segment
from ..models.speaker import Speaker


class SpeakerService:
    """Service for speaker diarization."""

    def __init__(self):
        self.pipeline = None

    def load_pipeline(self):
        """Load PyAnnote diarization pipeline (lazy loading)."""
        if self.pipeline is None:
            # Note: Requires HuggingFace token for pyannote models
            # For now, using a placeholder - user needs to configure
            try:
                hf_token = settings.HUGGINGFACE_HUB_TOKEN or None
                if not hf_token:
                    print("ℹ️ Hugging Face token not provided. If diarization fails, set HUGGINGFACE_HUB_TOKEN in backend/.env.")
                self.pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=hf_token
                )
                if settings.WHISPER_DEVICE == "cuda" and torch.cuda.is_available():
                    self.pipeline.to(torch.device("cuda"))
            except Exception as e:
                # Fall back to simple speaker assignment if pipeline unavailable
                print(f"Warning: Could not load speaker diarization pipeline: {e}")
                self.pipeline = None

    def perform_diarization(
        self,
        audio_file_id: int,
        db: Session
    ) -> List[Speaker]:
        """
        Perform speaker diarization on audio file.

        Args:
            audio_file_id: ID of audio file
            db: Database session

        Returns:
            List of identified speakers

        Raises:
            ValueError: If audio file not found
        """
        # Get audio file
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {audio_file_id} not found")

        # Load pipeline
        self.load_pipeline()

        if self.pipeline is None:
            # Fallback: Create single default speaker
            return self._create_default_speaker(audio_file, db)

        try:
            # Run diarization
            from .audio_service import AudioService
            audio_service = AudioService()
            wav_path = audio_service.convert_to_wav(audio_file.file_path)

            diarization = self.pipeline(wav_path)

            # Extract unique speakers
            speaker_labels = set()
            speaker_timeline = {}

            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speaker_labels.add(speaker)
                if speaker not in speaker_timeline:
                    speaker_timeline[speaker] = []
                speaker_timeline[speaker].append({
                    "start": turn.start,
                    "end": turn.end
                })

            # Create speaker records
            speakers = []
            colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"]

            for idx, speaker_label in enumerate(sorted(speaker_labels)):
                speaker = Speaker(
                    project_id=audio_file.project_id,
                    speaker_id=speaker_label,
                    display_name=f"Speaker {idx + 1}",
                    color=colors[idx % len(colors)]
                )
                db.add(speaker)
                db.flush()  # Get speaker ID
                speakers.append(speaker)

                # Assign speaker to segments based on timeline overlap
                self._assign_speaker_to_segments(
                    audio_file_id,
                    speaker.id,
                    speaker_timeline[speaker_label],
                    db
                )

            db.commit()
            return speakers

        except Exception as e:
            print(f"Error during diarization: {e}")
            return self._create_default_speaker(audio_file, db)

    def _create_default_speaker(self, audio_file: AudioFile, db: Session) -> List[Speaker]:
        """Create a single default speaker when diarization is unavailable."""
        speaker = Speaker(
            project_id=audio_file.project_id,
            speaker_id="SPEAKER_00",
            display_name="Speaker 1",
            color="#3B82F6"
        )
        db.add(speaker)
        db.flush()

        # Assign all segments to this speaker
        segments = db.query(Segment).filter(Segment.audio_file_id == audio_file.id).all()
        for segment in segments:
            segment.speaker_id = speaker.id

        db.commit()
        return [speaker]

    def _assign_speaker_to_segments(
        self,
        audio_file_id: int,
        speaker_id: int,
        timeline: List[Dict],
        db: Session
    ):
        """Assign speaker to segments based on timeline overlap."""
        segments = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).all()

        for segment in segments:
            segment_mid = (segment.start_time + segment.end_time) / 2

            # Check if segment midpoint falls within any speaker timeline
            for turn in timeline:
                if turn["start"] <= segment_mid <= turn["end"]:
                    segment.speaker_id = speaker_id
                    break

    def rename_speaker(
        self,
        speaker_id: int,
        new_name: str,
        db: Session
    ) -> Speaker:
        """
        Rename a speaker.

        Args:
            speaker_id: ID of speaker to rename
            new_name: New display name
            db: Database session

        Returns:
            Updated Speaker object
        """
        speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
        if not speaker:
            raise ValueError(f"Speaker {speaker_id} not found")

        speaker.display_name = new_name
        db.commit()
        db.refresh(speaker)
        return speaker
