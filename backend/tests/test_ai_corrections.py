"""
Tests for AI correction endpoints.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.segment import Segment
from app.models.speaker import Speaker

client = TestClient(app)


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


def test_correct_segment_success(test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
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


def test_correct_segment_not_found(test_db, mock_llm_service):
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


def test_correct_segment_with_edited_text(test_db, sample_project, sample_audio_file, sample_segments_with_edits, mock_llm_service):
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


def test_correct_segment_with_speaker_context(test_db, sample_project, sample_audio_file, sample_segments, sample_speakers, mock_llm_service):
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


def test_correct_batch_success(test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
    """Test batch correction of multiple segments."""
    segment_ids = [seg.id for seg in sample_segments[:3]]

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


def test_correct_batch_partial_not_found(test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
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


def test_correct_batch_handles_individual_failures(test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
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

    segment_ids = [seg.id for seg in sample_segments[:3]]

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


def test_list_providers(test_db, mock_llm_service):
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


def test_health_check_providers(test_db, mock_llm_service):
    """Test health check of LLM providers."""
    response = client.get("/api/ai/health")

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, dict)
    assert "ollama" in data
    assert isinstance(data["ollama"], bool)


def test_correction_type_validation(test_db, sample_project, sample_audio_file, sample_segments, mock_llm_service):
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


def test_provider_unavailable_error(test_db, sample_project, sample_audio_file, sample_segments):
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


def test_invalid_provider_error(test_db, sample_project, sample_audio_file, sample_segments):
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
