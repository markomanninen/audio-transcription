"""Tests for clear transcription endpoint."""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.segment import Segment
from app.models.speaker import Speaker


def test_clear_transcription_success(client: TestClient, test_db: Session):
    """Test successful clearing of transcription data."""
    # Create project
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    # Create audio file with completed transcription
    audio_file = AudioFile(
        project_id=project.id,
        filename="test.mp3",
        original_filename="test.mp3",
        file_path="/test/test.mp3",
        file_size=1024,
        format="mp3",
        duration=30.0,
        transcription_status=TranscriptionStatus.COMPLETED,
        transcription_progress=100.0,
        model_used="tiny",
        transcription_metadata='{"model_size": "tiny", "language": "en"}',
        transcription_stage="completed"
    )
    test_db.add(audio_file)
    test_db.flush()

    # Create speaker
    speaker = Speaker(
        project_id=project.id,
        speaker_id="spk1",
        display_name="Test Speaker"
    )
    test_db.add(speaker)
    test_db.flush()

    # Create segments
    segment1 = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=5.0,
        original_text="First segment",
        sequence=0
    )
    segment2 = Segment(
        audio_file_id=audio_file.id,
        start_time=5.0,
        end_time=10.0,
        original_text="Second segment",
        sequence=1
    )
    test_db.add(segment1)
    test_db.add(segment2)
    test_db.commit()

    # Verify initial state
    assert test_db.query(Segment).filter(Segment.audio_file_id == audio_file.id).count() == 2
    assert test_db.query(Speaker).filter(Speaker.project_id == project.id).count() == 1
    assert audio_file.transcription_status == TranscriptionStatus.COMPLETED

    # Clear transcription
    response = client.delete(f"/api/transcription/{audio_file.id}/clear")
    
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "clear"
    assert data["deleted_segments"] == 2
    assert data["deleted_speakers"] == 1
    assert data["file_id"] == audio_file.id
    assert "CLEARED" in data["message"]

    # Verify data was cleared
    test_db.refresh(audio_file)
    assert audio_file.transcription_status == TranscriptionStatus.PENDING
    assert audio_file.transcription_progress == 0.0
    assert audio_file.error_message is None
    assert audio_file.transcription_started_at is None
    assert audio_file.transcription_completed_at is None
    assert audio_file.model_used is None
    assert audio_file.transcription_metadata is None
    assert audio_file.transcription_stage == "pending"

    # Verify segments and speakers were deleted
    assert test_db.query(Segment).filter(Segment.audio_file_id == audio_file.id).count() == 0
    assert test_db.query(Speaker).filter(Speaker.project_id == project.id).count() == 0


def test_clear_transcription_file_not_found(client: TestClient, test_db: Session):
    """Test clearing transcription for non-existent file."""
    response = client.delete("/api/transcription/999/clear")
    
    assert response.status_code == 404
    assert "Audio file not found" in response.json()["detail"]


def test_clear_transcription_empty_file(client: TestClient, test_db: Session):
    """Test clearing transcription for file with no existing data."""
    # Create project
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    # Create audio file without transcription data
    audio_file = AudioFile(
        project_id=project.id,
        filename="empty.mp3",
        original_filename="empty.mp3",
        file_path="/test/empty.mp3",
        file_size=1024,
        format="mp3",
        duration=30.0,
        transcription_status=TranscriptionStatus.PENDING
    )
    test_db.add(audio_file)
    test_db.commit()

    # Clear transcription (should work even with no data)
    response = client.delete(f"/api/transcription/{audio_file.id}/clear")
    
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "clear"
    assert data["deleted_segments"] == 0
    assert data["deleted_speakers"] == 0
    assert data["file_id"] == audio_file.id


def test_clear_transcription_preserves_other_files(client: TestClient, test_db: Session):
    """Test that clearing transcription only affects the target file."""
    # Create project
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    # Create two audio files
    audio_file1 = AudioFile(
        project_id=project.id,
        filename="file1.mp3",
        original_filename="file1.mp3",
        file_path="/test/file1.mp3",
        file_size=1024,
        format="mp3",
        duration=30.0,
        transcription_status=TranscriptionStatus.COMPLETED
    )
    audio_file2 = AudioFile(
        project_id=project.id,
        filename="file2.mp3",
        original_filename="file2.mp3",
        file_path="/test/file2.mp3",
        file_size=1024,
        format="mp3",
        duration=30.0,
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file1)
    test_db.add(audio_file2)
    test_db.flush()

    # Create segments for both files
    segment1 = Segment(
        audio_file_id=audio_file1.id,
        start_time=0.0,
        end_time=5.0,
        original_text="File 1 segment",
        sequence=0
    )
    segment2 = Segment(
        audio_file_id=audio_file2.id,
        start_time=0.0,
        end_time=5.0,
        original_text="File 2 segment",
        sequence=0
    )
    test_db.add(segment1)
    test_db.add(segment2)
    test_db.commit()

    # Clear transcription for first file only
    response = client.delete(f"/api/transcription/{audio_file1.id}/clear")
    
    assert response.status_code == 200

    # Verify only file1's segments were deleted
    assert test_db.query(Segment).filter(Segment.audio_file_id == audio_file1.id).count() == 0
    assert test_db.query(Segment).filter(Segment.audio_file_id == audio_file2.id).count() == 1

    # Verify file1 status was reset but file2 remains unchanged
    test_db.refresh(audio_file1)
    test_db.refresh(audio_file2)
    assert audio_file1.transcription_status == TranscriptionStatus.PENDING
    assert audio_file2.transcription_status == TranscriptionStatus.COMPLETED