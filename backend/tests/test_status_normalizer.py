"""
Tests for the status normalization helper.
"""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.project import Project
from app.services.status_normalizer import normalize_transcription_statuses


@pytest.fixture()
def temp_engine():
    """Provide an isolated SQLite engine for tests."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture()
def session(temp_engine):
    """Session bound to the temporary engine."""
    Session = sessionmaker(bind=temp_engine, autocommit=False, autoflush=False)
    db_session = Session()
    try:
        yield db_session
    finally:
        db_session.close()


def test_normalize_transcription_statuses_converts_lowercase(session, temp_engine):
    """Lowercase statuses are coerced to uppercase enum values."""
    project = Project(name="Normalization Project")
    session.add(project)
    session.flush()

    audio = AudioFile(
        project_id=project.id,
        filename="normalize.wav",
        original_filename="normalize.wav",
        file_path="/tmp/normalize.wav",
        file_size=128,
        format="wav",
    )
    session.add(audio)
    session.commit()

    # Force legacy lowercase value via raw SQL to mimic regression data
    session.execute(
        text(
            "UPDATE audio_files SET transcription_status = 'pending' WHERE id = :id"
        ),
        {"id": audio.id},
    )
    session.commit()

    result = normalize_transcription_statuses(temp_engine)
    assert result["normalized"] >= 1

    session.expire_all()
    refreshed = session.get(AudioFile, audio.id)
    assert refreshed.transcription_status == TranscriptionStatus.PENDING


def test_audiofile_accepts_lowercase_assignment():
    """Model validation coerces lowercase assignments to the enum."""
    audio = AudioFile(
        project_id=1,
        filename="lowercase.wav",
        original_filename="lowercase.wav",
        file_path="/tmp/lowercase.wav",
        file_size=64,
        format="wav",
    )

    audio.transcription_status = "pending"

    assert audio.transcription_status == TranscriptionStatus.PENDING
