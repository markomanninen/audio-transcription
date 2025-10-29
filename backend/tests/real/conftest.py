"""
Conftest for REAL (non-stub) integration tests.

This directory is for tests that need REAL dependencies like Whisper, torch, etc.
DO NOT stub anything here - tests should use actual implementations.
"""
import sys
import os

# CRITICAL: Remove parent conftest stubs and load real modules
# Parent conftest runs FIRST and creates stubs in sys.modules
# We must DELETE those stubs BEFORE importing real modules

print("[tests/real/conftest.py] Removing parent conftest stubs...")
print(f"Before removal - 'whisper' in sys.modules: {'whisper' in sys.modules}")
print(f"Before removal - 'torch' in sys.modules: {'torch' in sys.modules}")

# DELETE the stubs created by parent conftest
stubbed_modules = ["whisper", "torch", "pydub", "magic", "pyannote", "pyannote.audio"]
for module_name in stubbed_modules:
    if module_name in sys.modules:
        print(f"Removing stub: {module_name}")
        del sys.modules[module_name]

print("Loading REAL modules...")

# NOW import the real modules (Python will load them since they're no longer in sys.modules)
import pydub
import magic
import whisper
import torch

print(f"Real whisper module loaded: {type(whisper)} - has load_model: {hasattr(whisper, 'load_model')}")
print(f"Real torch module loaded: {type(torch)} - has cuda: {hasattr(torch, 'cuda')}")

# Force real modules into sys.modules
sys.modules["pydub"] = pydub
sys.modules["magic"] = magic
sys.modules["whisper"] = whisper
sys.modules["torch"] = torch

print("[tests/real/conftest.py] Real modules installed in sys.modules")

# CRITICAL: Reload modules that may have imported the stubs at module load time
# This ensures they re-import the REAL modules instead of using cached stubs
import importlib
if "app.services.audio_service" in sys.modules:
    print("Reloading audio_service to pick up real pydub")
    import app.services.audio_service
    importlib.reload(app.services.audio_service)

# NOW we can continue with other imports
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import tempfile

# Import from parent conftest for shared fixtures
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.main import app as fastapi_app
from app.core import database as app_database
from app.core.database import get_db
from app.models.base import Base
from app.models.project import Project
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.segment import Segment
from app.models.speaker import Speaker


@pytest.fixture(scope="function")
def test_db():
    """Create a test database for each test."""
    # Use a TEMP FILE database instead of :memory: to allow sharing between threads
    # SQLite :memory: databases are per-connection and don't share data between threads
    import tempfile
    import os

    # Create a temporary database file
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)

    try:
        # Use check_same_thread=False to allow database access from background threads
        engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,  # Use StaticPool for thread-safe database
        )
        Base.metadata.create_all(bind=engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

        # Store engine and sessionmaker in app state so background threads can access it
        fastapi_app.state.test_engine = engine
        fastapi_app.state.test_sessionmaker = TestingSessionLocal

        # CRITICAL: Override the global SessionLocal used by transcribe_task
        # transcribe_task creates its own session via SessionLocal() instead of using dependency injection
        import app.core.database as db_module
        original_session_local = db_module.SessionLocal
        db_module.SessionLocal = TestingSessionLocal

        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            # Restore original SessionLocal
            db_module.SessionLocal = original_session_local
            engine.dispose()
    finally:
        # Clean up the temporary database file
        if os.path.exists(db_path):
            os.unlink(db_path)


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client with the test database."""
    def override_get_db():
        # Create a NEW session for each request (thread-safe)
        db = fastapi_app.state.test_sessionmaker()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as client:
        yield client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sample_project(test_db):
    """Create a sample project for testing."""
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.commit()
    test_db.refresh(project)
    return project


@pytest.fixture(scope="function")
def sample_audio_file(test_db, sample_project):
    """Create a sample audio file for testing."""
    # Find the correct path to test audio fixture
    # Look in multiple possible locations
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "tests", "fixtures", "test-audio-30s.mp3"),
        os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures", "test-audio-30s.mp3"),
        "/Users/markomanninen/Documents/GitHub/transcribe/tests/fixtures/test-audio-30s.mp3",
    ]

    test_audio_path = None
    for path in possible_paths:
        if os.path.exists(path):
            test_audio_path = path
            break

    if not test_audio_path:
        # Print available paths for debugging
        print(f"Could not find test-audio-30s.mp3 in any of these locations:")
        for path in possible_paths:
            print(f"  - {path} (exists: {os.path.exists(path)})")

        # List what's actually in the fixtures directory
        fixtures_dir = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures")
        if os.path.exists(fixtures_dir):
            print(f"\nContents of {fixtures_dir}:")
            print(f"  {os.listdir(fixtures_dir)}")

    # Create temp file
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.mp3', delete=False) as tmp:
        if test_audio_path and os.path.exists(test_audio_path):
            print(f"Using test audio file: {test_audio_path}")
            with open(test_audio_path, 'rb') as src:
                tmp.write(src.read())
        else:
            print(" Creating minimal MP3 file (no real audio fixture found)")
            # Create minimal MP3 if fixture doesn't exist
            tmp.write(b'\xff\xfb' + b'\x00' * 1000)
        tmp_path = tmp.name

    audio_file = AudioFile(
        project_id=sample_project.id,
        filename="test-audio.mp3",  # Required field
        original_filename="test-audio-30s.mp3",
        file_path=tmp_path,
        file_size=os.path.getsize(tmp_path),
        duration=30.0,
        format="mp3",  # Required field
        transcription_status=TranscriptionStatus.PENDING
    )
    test_db.add(audio_file)
    test_db.commit()
    test_db.refresh(audio_file)

    # CRITICAL: Flush the session to ensure the audio file is written to the database
    # This makes it visible to other sessions (like the background thread)
    test_db.flush()

    yield audio_file

    # Cleanup
    if os.path.exists(tmp_path):
        os.unlink(tmp_path)
