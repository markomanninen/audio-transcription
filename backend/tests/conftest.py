"""
Test configuration and fixtures.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
import tempfile
import os

from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.project import Project
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.segment import Segment
from app.models.speaker import Speaker


# Test database URL (in-memory SQLite)
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db():
    """Create a test database session."""
    engine = create_engine(
        SQLALCHEMY_TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client with test database."""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def temp_audio_dir():
    """Create a temporary directory for audio files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Override settings for test
        from app.core.config import settings
        original_path = settings.AUDIO_STORAGE_PATH
        settings.AUDIO_STORAGE_PATH = tmpdir
        yield tmpdir
        settings.AUDIO_STORAGE_PATH = original_path


@pytest.fixture
def sample_audio_content():
    """Generate minimal valid audio file content for testing."""
    # Minimal WAV file header (44 bytes) + some data
    # RIFF header
    wav_header = b'RIFF'
    wav_header += (36 + 1000).to_bytes(4, 'little')  # File size - 8
    wav_header += b'WAVE'
    # fmt chunk
    wav_header += b'fmt '
    wav_header += (16).to_bytes(4, 'little')  # fmt chunk size
    wav_header += (1).to_bytes(2, 'little')   # audio format (PCM)
    wav_header += (1).to_bytes(2, 'little')   # number of channels
    wav_header += (16000).to_bytes(4, 'little')  # sample rate
    wav_header += (32000).to_bytes(4, 'little')  # byte rate
    wav_header += (2).to_bytes(2, 'little')   # block align
    wav_header += (16).to_bytes(2, 'little')  # bits per sample
    # data chunk
    wav_header += b'data'
    wav_header += (1000).to_bytes(4, 'little')  # data size
    wav_header += b'\x00' * 1000  # audio data

    return wav_header


@pytest.fixture
def sample_project(test_db):
    """Create a sample project for testing."""
    project = Project(
        name="Test Project",
        description="A test project for unit tests"
    )
    test_db.add(project)
    test_db.commit()
    test_db.refresh(project)
    return project


@pytest.fixture
def sample_audio_file(test_db, sample_project):
    """Create a sample audio file for testing."""
    audio_file = AudioFile(
        project_id=sample_project.id,
        filename="test_audio.mp3",
        original_filename="test_audio.mp3",
        file_path="data/audio/test_audio.mp3",
        file_size=1000,
        duration=60.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file)
    test_db.commit()
    test_db.refresh(audio_file)
    return audio_file


@pytest.fixture
def sample_segments(test_db, sample_audio_file):
    """Create sample segments for testing."""
    segments = [
        Segment(
            audio_file_id=sample_audio_file.id,
            start_time=0.0,
            end_time=10.0,
            original_text="This is the first segment.",
            sequence=0,
            speaker_id=None
        ),
        Segment(
            audio_file_id=sample_audio_file.id,
            start_time=10.0,
            end_time=20.0,
            original_text="This is the second segment.",
            sequence=1,
            speaker_id=None
        )
    ]
    for seg in segments:
        test_db.add(seg)
    test_db.commit()
    return segments


@pytest.fixture
def sample_segments_with_edits(test_db, sample_audio_file):
    """Create sample segments with edited text for testing."""
    segments = [
        Segment(
            audio_file_id=sample_audio_file.id,
            start_time=0.0,
            end_time=10.0,
            original_text="Original text segment one.",
            edited_text="Edited text segment one.",
            sequence=0
        ),
        Segment(
            audio_file_id=sample_audio_file.id,
            start_time=10.0,
            end_time=20.0,
            original_text="Original text segment two.",
            edited_text="Edited text segment two.",
            sequence=1
        )
    ]
    for seg in segments:
        test_db.add(seg)
    test_db.commit()
    return segments


@pytest.fixture
def sample_speakers(test_db, sample_project):
    """Create sample speakers for testing."""
    speakers = [
        Speaker(
            project_id=sample_project.id,
            speaker_id="SPEAKER_00",
            display_name="Speaker 1",
            color="#FF5733"
        ),
        Speaker(
            project_id=sample_project.id,
            speaker_id="SPEAKER_01",
            display_name="Speaker 2",
            color="#33FF57"
        )
    ]
    for speaker in speakers:
        test_db.add(speaker)
    test_db.commit()
    return speakers
