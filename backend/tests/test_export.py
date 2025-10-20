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


def test_export_project_html_success(client, test_db, sample_project):
    """Test successful project export in HTML format."""
    # Create audio file with segments
    audio_file = AudioFile(
        project_id=sample_project.id,
        filename="file1.mp3",
        original_filename="file1.mp3",
        file_path="/test/file1.mp3",
        file_size=1024,
        duration=25.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )


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


def test_export_skips_passive_segments(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Passive segments should not appear in exports."""
    passive_segment = sample_segments[1]
    passive_segment.is_passive = True
    test_db.commit()

    response = client.get(f"/api/export/{sample_audio_file.id}/srt")
    assert response.status_code == 200

    content = response.text
    assert "This is the second segment." not in content


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


# Project Export Tests

def test_export_project_srt_success(client, test_db, sample_project):
    """Test successful project export in SRT format."""
    # Create two audio files with segments
    audio_file1 = AudioFile(
        project_id=sample_project.id,
        filename="file1.mp3",
        original_filename="file1.mp3",
        file_path="/test/file1.mp3",
        file_size=1024,
        duration=60.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    audio_file2 = AudioFile(
        project_id=sample_project.id,
        filename="file2.mp3",
        original_filename="file2.mp3",
        file_path="/test/file2.mp3",
        file_size=2048,
        duration=120.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file1)
    test_db.add(audio_file2)
    test_db.flush()

    # Create segments for each file
    segments1 = [
        Segment(
            audio_file_id=audio_file1.id,
            start_time=0.0,
            end_time=10.0,
            original_text="First file, first segment",
            sequence=0
        ),
        Segment(
            audio_file_id=audio_file1.id,
            start_time=10.0,
            end_time=20.0,
            original_text="First file, second segment",
            sequence=1
        )
    ]

    segments2 = [
        Segment(
            audio_file_id=audio_file2.id,
            start_time=0.0,
            end_time=15.0,
            original_text="Second file, first segment",
            sequence=0
        )
    ]

    for seg in segments1 + segments2:
        test_db.add(seg)
    test_db.commit()

    response = client.get(
        f"/api/export/project/{sample_project.id}/srt",
        params={"use_edited": True, "include_speakers": True}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
    assert "attachment" in response.headers["content-disposition"]

    content = response.text
    # Should contain all segments with adjusted timestamps
    assert "First file, first segment" in content
    assert "First file, second segment" in content
    assert "Second file, first segment" in content
    
    # Check that timestamps are adjusted for continuity
    assert "1\n" in content  # First segment
    assert "2\n" in content  # Second segment
    assert "3\n" in content  # Third segment (from second file)
    
    # File names should be included for context
    assert "[file1.mp3]" in content
    assert "[file2.mp3]" in content


def test_export_project_html_success(client, test_db, sample_project):
    """Test successful project HTML export with multiple files."""
    # Create audio files and segments (similar to SRT test)
    audio_file1 = AudioFile(
        project_id=sample_project.id,
        filename="file1.mp3",
        original_filename="file1.mp3",
        file_path="/test/file1.mp3",
        duration=30.0,
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file)
    test_db.flush()

    segment = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=10.0,
        original_text="Test segment content",
        sequence=0
    )
    test_db.add(segment)
    test_db.commit()

    response = client.get(
        f"/api/export/project/{sample_project.id}/html",
        params={"use_edited": True, "include_speakers": True, "include_timestamps": True}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"

    content = response.text
    assert "<!DOCTYPE html>" in content
    assert f"Project: {sample_project.name}" in content
    assert "File 1: file1.mp3" in content
    assert "Test segment content" in content
    assert "file-section" in content  # CSS class for file sections


def test_export_project_html_success(client, test_db, sample_project):
    """Test successful project export in HTML format."""
    # Create audio file with segments
    audio_file = AudioFile(
        project_id=sample_project.id,
        filename="file1.mp3",
        original_filename="file1.mp3",
        file_path="/test/file1.mp3",
        file_size=1024,
        duration=30.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file)
    test_db.flush()

    segment = Segment(
        audio_file_id=audio_file.id,
        start_time=5.0,
        end_time=15.0,
        original_text="Project export test content",
        sequence=0
    )
    test_db.add(segment)
    test_db.commit()

    response = client.get(
        f"/api/export/project/{sample_project.id}/txt",
        params={"use_edited": True, "include_speakers": True, "include_timestamps": True}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/plain; charset=utf-8"

    content = response.text
    assert f"Project: {sample_project.name}" in content
    assert "FILE 1: file1.mp3" in content
    assert "Project export test content" in content
    assert "=" * 80 in content  # Header separator
    assert "-" * 60 in content  # File separator


def test_export_project_not_found(client, test_db):
    """Test project export with non-existent project ID."""
    response = client.get("/api/export/project/99999/srt")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_export_project_no_audio_files(client, test_db, sample_project):
    """Test project export when project has no audio files."""
    response = client.get(f"/api/export/project/{sample_project.id}/srt")
    assert response.status_code == 400
    assert "no audio files found" in response.json()["detail"].lower()


def test_export_project_with_speakers(client, test_db, sample_project):
    """Test project export with speaker names."""
    # Create speaker
    speaker = Speaker(
        project_id=sample_project.id,
        speaker_id="spk1",
        display_name="John Doe"
    )
    test_db.add(speaker)
    test_db.flush()

    # Create audio file
    audio_file = AudioFile(
        project_id=sample_project.id,
        filename="file1.mp3",
        original_filename="file1.mp3",
        file_path="/test/file1.mp3",
        file_size=1024,
        duration=30.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file)
    test_db.flush()

    # Create segment with speaker
    segment = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=10.0,
        original_text="Hello there",
        speaker_id=speaker.id,
        sequence=0
    )
    test_db.add(segment)
    test_db.commit()

    response = client.get(
        f"/api/export/project/{sample_project.id}/srt",
        params={"use_edited": True, "include_speakers": True}
    )

    assert response.status_code == 200
    content = response.text
    assert "[John Doe]" in content


def test_export_project_filename_format(client, test_db, sample_project):
    """Test that project export filenames are correctly formatted."""
    # Create minimal data for export
    audio_file = AudioFile(
        project_id=sample_project.id,
        filename="test.mp3",
        original_filename="test.mp3",
        file_path="/test/test.mp3",
        file_size=1024,
        duration=30.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file)
    test_db.flush()

    segment = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=10.0,
        original_text="Test content",
        sequence=0
    )
    test_db.add(segment)
    test_db.commit()

    response = client.get(f"/api/export/project/{sample_project.id}/srt")
    assert response.status_code == 200

    disposition = response.headers["content-disposition"]
    assert "attachment" in disposition
    assert "filename=" in disposition
    assert "_project_transcription.srt" in disposition


def test_export_project_timestamp_continuity(client, test_db, sample_project):
    """Test that timestamps are properly adjusted across multiple files in project export."""
    # Create two audio files with known durations
    audio_file1 = AudioFile(
        project_id=sample_project.id,
        filename="part1.mp3",
        original_filename="part1.mp3",
        file_path="/test/part1.mp3",
        file_size=1024,
        duration=60.0,  # 1 minute
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    audio_file2 = AudioFile(
        project_id=sample_project.id,
        filename="part2.mp3",
        original_filename="part2.mp3",
        file_path="/test/part2.mp3",
        file_size=2048,
        duration=120.0,  # 2 minutes
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file1)
    test_db.add(audio_file2)
    test_db.flush()

    # Create segments
    segment1 = Segment(
        audio_file_id=audio_file1.id,
        start_time=10.0,
        end_time=20.0,
        original_text="First file segment",
        sequence=0
    )
    segment2 = Segment(
        audio_file_id=audio_file2.id,
        start_time=5.0,
        end_time=15.0,
        original_text="Second file segment",
        sequence=0
    )
    test_db.add(segment1)
    test_db.add(segment2)
    test_db.commit()

    response = client.get(f"/api/export/project/{sample_project.id}/srt")
    assert response.status_code == 200

    content = response.text
    
    # First segment should have original timestamps (10-20 seconds)
    assert "00:00:10,000" in content  # 10 seconds
    assert "00:00:20,000" in content  # 20 seconds
    
    # Second segment should have adjusted timestamps (60 + 5 = 65 seconds to 60 + 15 = 75 seconds)
    assert "00:01:05,000" in content  # 65 seconds (1:05)
    assert "00:01:15,000" in content  # 75 seconds (1:15)


def test_export_project_skips_passive_segments(client, test_db, sample_project):
    """Test that passive segments are excluded from project exports."""
    # Create audio file
    audio_file = AudioFile(
        project_id=sample_project.id,
        filename="test.mp3",
        original_filename="test.mp3",
        file_path="/test/test.mp3",
        file_size=1024,
        duration=30.0,
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    test_db.add(audio_file)
    test_db.flush()

    # Create active and passive segments
    active_segment = Segment(
        audio_file_id=audio_file.id,
        start_time=0.0,
        end_time=10.0,
        original_text="Active segment",
        is_passive=False,
        sequence=0
    )
    passive_segment = Segment(
        audio_file_id=audio_file.id,
        start_time=10.0,
        end_time=20.0,
        original_text="Passive segment",
        is_passive=True,
        sequence=1
    )
    test_db.add(active_segment)
    test_db.add(passive_segment)
    test_db.commit()

    response = client.get(f"/api/export/project/{sample_project.id}/srt")
    assert response.status_code == 200

    content = response.text
    assert "Active segment" in content
    assert "Passive segment" not in content


def test_export_project_duration_and_content_type_fixes(client, test_db, sample_project):
    """Test that export only includes duration from transcribed files and includes content type."""
    # Set the project content type
    sample_project.content_type = "interview"
    test_db.commit()
    
    # Create completed and pending files with known durations
    audio_file1 = AudioFile(
        project_id=sample_project.id,
        filename="completed1.mp3",
        original_filename="completed1.mp3",
        file_path="/test/completed1.mp3",
        file_size=1024,
        duration=60.0,  # 1 minute
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    
    audio_file2 = AudioFile(
        project_id=sample_project.id,
        filename="completed2.mp3",
        original_filename="completed2.mp3",
        file_path="/test/completed2.mp3",
        file_size=2048,
        duration=120.0,  # 2 minutes
        format="mp3",
        transcription_status=TranscriptionStatus.COMPLETED
    )
    
    # This one is NOT completed, so should not count toward duration
    audio_file3 = AudioFile(
        project_id=sample_project.id,
        filename="pending.mp3",
        original_filename="pending.mp3",
        file_path="/test/pending.mp3",
        file_size=1024,
        duration=90.0,  # 1.5 minutes - should NOT be included
        format="mp3",
        transcription_status=TranscriptionStatus.PENDING
    )
    
    test_db.add_all([audio_file1, audio_file2, audio_file3])
    test_db.flush()
    
    # Add a segment to one of the completed files so it's exportable
    segment = Segment(
        audio_file_id=audio_file1.id,
        start_time=0.0,
        end_time=10.0,
        original_text="Test content",
        sequence=0
    )
    test_db.add(segment)
    test_db.commit()
    
    # Test HTML export
    response = client.get(f"/api/export/project/{sample_project.id}/html")
    assert response.status_code == 200
    
    html_content = response.text
    # Check content type is included
    assert "Content Type:</strong> interview" in html_content
    # Check total duration only includes completed files (3m 0s, not 4m 30s)
    assert "Total Duration:</strong> 3m 0s" in html_content
    
    # Test TXT export
    response = client.get(f"/api/export/project/{sample_project.id}/txt")
    assert response.status_code == 200
    
    txt_content = response.text
    # Check content type is included
    assert "Content Type: interview" in txt_content
    # Check total duration only includes completed files
    assert "Total Duration: 3m 0s" in txt_content
