"""
Tests for AI analysis endpoints.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.models.segment import Segment


@pytest.fixture
def mock_llm_for_analysis():
    """Mock LLM service for content analysis."""
    with patch('app.api.ai_analysis.LLMService') as mock:
        service_instance = MagicMock()
        mock.return_value = service_instance

        # Mock provider
        provider_mock = MagicMock()
        provider_mock.health_check = AsyncMock(return_value=True)
        service_instance.get_provider.return_value = provider_mock

        yield service_instance


def test_analyze_project_success(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test successful project analysis."""
    # Mock httpx at the import level since it's imported inside the function
    with patch('httpx.AsyncClient') as http_mock:
        client_instance = MagicMock()
        http_mock.return_value.__aenter__.return_value = client_instance

        # Mock both health check response and generation response
        health_response = MagicMock()
        health_response.status_code = 200
        health_response.raise_for_status = MagicMock()

        ollama_response = MagicMock()
        ollama_response.json.return_value = {
            "response": '{"content_type": "general", "confidence": 0.8, "reasoning": "Standard transcription", "suggested_description": "Transcription"}'
        }
        ollama_response.raise_for_status = MagicMock()

        # Mock get for health check and post for generation
        client_instance.get = AsyncMock(return_value=health_response)
        client_instance.post = AsyncMock(return_value=ollama_response)

        response = client.post(
            f"/api/ai/analyze/project/{sample_project.id}",
            params={"provider": "ollama"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "suggested_content_type" in data
        assert "confidence" in data
        assert "reasoning" in data
        assert 0.5 <= data["confidence"] <= 1.0


def test_analyze_project_no_segments(client, test_db, sample_project):
    """Test analysis fails gracefully with no segments."""
    response = client.post(
        f"/api/ai/analyze/project/{sample_project.id}",
        params={"provider": "ollama"}
    )

    assert response.status_code == 400
    assert "no transcribed segments" in response.json()["detail"].lower()


def test_analyze_project_not_found(client, test_db):
    """Test analysis with non-existent project."""
    response = client.post(
        "/api/ai/analyze/project/99999",
        params={"provider": "ollama"}
    )

    assert response.status_code == 404


def test_apply_analysis_success(client, test_db, sample_project):
    """Test applying analysis updates project."""
    response = client.post(
        f"/api/ai/analyze/project/{sample_project.id}/apply",
        params={
            "content_type": "lyrics",
            "description": "Song lyrics"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["content_type"] == "lyrics"
    assert data["description"] == "Song lyrics"
    assert data["updated"] is True


def test_apply_analysis_not_found(client, test_db):
    """Test apply fails for non-existent project."""
    response = client.post(
        "/api/ai/analyze/project/99999/apply",
        params={
            "content_type": "lyrics"
        }
    )

    assert response.status_code == 404


def test_weighted_keyword_scoring_lyrics(client, test_db, sample_project, sample_audio_file):
    """Test lyrics detection with verse/chorus keywords."""
    # Create segments with lyrics-like text
    from app.models.segment import Segment

    lyrics_segments = [
        Segment(
            audio_file_id=sample_audio_file.id,
            sequence=i,
            start_time=i * 10.0,
            end_time=(i + 1) * 10.0,
            original_text=f"Verse {i} with chorus and refrain"
        )
        for i in range(3)
    ]
    test_db.add_all(lyrics_segments)
    test_db.commit()

    with patch('app.api.ai_analysis.LLMService') as mock:
        # Mock LLM to return "general" but reasoning mentions "lyrics"
        provider_mock = MagicMock()
        provider_mock.health_check = AsyncMock(return_value=True)

        service_instance = MagicMock()
        service_instance.get_provider.return_value = provider_mock
        mock.return_value = service_instance

        # Mock httpx at import level
        with patch('httpx.AsyncClient') as http_mock:
            client_instance = MagicMock()
            http_mock.return_value.__aenter__.return_value = client_instance

            # Mock health check response
            health_response = MagicMock()
            health_response.status_code = 200
            health_response.raise_for_status = MagicMock()

            # Mock Ollama response with inconsistency
            ollama_response = MagicMock()
            ollama_response.json.return_value = {
                "response": '{"content_type": "general", "confidence": 0.8, "reasoning": "Contains verse and chorus structure typical of song lyrics", "suggested_description": "Song with verses"}'
            }
            ollama_response.raise_for_status = MagicMock()

            client_instance.get = AsyncMock(return_value=health_response)
            client_instance.post = AsyncMock(return_value=ollama_response)

            response = client.post(
                f"/api/ai/analyze/project/{sample_project.id}",
                params={"provider": "ollama"}
            )

            assert response.status_code == 200
            data = response.json()

            # System should correct "general" to "lyrics" based on reasoning
            assert data["suggested_content_type"] == "lyrics"


def test_confidence_levels(client, test_db, sample_project, sample_audio_file, sample_segments):
    """Test that confidence scores are in valid range."""
    with patch('httpx.AsyncClient') as http_mock:
        client_instance = MagicMock()
        http_mock.return_value.__aenter__.return_value = client_instance

        # Mock health check response
        health_response = MagicMock()
        health_response.status_code = 200
        health_response.raise_for_status = MagicMock()

        ollama_response = MagicMock()
        ollama_response.json.return_value = {
            "response": '{"content_type": "interview", "confidence": 0.95, "reasoning": "Clear interview structure with Q&A format", "suggested_description": "Interview transcription"}'
        }
        ollama_response.raise_for_status = MagicMock()

        client_instance.get = AsyncMock(return_value=health_response)
        client_instance.post = AsyncMock(return_value=ollama_response)

        with patch('app.api.ai_analysis.LLMService') as mock:
            provider_mock = MagicMock()
            provider_mock.health_check = AsyncMock(return_value=True)

            service_instance = MagicMock()
            service_instance.get_provider.return_value = provider_mock
            mock.return_value = service_instance

            response = client.post(
                f"/api/ai/analyze/project/{sample_project.id}",
                params={"provider": "ollama"}
            )

            assert response.status_code == 200
            data = response.json()
            assert 0.5 <= data["confidence"] <= 1.0
