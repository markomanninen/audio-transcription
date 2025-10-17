"""
Tests for transcription API endpoints.
"""
import pytest
from unittest.mock import Mock, patch
from io import BytesIO


@pytest.fixture
def project_with_file(client, temp_audio_dir, sample_audio_content):
    """Create a project with an uploaded file."""
    # Create project
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload file
    files = {"file": ("test.wav", BytesIO(sample_audio_content), "audio/wav")}
    upload_response = client.post(f"/api/upload/file/{project_id}", files=files)
    file_id = upload_response.json()["file_id"]

    return {"project_id": project_id, "file_id": file_id}


def test_get_transcription_status_pending(client, project_with_file):
    """Test getting status of untranscribed file."""
    file_id = project_with_file["file_id"]

    response = client.get(f"/api/transcription/{file_id}/status")
    assert response.status_code == 200
    data = response.json()
    assert data["file_id"] == file_id
    assert data["status"] == "pending"
    assert data["progress"] == 0.0
    assert data["segment_count"] == 0


def test_get_transcription_status_invalid_file(client):
    """Test getting status for non-existent file."""
    response = client.get("/api/transcription/99999/status")
    assert response.status_code == 404


def test_start_transcription(client, project_with_file, test_db):
    """Test starting transcription."""
    file_id = project_with_file["file_id"]

    # Patch SessionLocal where it's imported (in the function)
    with patch('app.core.database.SessionLocal') as mock_session, \
         patch('app.api.transcription.initialize_transcription_service') as mock_init, \
         patch('app.api.transcription.add_pending_transcription') as mock_add_pending:
        mock_session.return_value = test_db
        mock_init.return_value = None
        mock_add_pending.return_value = None

        response = client.post(
            f"/api/transcription/{file_id}/start",
            json={"include_diarization": True}
        )
        assert response.status_code == 202
        data = response.json()
        assert data["file_id"] == file_id
        assert data["include_diarization"] is True


def test_get_segments_empty(client, project_with_file):
    """Test getting segments before transcription."""
    file_id = project_with_file["file_id"]

    response = client.get(f"/api/transcription/{file_id}/segments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_get_speakers_empty(client, project_with_file):
    """Test getting speakers before diarization."""
    file_id = project_with_file["file_id"]

    response = client.get(f"/api/transcription/{file_id}/speakers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@patch('app.services.transcription_service.whisper')
def test_transcription_service(mock_whisper, test_db, temp_audio_dir):
    """Test transcription service with mocked Whisper."""
    from app.services.transcription_service import TranscriptionService
    from app.models.project import Project
    from app.models.audio_file import AudioFile
    import tempfile

    # Create test project and file
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    # Create temporary audio file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(b'\x00' * 1000)
        temp_path = f.name

    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="test.wav",
        file_path=temp_path,
        file_size=1000,
        format="wav"
    )
    test_db.add(audio_file)
    test_db.commit()

    # Mock Whisper model
    mock_model = Mock()
    mock_model.transcribe.return_value = {
        "segments": [
            {
                "start": 0.0,
                "end": 5.0,
                "text": "Hello, this is a test."
            },
            {
                "start": 5.0,
                "end": 10.0,
                "text": "This is the second segment."
            }
        ]
    }
    mock_whisper.load_model.return_value = mock_model

    # Run transcription
    service = TranscriptionService()
    with patch('app.services.audio_service.AudioService.convert_to_wav', return_value=temp_path):
        segments = service.transcribe_audio(audio_file.id, test_db)

    # Verify results
    assert len(segments) == 2
    assert segments[0].original_text == "Hello, this is a test."
    assert segments[1].original_text == "This is the second segment."
    assert segments[0].start_time == 0.0
    assert segments[1].end_time == 10.0

    # Cleanup
    import os
    if os.path.exists(temp_path):
        os.remove(temp_path)
