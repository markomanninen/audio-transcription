"""
Tests for export functionality.
"""
import pytest

from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.segment import Segment
from app.models.speaker import Speaker
from app.models.project import Project


def test_export_srt_success(client, test_db, sample_project, sample_audio_file, sample_segments, sample_speakers):
    """Test successful SRT export."""
    response = client.get(
        f"/api/export/{sample_audio_file.id}/srt",
        params={"use_edited": True, "include_speakers": True}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
    assert "attachment" in response.headers["content-disposition"]

    # Check SRT format
    content = response.text
    assert "1\n" in content  # Sequence number
    assert "-->" in content  # Timestamp separator
    assert "00:00:" in content  # Time format


def test_export_srt_without_speakers(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test SRT export without speaker names."""
    response = client.get(
        f"/api/export/{sample_audio_file.id}/srt",
        params={"use_edited": True, "include_speakers": False}
    )

    assert response.status_code == 200
    content = response.text
    # Should not contain speaker tags
    assert "[Speaker" not in content


def test_export_srt_original_text(client, test_db, sample_project, sample_audio_file, sample_segments_with_edits):
    """Test SRT export using original text instead of edited."""
    response = client.get(
        f"/api/export/{sample_audio_file.id}/srt",
        params={"use_edited": False, "include_speakers": False}
    )

    assert response.status_code == 200
    content = response.text
    # Should contain original text, not edited
    assert "Original text" in content
    assert "Edited text" not in content


def test_export_html_success(client, test_db, sample_project, sample_audio_file, sample_segments, sample_speakers):
    """Test successful HTML export."""
    response = client.get(
        f"/api/export/{sample_audio_file.id}/html",
        params={"use_edited": True, "include_speakers": True, "include_timestamps": True}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"

    content = response.text
    assert "<!DOCTYPE html>" in content
    assert "<html>" in content
    assert "Transcription" in content
    assert sample_audio_file.original_filename in content


def test_export_html_without_timestamps(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test HTML export without timestamps."""
    response = client.get(
        f"/api/export/{sample_audio_file.id}/html",
        params={"use_edited": True, "include_speakers": False, "include_timestamps": False}
    )

    assert response.status_code == 200
    content = response.text
    # Should not contain timestamp divs (CSS class definition is OK, but no actual timestamp elements)
    assert "class='timestamp'" not in content and "<div class=\"timestamp\">" not in content


def test_export_txt_success(client, test_db, sample_project, sample_audio_file, sample_segments, sample_speakers):
    """Test successful TXT export."""
    response = client.get(
        f"/api/export/{sample_audio_file.id}/txt",
        params={"use_edited": True, "include_speakers": True, "include_timestamps": False}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/plain; charset=utf-8"

    content = response.text
    assert "Transcription:" in content
    assert sample_audio_file.original_filename in content
    assert "=" * 80 in content  # Separator line


def test_export_txt_with_timestamps(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test TXT export with timestamps."""
    response = client.get(
        f"/api/export/{sample_audio_file.id}/txt",
        params={"use_edited": True, "include_speakers": False, "include_timestamps": True}
    )

    assert response.status_code == 200
    content = response.text
    # Should contain timestamp brackets
    assert "[" in content and "]" in content
    assert ":" in content  # Time separator


def test_export_file_not_found(client, test_db):
    """Test export with non-existent file ID."""
    response = client.get("/api/export/99999/srt")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_export_multiple_segments(client, test_db, sample_project, sample_audio_file):
    """Test export with multiple segments."""
    # Create multiple segments
    segments = [
        Segment(
            audio_file_id=sample_audio_file.id,
            start_time=i * 10.0,
            end_time=(i + 1) * 10.0,
            original_text=f"Segment {i + 1} text",
            sequence=i
        )
        for i in range(5)
    ]

    for seg in segments:
        test_db.add(seg)
    test_db.commit()

    response = client.get(f"/api/export/{sample_audio_file.id}/srt")
    assert response.status_code == 200

    content = response.text
    # Should have 5 segments
    for i in range(1, 6):
        assert f"{i}\n" in content
        assert f"Segment {i} text" in content


def test_export_filename_format(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test that export filenames are correctly formatted."""
    response = client.get(f"/api/export/{sample_audio_file.id}/srt")

    assert response.status_code == 200

    disposition = response.headers["content-disposition"]
    assert "attachment" in disposition
    assert "filename=" in disposition
    assert "_transcription.srt" in disposition
