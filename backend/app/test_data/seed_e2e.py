"""
Seed data for local end-to-end testing.

This module creates a deterministic project with a mix of completed and pending
transcriptions so Playwright suites can exercise UI flows without relying on
manually prepared databases.
"""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable

from ..core.config import settings
from ..core.database import SessionLocal
from ..models.audio_file import AudioFile, TranscriptionStatus
from ..models.project import Project
from ..models.segment import Segment
from ..models.speaker import Speaker


SEED_PROJECT_NAME = "E2E Sample Project"


def _copy_asset(source: Path, target: Path) -> None:
    """
    Ensure the seed audio exists in the storage directory.

    Args:
        source: Path to the source asset.
        target: Destination path inside storage.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return

    if not source.exists():
        # Create an empty placeholder so routes that stream audio succeed.
        target.write_bytes(b"")
        return

    shutil.copyfile(source, target)


def _create_segments(
    audio_file_id: int,
    speakers: Iterable[Speaker],
) -> list[Segment]:
    """Build a consistent transcript for seeded completed files."""
    speaker_cycle = list(speakers)
    if not speaker_cycle:
        speaker_cycle = [None]

    base_lines = [
        (0.0, 6.2, "Welcome! Thanks for meeting today to review the release plan."),
        (6.2, 13.5, "Absolutely, I'm excited to walk through the milestones."),
        (13.5, 21.0, "Let's start with the transcription experience and status syncing."),
        (21.0, 28.4, "Segment caching has been rock-solid since the recent fixes."),
        (28.4, 36.0, "Great. We'll capture remaining action items before we wrap up."),
        (36.0, 44.5, "Perfect, I'll follow up with documentation after this call."),
    ]

    segments: list[Segment] = []
    for index, (start, end, text) in enumerate(base_lines, start=1):
        speaker = speaker_cycle[(index - 1) % len(speaker_cycle)]
        segments.append(
            Segment(
                audio_file_id=audio_file_id,
                speaker_id=speaker.id if isinstance(speaker, Speaker) else None,
                start_time=start,
                end_time=end,
                original_text=text,
                edited_text=text,
                sequence=index,
            )
        )
    return segments


def seed_e2e_data() -> None:
    """
    Populate the SQLite database with deterministic sample data.

    The seed includes:
      * One project (`E2E Sample Project`)
      * Two completed audio files with segments and speakers
      * One pending audio file ready for new uploads/restarts
    """
    session = SessionLocal()
    try:
        existing = (
            session.query(Project)
            .filter(Project.name == SEED_PROJECT_NAME)
            .first()
        )
        if existing:
            print("ℹ️  E2E seed data already present; skipping seeding.")
            return

        now = datetime.utcnow()
        storage_root = Path(settings.AUDIO_STORAGE_PATH).resolve()
        repo_root = Path(__file__).resolve().parents[3]
        seed_assets = repo_root / "tests" / "e2e"

        project = Project(
            name=SEED_PROJECT_NAME,
            description="Pre-seeded dataset for automated Playwright flows",
            content_type="interview",
        )
        session.add(project)
        session.flush()

        speaker_alex = Speaker(
            project_id=project.id,
            speaker_id="SPEAKER_01",
            display_name="Alex",
            color="#2563EB",
        )
        speaker_jordan = Speaker(
            project_id=project.id,
            speaker_id="SPEAKER_02",
            display_name="Jordan",
            color="#F97316",
        )
        session.add_all([speaker_alex, speaker_jordan])
        session.flush()

        # Completed file #1
        completed_one_src = seed_assets / "assets" / "Kaartintorpantie-clip.m4a"
        completed_one_path = storage_root / "e2e-completed-01.m4a"
        _copy_asset(completed_one_src, completed_one_path)

        completed_one = AudioFile(
            project_id=project.id,
            filename=completed_one_path.name,
            original_filename="Quarterly Planning.m4a",
            file_path=str(completed_one_path),
            file_size=completed_one_path.stat().st_size if completed_one_path.exists() else 0,
            duration=45.0,
            format="m4a",
            language="en",
            transcription_status=TranscriptionStatus.COMPLETED,
            transcription_progress=1.0,
            error_message=None,
            transcription_started_at=now - timedelta(minutes=18),
            transcription_completed_at=now - timedelta(minutes=16),
            transcription_duration_seconds=120.0,
            model_used="small",
            processing_stats=json.dumps({"seed": True}),
            audio_transformed=True,
            audio_transformation_path=None,
            whisper_model_loaded="small",
            transcription_stage="completed",
            last_processed_segment=6,
            processing_checkpoint=None,
            resume_token=None,
            transcription_metadata=json.dumps(
                {
                    "source": "seed",
                    "note": "Completed interview with diarization",
                    "model_size": "small",
                    "language": "en",
                    "include_diarization": True,
                }
            ),
            interruption_count=0,
            last_error_at=None,
            recovery_attempts=0,
        )
        session.add(completed_one)
        session.flush()

        session.add_all(_create_segments(completed_one.id, [speaker_alex, speaker_jordan]))

        # Completed file #2
        completed_two_src = seed_assets / "test-data" / "test-audio-30s.mp3"
        completed_two_path = storage_root / "e2e-completed-02.mp3"
        _copy_asset(completed_two_src, completed_two_path)

        completed_two = AudioFile(
            project_id=project.id,
            filename=completed_two_path.name,
            original_filename="Product Demo Recap.mp3",
            file_path=str(completed_two_path),
            file_size=completed_two_path.stat().st_size if completed_two_path.exists() else 0,
            duration=30.0,
            format="mp3",
            language="en",
            transcription_status=TranscriptionStatus.COMPLETED,
            transcription_progress=1.0,
            error_message=None,
            transcription_started_at=now - timedelta(minutes=14),
            transcription_completed_at=now - timedelta(minutes=13),
            transcription_duration_seconds=90.0,
            model_used="small",
            processing_stats=json.dumps({"seed": True, "segments": 5}),
            audio_transformed=True,
            audio_transformation_path=None,
            whisper_model_loaded="small",
            transcription_stage="completed",
            last_processed_segment=6,
            processing_checkpoint=None,
            resume_token=None,
            transcription_metadata=json.dumps(
                {
                    "source": "seed",
                    "note": "Completed demo recap",
                    "model_size": "small",
                    "language": "en",
                    "include_diarization": True,
                }
            ),
            interruption_count=0,
            last_error_at=None,
            recovery_attempts=0,
        )
        session.add(completed_two)
        session.flush()

        session.add_all(_create_segments(completed_two.id, [speaker_jordan, speaker_alex]))

        # Pending file awaiting transcription
        pending_src = seed_assets / "test-data" / "test-audio-30s.mp3"
        pending_path = storage_root / "e2e-pending-01.mp3"
        _copy_asset(pending_src, pending_path)

        pending_file = AudioFile(
            project_id=project.id,
            filename=pending_path.name,
            original_filename="Team Sync.mp3",
            file_path=str(pending_path),
            file_size=pending_path.stat().st_size if pending_path.exists() else 0,
            duration=30.0,
            format="mp3",
            language="en",
            transcription_status=TranscriptionStatus.PENDING,
            transcription_progress=0.0,
            error_message=None,
            transcription_started_at=None,
            transcription_completed_at=None,
            transcription_duration_seconds=None,
            model_used=None,
            processing_stats=None,
            audio_transformed=False,
            audio_transformation_path=None,
            whisper_model_loaded=None,
            transcription_stage="pending",
            last_processed_segment=0,
            processing_checkpoint=None,
            resume_token=None,
            transcription_metadata=json.dumps(
                {
                    "source": "seed",
                    "note": "Awaiting transcription",
                    "model_size": "small",
                    "language": "en",
                    "include_diarization": True,
                }
            ),
            interruption_count=0,
            last_error_at=None,
            recovery_attempts=0,
        )
        session.add(pending_file)

        session.commit()
        print("✅ Seeded E2E sample project with completed and pending audio files.")
    finally:
        session.close()
