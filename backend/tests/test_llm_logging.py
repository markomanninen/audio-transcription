"""
Tests for LLM request/response logging functionality.
"""
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session
from app.models.llm_log import LLMLog
from app.services.llm.ollama_provider import OllamaProvider


def test_llm_log_model_creation(test_db: Session):
    """Test creating an LLM log entry in the database."""
    log_entry = LLMLog(
        provider="ollama",
        model="llama3.2:1b",
        operation="correct_text",
        prompt="Test prompt",
        original_text="Original text",
        context="Test context",
        response="Test response",
        corrected_text="Corrected text",
        status="success",
        duration_ms=123.45,
        segment_id=1,
        project_id=1,
    )

    test_db.add(log_entry)
    test_db.commit()

    # Retrieve and verify
    saved_log = test_db.query(LLMLog).filter(LLMLog.id == log_entry.id).first()
    assert saved_log is not None
    assert saved_log.provider == "ollama"
    assert saved_log.model == "llama3.2:1b"
    assert saved_log.operation == "correct_text"
    assert saved_log.status == "success"
    assert saved_log.duration_ms == 123.45


def test_llm_log_with_error(test_db: Session):
    """Test logging an LLM request that failed."""
    log_entry = LLMLog(
        provider="ollama",
        model="llama3.2:1b",
        operation="correct_text",
        prompt="Test prompt",
        original_text="Original text",
        response="",
        status="error",
        error_message="Connection timeout",
        duration_ms=5000.0,
    )

    test_db.add(log_entry)
    test_db.commit()

    saved_log = test_db.query(LLMLog).filter(LLMLog.id == log_entry.id).first()
    assert saved_log.status == "error"
    assert saved_log.error_message == "Connection timeout"
    assert saved_log.response == ""


@pytest.mark.asyncio
async def test_ollama_provider_logs_successful_request(test_db: Session):
    """Test that OllamaProvider logs successful requests."""
    from unittest.mock import MagicMock

    provider = OllamaProvider(db=test_db)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"response": "This is the corrected text."}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await provider.correct_text(
            text="This is test text",
            context="Test context",
            correction_type="grammar",
            segment_id=123,
            project_id=456,
        )

        # Verify result
        assert "corrected_text" in result
        assert result["original_text"] == "This is test text"

        # Verify log was created
        logs = test_db.query(LLMLog).all()
        assert len(logs) == 1
        log = logs[0]
        assert log.provider == "ollama"
        assert log.status == "success"
        assert log.segment_id == 123
        assert log.project_id == 456
        assert log.duration_ms is not None
        assert log.duration_ms > 0


@pytest.mark.asyncio
async def test_ollama_provider_logs_failed_request(test_db: Session):
    """Test that OllamaProvider logs failed requests."""
    import httpx

    provider = OllamaProvider(db=test_db)

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection failed")):
        with pytest.raises(ConnectionError):
            await provider.correct_text(
                text="This is test text",
                segment_id=123,
                project_id=456,
            )

        # Verify error log was created
        logs = test_db.query(LLMLog).all()
        assert len(logs) == 1
        log = logs[0]
        assert log.provider == "ollama"
        assert log.status == "error"
        assert log.error_message is not None
        assert "Connection failed" in log.error_message
        assert log.duration_ms is not None


def test_llm_logs_api_endpoint(client, test_db):
    """Test the GET /api/llm/logs endpoint."""
    # Create test logs
    for i in range(5):
        log = LLMLog(
            provider="ollama" if i % 2 == 0 else "openrouter",
            model="llama3.2:1b",
            operation="correct_text",
            prompt=f"Test prompt {i}",
            response=f"Test response {i}",
            status="success" if i < 3 else "error",
            duration_ms=100.0 + i,
        )
        test_db.add(log)
    test_db.commit()

    # Test fetching all logs
    response = client.get("/api/llm/logs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5

    # Test filtering by provider
    response = client.get("/api/llm/logs?provider=ollama")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all(log["provider"] == "ollama" for log in data)

    # Test filtering by status
    response = client.get("/api/llm/logs?status=error")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(log["status"] == "error" for log in data)

    # Test limit parameter
    response = client.get("/api/llm/logs?limit=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_ollama_provider_without_db(test_db: Session):
    """Test that OllamaProvider works even when db=None (no logging)."""
    # This should not raise an error
    provider = OllamaProvider(db=None)
    assert provider.db is None

    # _log_request should handle None gracefully
    provider._log_request(
        prompt="test",
        response="test",
        original_text="test",
        duration_ms=100.0,
        status="success",
    )

    # Verify no logs were created
    logs = test_db.query(LLMLog).all()
    assert len(logs) == 0
