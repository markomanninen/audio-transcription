"""
Tests for database models.
"""
import pytest
from app.models.project import Project
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.speaker import Speaker
from app.models.segment import Segment
from app.models.edit import Edit


def test_create_project(test_db):
    """Test creating a project."""
    project = Project(name="Test Project", description="A test project")
    test_db.add(project)
    test_db.commit()

    assert project.id is not None
    assert project.name == "Test Project"
    assert project.created_at is not None


def test_create_audio_file(test_db):
    """Test creating an audio file."""
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="original.wav",
        file_path="/path/to/test.wav",
        file_size=1024,
        format="wav",
        duration=10.5
    )
    test_db.add(audio_file)
    test_db.commit()

    assert audio_file.id is not None
    assert audio_file.transcription_status == TranscriptionStatus.PENDING
    assert audio_file.duration == 10.5


def test_create_speaker(test_db):
    """Test creating a speaker."""
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    speaker = Speaker(
        project_id=project.id,
        speaker_id="SPEAKER_00",
        display_name="John Doe",
        color="#3B82F6"
    )
    test_db.add(speaker)
    test_db.commit()

    assert speaker.id is not None
    assert speaker.display_name == "John Doe"


def test_create_segment(test_db):
    """Test creating a segment."""
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="test.wav",
        file_path="/path/to/test.wav",
        file_size=1024,
        format="wav"
    )
    test_db.add(audio_file)
    test_db.flush()

    segment = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=5.0,
        original_text="Hello world",
        sequence=0
    )
    test_db.add(segment)
    test_db.commit()

    assert segment.id is not None
    assert segment.current_text == "Hello world"


def test_segment_current_text_property(test_db):
    """Test segment current_text property."""
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="test.wav",
        file_path="/path/to/test.wav",
        file_size=1024,
        format="wav"
    )
    test_db.add(audio_file)
    test_db.flush()

    segment = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=5.0,
        original_text="Original text",
        sequence=0
    )
    test_db.add(segment)
    test_db.commit()

    # No edit yet
    assert segment.current_text == "Original text"

    # Add edit
    segment.edited_text = "Edited text"
    test_db.commit()
    assert segment.current_text == "Edited text"


def test_create_edit(test_db):
    """Test creating an edit record."""
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="test.wav",
        file_path="/path/to/test.wav",
        file_size=1024,
        format="wav"
    )
    test_db.add(audio_file)
    test_db.flush()

    segment = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=5.0,
        original_text="Original",
        sequence=0
    )
    test_db.add(segment)
    test_db.flush()

    edit = Edit(
        segment_id=segment.id,
        previous_text="Original",
        new_text="Edited",
        edit_type="manual"
    )
    test_db.add(edit)
    test_db.commit()

    assert edit.id is not None
    assert edit.edit_type == "manual"


def test_project_cascade_delete(test_db):
    """Test that deleting project deletes related records."""
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="test.wav",
        file_path="/path/to/test.wav",
        file_size=1024,
        format="wav"
    )
    test_db.add(audio_file)
    test_db.commit()

    # Delete project
    test_db.delete(project)
    test_db.commit()

    # Audio file should be deleted
    assert test_db.query(AudioFile).filter(AudioFile.id == audio_file.id).first() is None
