"""
Tests for upload API endpoints.
"""
import pytest
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
