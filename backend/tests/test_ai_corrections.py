"""
Tests for AI correction endpoints.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock



@pytest.fixture
def mock_llm_service():
    """Mock LLM service for testing."""
    with patch('app.api.ai_corrections.LLMService') as mock:
        service_instance = MagicMock()
        mock.return_value = service_instance

        # Mock correct_text response
        service_instance.correct_text = AsyncMock(return_value={
            "original_text": "This is a test sentance with an error.",
            "corrected_text": "This is a test sentence with an error.",
            "changes": ['"sentance" → "sentence"'],
            "confidence": 0.95
        })

        # Mock health_check_all response
        service_instance.health_check_all = AsyncMock(return_value={
            "ollama": True,
            "openrouter": False
        })

        # Mock list_providers response
        service_instance.list_providers.return_value = ["ollama", "openrouter"]

        yield service_instance


def test_correct_segment_success(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test successful segment correction."""
    segment = sample_segments[0]

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama",
            "correction_type": "all"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["segment_id"] == segment.id
    assert "original_text" in data
    assert "corrected_text" in data
    assert "changes" in data
    assert "confidence" in data
    assert isinstance(data["changes"], list)
    assert 0 <= data["confidence"] <= 1


def test_correct_segment_not_found(client, test_db, mock_llm_service):
    """Test correction with non-existent segment."""
    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": 99999,
            "provider": "ollama",
            "correction_type": "all"
        }
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_correct_segment_with_edited_text(client, test_db, sample_project, sample_audio_file, sample_segments_with_edits, mock_llm_service):
    """Test correction uses edited text when available."""
    segment = sample_segments_with_edits[0]

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama",
            "correction_type": "grammar"
        }
    )

    assert response.status_code == 200
    # Verify LLM service was called with edited text
    mock_llm_service.correct_text.assert_called_once()
    call_args = mock_llm_service.correct_text.call_args
    assert call_args[1]["text"] == segment.edited_text


def test_correct_segment_with_speaker_context(client, test_db, sample_project, sample_audio_file, sample_segments, sample_speakers, mock_llm_service):
    """Test correction includes speaker context."""
    # Assign speaker to segment
    segment = sample_segments[0]
    segment.speaker_id = sample_speakers[0].id
    test_db.commit()

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama"
        }
    )

    assert response.status_code == 200
    # Verify speaker context was included
    mock_llm_service.correct_text.assert_called_once()
    call_args = mock_llm_service.correct_text.call_args
    assert "Speaker" in call_args[1]["context"]


def test_correct_segment_passive_rejected(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Passive segments should be rejected by AI correction endpoint."""
    segment = sample_segments[0]
    segment.is_passive = True
    test_db.commit()

    response = client.post(
        "/api/ai/correct-segment",
        json={"segment_id": segment.id, "provider": "ollama"}
    )

    assert response.status_code == 400
    assert "Passive" in response.json()["detail"]
    mock_llm_service.correct_text.assert_not_called()


def test_correct_batch_success(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test batch correction of multiple segments."""
    segment_ids = [seg.id for seg in sample_segments[:3]]  # Use 3 segments

    response = client.post(
        "/api/ai/correct-batch",
        json={
            "segment_ids": segment_ids,
            "provider": "ollama",
            "correction_type": "spelling"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 3
    for result in data:
        assert "segment_id" in result
        assert result["segment_id"] in segment_ids
        assert "corrected_text" in result
        assert "changes" in result


def test_correct_batch_rejects_passive_segments(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Batch correction should fail if any segment is passive."""
    segment_ids = [seg.id for seg in sample_segments[:2]]
    sample_segments[0].is_passive = True
    test_db.commit()

    response = client.post(
        "/api/ai/correct-batch",
        json={"segment_ids": segment_ids, "provider": "ollama"}
    )

    assert response.status_code == 400
    assert str(sample_segments[0].id) in response.json()["detail"]
    mock_llm_service.correct_text.assert_not_called()


def test_correct_batch_partial_not_found(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test batch correction with some invalid segment IDs."""
    valid_id = sample_segments[0].id
    invalid_id = 99999

    response = client.post(
        "/api/ai/correct-batch",
        json={
            "segment_ids": [valid_id, invalid_id],
            "provider": "ollama"
        }
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_correct_batch_handles_individual_failures(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test batch correction handles individual segment failures gracefully."""
    # Mock service to fail on second call
    mock_llm_service.correct_text = AsyncMock(side_effect=[
        {
            "original_text": "First segment",
            "corrected_text": "First segment",
            "changes": [],
            "confidence": 0.9
        },
        Exception("LLM service error"),
        {
            "original_text": "Third segment",
            "corrected_text": "Third segment",
            "changes": [],
            "confidence": 0.9
        }
    ])

    segment_ids = [seg.id for seg in sample_segments[:3]]  # Use 3 segments

    response = client.post(
        "/api/ai/correct-batch",
        json={
            "segment_ids": segment_ids,
            "provider": "ollama"
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Should have 3 results (including the failed one with error message)
    assert len(data) == 3

    # Check first succeeded
    assert data[0]["confidence"] > 0

    # Check second failed (has error in changes)
    assert data[1]["confidence"] == 0.0
    assert any("Error" in change for change in data[1]["changes"])

    # Check third succeeded
    assert data[2]["confidence"] > 0


def test_list_providers(client, test_db, mock_llm_service):
    """Test listing available LLM providers."""
    response = client.get("/api/ai/providers")

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0

    for provider in data:
        assert "name" in provider
        assert "available" in provider
        assert isinstance(provider["available"], bool)


def test_health_check_providers(client, test_db, mock_llm_service):
    """Test health check of LLM providers."""
    response = client.get("/api/ai/health")

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, dict)
    assert "ollama" in data
    assert isinstance(data["ollama"], bool)


def test_correction_type_validation(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test different correction types are passed correctly."""
    segment = sample_segments[0]

    for correction_type in ["grammar", "spelling", "punctuation", "all"]:
        response = client.post(
            "/api/ai/correct-segment",
            json={
                "segment_id": segment.id,
                "provider": "ollama",
                "correction_type": correction_type
            }
        )

        assert response.status_code == 200

        # Verify correction_type was passed to LLM service
        call_args = mock_llm_service.correct_text.call_args
        assert call_args[1]["correction_type"] == correction_type


def test_provider_unavailable_error(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test error when provider is unavailable."""
    with patch('app.api.ai_corrections.LLMService') as mock:
        service_instance = MagicMock()
        mock.return_value = service_instance
        service_instance.correct_text = AsyncMock(side_effect=ConnectionError("Provider not responding"))

        segment = sample_segments[0]

        response = client.post(
            "/api/ai/correct-segment",
            json={
                "segment_id": segment.id,
                "provider": "ollama"
            }
        )

        assert response.status_code == 503
        assert "not responding" in response.json()["detail"].lower()


def test_invalid_provider_error(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test error when provider doesn't exist."""
    with patch('app.api.ai_corrections.LLMService') as mock:
        service_instance = MagicMock()
        mock.return_value = service_instance
        service_instance.correct_text = AsyncMock(side_effect=ValueError("Provider 'invalid' not available"))

        segment = sample_segments[0]

        response = client.post(
            "/api/ai/correct-segment",
            json={
                "segment_id": segment.id,
                "provider": "invalid_provider"
            }
        )

        assert response.status_code == 400
        assert "not available" in response.json()["detail"].lower()


def test_correct_segment_with_surrounding_context(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test correction includes previous and next segments."""
    # Use middle segment so it has both prev and next
    segment = sample_segments[1]

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama"
        }
    )

    assert response.status_code == 200

    # Verify context includes Previous and Next
    mock_llm_service.correct_text.assert_called_once()
    call_args = mock_llm_service.correct_text.call_args
    context = call_args[1]["context"]

    assert "Previous:" in context
    assert "Next:" in context


def test_correct_segment_first_no_previous(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test first segment has no previous context."""
    segment = sample_segments[0]

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama"
        }
    )

    assert response.status_code == 200

    call_args = mock_llm_service.correct_text.call_args
    context = call_args[1]["context"]

    # Should not have Previous for first segment
    assert "Previous:" not in context
    # But should have Next
    assert "Next:" in context


def test_correct_segment_with_content_type_context(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test correction includes project content type."""
    # Set project content type
    sample_project.content_type = "lyrics"
    test_db.commit()

    segment = sample_segments[0]

    response = client.post(
        "/api/ai/correct-segment",
        json={
            "segment_id": segment.id,
            "provider": "ollama"
        }
    )

    assert response.status_code == 200

    # Verify context includes content type
    call_args = mock_llm_service.correct_text.call_args
    context = call_args[1]["context"]
    assert "Content type: lyrics" in context


def test_correct_batch_with_surrounding_context(client, test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test batch correction includes context for each segment."""
    # Set content type
    sample_project.content_type = "interview"
    test_db.commit()

    segment_ids = [seg.id for seg in sample_segments[:3]]

    response = client.post(
        "/api/ai/correct-batch",
        json={
            "segment_ids": segment_ids,
            "provider": "ollama",
            "correction_type": "all"
        }
    )

    assert response.status_code == 200

    # Should be called 3 times (once per segment)
    assert mock_llm_service.correct_text.call_count == 3

    # Check that context was different for each call (includes surrounding segments)
    calls = mock_llm_service.correct_text.call_args_list

    # First segment should not have Previous
    first_context = calls[0][1]["context"]
    assert "Previous:" not in first_context
    assert "Content type: interview" in first_context

    # Middle segment should have both
    middle_context = calls[1][1]["context"]
    assert "Previous:" in middle_context
    assert "Next:" in middle_context


def test_parse_correction_removes_context():
    """Test that parsing removes included context from LLM response."""
    from app.services.llm.ollama_provider import OllamaProvider

    provider = OllamaProvider()
    original = "But let go before it felt too right"  # 8 words

    # LLM incorrectly included previous context (13 words total)
    llm_response = "One bridge, one's held tight But let go before it felt too right."

    result = provider._parse_correction(llm_response, original)

    # Should extract only the portion close to 8 words (allow 50% tolerance)
    result_words = len(result.split())
    original_words = len(original.split())
    assert result_words <= original_words * 1.5  # Within 50% of original length
    assert "But let go" in result
    # Should not be the full response
    assert len(result) < len(llm_response)
