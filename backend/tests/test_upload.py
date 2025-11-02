"""
Tests for upload API endpoints.
"""
from io import BytesIO


def test_create_project(client):
    """Test creating a new project."""
    response = client.post(
        "/api/upload/project",
        json={"name": "Test Project", "description": "Test description"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["description"] == "Test description"
    assert "id" in data
    assert "created_at" in data


def test_create_project_minimal(client):
    """Test creating a project with minimal data."""
    response = client.post(
        "/api/upload/project",
        json={"name": "Minimal Project"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Minimal Project"
    assert data["description"] is None


def test_upload_file(client, temp_audio_dir, sample_audio_content):
    """Test uploading an audio file."""
    # Create project first
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload file
    files = {"file": ("test.wav", BytesIO(sample_audio_content), "audio/wav")}
    response = client.post(f"/api/upload/file/{project_id}", files=files)

    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "test.wav"
    assert data["file_size"] > 0
    assert data["status"] == "pending"
    assert "file_id" in data


def test_upload_file_invalid_project(client, sample_audio_content):
    """Test uploading to non-existent project."""
    files = {"file": ("test.wav", BytesIO(sample_audio_content), "audio/wav")}
    response = client.post("/api/upload/file/99999", files=files)
    assert response.status_code == 404


def test_upload_file_too_large(client):
    """Test uploading file that exceeds size limit."""
    # Create project
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Create oversized content (>500MB)
    from app.core.config import settings
    oversized_content = b'\x00' * (settings.MAX_UPLOAD_SIZE + 1000)

    files = {"file": ("large.wav", BytesIO(oversized_content), "audio/wav")}
    response = client.post(f"/api/upload/file/{project_id}", files=files)
    assert response.status_code == 400
    assert "exceeds maximum" in response.json()["detail"].lower()


def test_upload_invalid_format(client):
    """Test uploading unsupported file format."""
    # Create project
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload text file instead of audio
    files = {"file": ("test.txt", BytesIO(b"not an audio file"), "text/plain")}
    response = client.post(f"/api/upload/file/{project_id}", files=files)
    assert response.status_code == 400


def test_list_project_files(client, temp_audio_dir, sample_audio_content):
    """Test listing files in a project."""
    # Create project
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload two files
    for i in range(2):
        files = {"file": (f"test{i}.wav", BytesIO(sample_audio_content), "audio/wav")}
        client.post(f"/api/upload/file/{project_id}", files=files)

    # List files
    response = client.get(f"/api/upload/files/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_list_files_invalid_project(client):
    """Test listing files for non-existent project."""
    response = client.get("/api/upload/files/99999")
    assert response.status_code == 404


def test_upload_file_with_language(client, temp_audio_dir, sample_audio_content, test_db):
    """Test uploading an audio file with language parameter."""
    # Create project first
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload file with language
    files = {"file": ("test.wav", BytesIO(sample_audio_content), "audio/wav")}
    data = {"language": "fi"}
    response = client.post(f"/api/upload/file/{project_id}", files=files, data=data)

    assert response.status_code == 201
    response_data = response.json()
    assert response_data["original_filename"] == "test.wav"
    assert response_data["status"] == "pending"

    # Verify language is stored using test_db
    from app.models.audio_file import AudioFile
    audio_file = test_db.query(AudioFile).filter(AudioFile.id == response_data["file_id"]).first()
    assert audio_file is not None, "Audio file not found in database"
    assert audio_file.language == "fi", f"Expected language 'fi' but got '{audio_file.language}'"


def test_upload_file_with_autodetect_language(client, temp_audio_dir, sample_audio_content):
    """Test uploading an audio file with auto-detect (empty string)."""
    # Create project first
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload file with empty language (auto-detect)
    files = {"file": ("test.wav", BytesIO(sample_audio_content), "audio/wav")}
    data = {"language": ""}
    response = client.post(f"/api/upload/file/{project_id}", files=files, data=data)

    assert response.status_code == 201

    # Verify language is None in database (empty string should be treated as None)
    from app.models.audio_file import AudioFile
    from app.core.database import SessionLocal
    db = SessionLocal()
    audio_file = db.query(AudioFile).filter(AudioFile.id == response.json()["file_id"]).first()
    # Empty string or None both mean auto-detect
    assert audio_file.language in (None, "")
    db.close()


def test_upload_file_without_language(client, temp_audio_dir, sample_audio_content):
    """Test uploading an audio file without language parameter (defaults to auto-detect)."""
    # Create project first
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload file without language parameter
    files = {"file": ("test.wav", BytesIO(sample_audio_content), "audio/wav")}
    response = client.post(f"/api/upload/file/{project_id}", files=files)

    assert response.status_code == 201

    # Verify language is None (auto-detect)
    from app.models.audio_file import AudioFile
    from app.core.database import SessionLocal
    db = SessionLocal()
    audio_file = db.query(AudioFile).filter(AudioFile.id == response.json()["file_id"]).first()
    assert audio_file.language is None
    db.close()
