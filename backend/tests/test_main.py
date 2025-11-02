"""
Tests for main application endpoints.
"""


def test_root_endpoint(client):
    """Test root endpoint returns healthy status."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "audio-transcription-api"


def test_health_endpoint(client):
    """Test health check endpoint with component status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded", "starting", "unhealthy"]
    assert "version" in data
    assert "components" in data
    assert "critical" in data
    assert "optional" in data

    # Verify critical components are checked
    critical = data["critical"]
    assert "api" in critical
    assert "database" in critical
    assert "whisper" in critical
    assert "storage" in critical

    # Verify component status structure
    components = data["components"]
    for component_name in critical:
        assert component_name in components
        assert "status" in components[component_name]
        assert "message" in components[component_name]
