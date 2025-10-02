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
