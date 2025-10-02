"""
Tests for segment editing and speaker management endpoints.
"""
import pytest


def test_update_segment_success(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test successfully updating a segment's edited text."""
    segment = sample_segments[0]

    response = client.patch(
        f"/api/transcription/segment/{segment.id}",
        json={"edited_text": "This is the edited version of the first segment."}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == segment.id
    assert data["edited_text"] == "This is the edited version of the first segment."
    assert data["original_text"] == "This is the first segment."


def test_update_segment_not_found(client, test_db):
    """Test updating a non-existent segment."""
    response = client.patch(
        "/api/transcription/segment/99999",
        json={"edited_text": "New text"}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_update_segment_preserves_original(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test that updating a segment preserves the original text."""
    segment = sample_segments[0]
    original_text = segment.original_text

    response = client.patch(
        f"/api/transcription/segment/{segment.id}",
        json={"edited_text": "Completely different text"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["original_text"] == original_text  # Original unchanged
    assert data["edited_text"] == "Completely different text"  # Edited updated


def test_update_segment_multiple_times(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test updating a segment multiple times."""
    segment = sample_segments[0]

    # First edit
    response1 = client.patch(
        f"/api/transcription/segment/{segment.id}",
        json={"edited_text": "First edit"}
    )
    assert response1.status_code == 200
    assert response1.json()["edited_text"] == "First edit"

    # Second edit (overwrites first)
    response2 = client.patch(
        f"/api/transcription/segment/{segment.id}",
        json={"edited_text": "Second edit"}
    )
    assert response2.status_code == 200
    assert response2.json()["edited_text"] == "Second edit"


def test_update_speaker_success(client, test_db, sample_project, sample_speakers):
    """Test successfully updating a speaker's display name."""
    speaker = sample_speakers[0]

    response = client.put(
        f"/api/transcription/speaker/{speaker.id}",
        json={"display_name": "John Doe"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == speaker.id
    assert data["display_name"] == "John Doe"
    assert data["speaker_id"] == speaker.speaker_id  # Original ID unchanged
    assert data["color"] == speaker.color  # Color unchanged


def test_update_speaker_not_found(client, test_db):
    """Test updating a non-existent speaker."""
    response = client.put(
        "/api/transcription/speaker/99999",
        json={"display_name": "New Name"}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_update_speaker_preserves_other_fields(client, test_db, sample_project, sample_speakers):
    """Test that updating speaker name preserves other fields."""
    speaker = sample_speakers[0]
    original_color = speaker.color
    original_speaker_id = speaker.speaker_id

    response = client.put(
        f"/api/transcription/speaker/{speaker.id}",
        json={"display_name": "Updated Name"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["color"] == original_color
    assert data["speaker_id"] == original_speaker_id


def test_get_segments_after_editing(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test that edited segments are returned correctly in the list."""
    segment = sample_segments[0]

    # Edit a segment
    client.patch(
        f"/api/transcription/segment/{segment.id}",
        json={"edited_text": "Edited text"}
    )

    # Get all segments
    response = client.get(f"/api/transcription/{sample_audio_file.id}/segments")

    assert response.status_code == 200
    segments_data = response.json()

    # Find the edited segment
    edited_segment = next(s for s in segments_data if s["id"] == segment.id)
    assert edited_segment["edited_text"] == "Edited text"
    assert edited_segment["original_text"] == segment.original_text
