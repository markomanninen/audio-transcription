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
    assert data["is_passive"] is False


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


def test_bulk_passivate_segments(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Ensure bulk passive endpoint toggles multiple segments."""
    segment_ids = [seg.id for seg in sample_segments[:2]]

    response = client.post(
        "/api/transcription/segments/passive",
        json={"segment_ids": segment_ids, "is_passive": True}
    )

    assert response.status_code == 200
    data = response.json()
    assert all(item["is_passive"] for item in data)

    refreshed = (
        test_db.query(type(sample_segments[0]))
        .filter(type(sample_segments[0]).id.in_(segment_ids))
        .all()
    )
    assert all(seg.is_passive for seg in refreshed)

    # Toggle back to active
    response = client.post(
        "/api/transcription/segments/passive",
        json={"segment_ids": segment_ids, "is_passive": False}
    )
    assert response.status_code == 200
    data = response.json()
    assert all(not item["is_passive"] for item in data)


def test_join_segments_success(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Joining nearby segments should merge text and update ordering."""
    first, second = sample_segments[0], sample_segments[1]

    response = client.post(
        "/api/transcription/segments/join",
        json={"segment_ids": [first.id, second.id], "max_gap_seconds": 5.0}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == first.id
    assert "second segment" in data["original_text"]
    assert data["sequence"] == 0

    # Database should now have one fewer segment for the file
    remaining = (
        test_db.query(type(first))
        .filter(type(first).audio_file_id == sample_audio_file.id)
        .order_by(type(first).sequence)
        .all()
    )
    assert len(remaining) == len(sample_segments) - 1
    assert remaining[0].id == first.id
    assert remaining[0].end_time == second.end_time
    assert remaining[0].sequence == 0


def test_delete_segment(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Deleting a segment should resequence the remaining segments."""
    target = sample_segments[1]

    response = client.delete(f"/api/transcription/segments/{target.id}")
    assert response.status_code == 200
    data = response.json()
    remaining_ids = [item["id"] for item in data["segments"]]
    assert target.id not in remaining_ids

    stored = (
        test_db.query(type(target))
        .filter(type(target).audio_file_id == sample_audio_file.id)
        .order_by(type(target).sequence)
        .all()
    )
    assert len(stored) == len(sample_segments) - 1
    assert all(idx == seg.sequence for idx, seg in enumerate(stored))


def test_insert_segment_above_requires_gap(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Inserting above with no gap should fail, but succeeds when space exists."""
    base = sample_segments[1]

    # No gap between first and second segments in fixtures, expect failure
    response = client.post(
        f"/api/transcription/segment/{base.id}/insert",
        json={"direction": "above"}
    )
    assert response.status_code == 400

    # Create a gap by moving the segment's start time forward
    update_response = client.patch(
        f"/api/transcription/segment/{base.id}",
        json={"start_time": 12.0}
    )
    assert update_response.status_code == 200

    response = client.post(
        f"/api/transcription/segment/{base.id}/insert",
        json={"direction": "above"}
    )
    assert response.status_code == 200
    new_segment = response.json()
    # New segment takes the original sequence position (1), base is pushed down to 2
    assert new_segment["sequence"] == 1
    assert new_segment["start_time"] == pytest.approx(10.0)
    assert new_segment["end_time"] == pytest.approx(12.0)

    stored = (
        test_db.query(type(base))
        .filter(type(base).audio_file_id == sample_audio_file.id)
        .order_by(type(base).sequence)
        .all()
    )
    assert stored[new_segment["sequence"]].id == new_segment["id"]
    # Refresh base to get updated sequence from database
    test_db.refresh(base)
    assert stored[new_segment["sequence"] + 1].id == base.id
    assert base.sequence == 2  # Base was pushed down from 1 to 2


def test_insert_segment_below(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Inserting below respects available gap or duration constraints."""
    base = sample_segments[1]

    # Create a gap between base end and next segment start
    update_response = client.patch(
        f"/api/transcription/segment/{base.id}",
        json={"end_time": 18.0}
    )
    assert update_response.status_code == 200

    response = client.post(
        f"/api/transcription/segment/{base.id}/insert",
        json={"direction": "below"}
    )
    assert response.status_code == 200
    inserted = response.json()
    assert inserted["start_time"] == pytest.approx(18.0)
    assert inserted["end_time"] == pytest.approx(20.0)

    # Attempting to insert when no room exists should fail
    third = sample_segments[2]
    response = client.post(
        f"/api/transcription/segment/{third.id}/insert",
        json={"direction": "below"}
    )
    assert response.status_code == 200
    trailing = response.json()
    assert trailing["start_time"] == pytest.approx(30.0)
    assert trailing["end_time"] == pytest.approx(sample_audio_file.duration)

    # Without specifying end time and no duration information, expect an error
    sample_audio_file.duration = None
    test_db.commit()
    response = client.post(
        f"/api/transcription/segment/{third.id}/insert",
        json={"direction": "below"}
    )
    assert response.status_code == 400

    sample_audio_file.duration = 60.0
    test_db.commit()


def test_update_segment_timing_validation(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Updating segment timings must respect adjacent boundaries."""
    first, second, third = sample_segments

    # Attempt to overlap the previous segment
    response = client.patch(
        f"/api/transcription/segment/{second.id}",
        json={"start_time": first.end_time - 1}
    )
    assert response.status_code == 400

    # Attempt to overlap the next segment
    response = client.patch(
        f"/api/transcription/segment/{second.id}",
        json={"end_time": third.start_time + 1}
    )
    assert response.status_code == 400


def test_update_segment_timing_success(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Segment timing updates within available gap should succeed."""
    first, second, third = sample_segments

    # Move the second segment forward creating gap with the first
    response = client.patch(
        f"/api/transcription/segment/{second.id}",
        json={"start_time": first.end_time + 1, "end_time": third.start_time - 2}
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["start_time"] == pytest.approx(11.0)
    assert updated["end_time"] == pytest.approx(18.0)


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
