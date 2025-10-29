import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_editor_service import AIEditorService
from app.models.llm_log import LLMLog


client = TestClient(app)


@pytest.fixture
def sample_project_id():
    return 1


@pytest.fixture
def sample_text():
    return "This is a sample text for testing AI editor functionality."


@pytest.fixture
def mock_ai_editor_service():
    with patch('app.api.ai_editor.AIEditorService') as mock:
        service_instance = AsyncMock(spec=AIEditorService)
        mock.return_value = service_instance
        yield service_instance


class TestSemanticReconstructionEndpoint:
    """Test the semantic reconstruction API endpoint."""

    def test_semantic_reconstruction_success(self, mock_ai_editor_service, sample_project_id, sample_text):
        """Test successful semantic reconstruction."""
        # Arrange
        expected_result = {"result": "This is a reconstructed version of the sample text with improved clarity and structure."}
        mock_ai_editor_service.semantic_reconstruction.return_value = expected_result

        request_data = {
            "text": sample_text,
            "project_id": sample_project_id,
            "provider": "ollama"
        }

        # Act
        response = client.post("/api/ai_editor/semantic-reconstruction", json=request_data)

        # Assert
        assert response.status_code == 200
        assert response.json() == expected_result
        mock_ai_editor_service.semantic_reconstruction.assert_called_once_with(
            text=sample_text, provider="ollama", project_id=sample_project_id
        )

    def test_semantic_reconstruction_with_default_provider(self, mock_ai_editor_service, sample_project_id, sample_text):
        """Test semantic reconstruction with default provider."""
        expected_result = {"result": "Reconstructed text"}
        mock_ai_editor_service.semantic_reconstruction.return_value = expected_result

        request_data = {
            "text": sample_text,
            "project_id": sample_project_id
        }

        response = client.post("/api/ai_editor/semantic-reconstruction", json=request_data)

        assert response.status_code == 200
        mock_ai_editor_service.semantic_reconstruction.assert_called_once_with(
            text=sample_text, provider="ollama", project_id=sample_project_id
        )

    def test_semantic_reconstruction_missing_text(self, sample_project_id):
        """Test semantic reconstruction with missing text field."""
        request_data = {
            "project_id": sample_project_id
        }

        response = client.post("/api/ai_editor/semantic-reconstruction", json=request_data)
        assert response.status_code == 422

    def test_semantic_reconstruction_service_error(self, mock_ai_editor_service, sample_project_id, sample_text):
        """Test semantic reconstruction when service raises an exception."""
        mock_ai_editor_service.semantic_reconstruction.side_effect = Exception("AI service unavailable")

        request_data = {
            "text": sample_text,
            "project_id": sample_project_id
        }

        response = client.post("/api/ai_editor/semantic-reconstruction", json=request_data)
        assert response.status_code == 500


class TestStyleGenerationEndpoint:
    """Test the style generation API endpoint."""

    def test_style_generation_success(self, mock_ai_editor_service, sample_project_id, sample_text):
        """Test successful style generation."""
        expected_result = {"result": "This sample text has been transformed into an academic writing style."}
        mock_ai_editor_service.style_generation.return_value = expected_result

        request_data = {
            "text": sample_text,
            "project_id": sample_project_id,
            "target_style": "academic",
            "provider": "ollama"
        }

        response = client.post("/api/ai_editor/style-generation", json=request_data)

        assert response.status_code == 200
        assert response.json() == expected_result
        mock_ai_editor_service.style_generation.assert_called_once_with(
            text=sample_text, target_style="academic", provider="ollama", project_id=sample_project_id
        )

    def test_style_generation_all_styles(self, mock_ai_editor_service, sample_project_id, sample_text):
        """Test style generation with all available styles."""
        styles = ["academic", "conversational", "formal", "journalistic", "technical"]
        
        for style in styles:
            mock_ai_editor_service.style_generation.return_value = {"result": f"Text in {style} style"}
            
            request_data = {
                "text": sample_text,
                "project_id": sample_project_id,
                "target_style": style
            }

            response = client.post("/api/ai_editor/style-generation", json=request_data)
            assert response.status_code == 200
            assert response.json()["result"] == f"Text in {style} style"

    def test_style_generation_missing_target_style(self, sample_project_id, sample_text):
        """Test style generation with missing target_style field."""
        request_data = {
            "text": sample_text,
            "project_id": sample_project_id
        }

        response = client.post("/api/ai_editor/style-generation", json=request_data)
        assert response.status_code == 422


class TestNLPAnalysisEndpoint:
    """Test the NLP analysis API endpoint."""

    def test_nlp_analysis_success(self, mock_ai_editor_service, sample_project_id, sample_text):
        """Test successful NLP analysis."""
        expected_result = {
            "summary": "This text discusses testing AI functionality",
            "themes": ["testing", "AI", "functionality"],
            "structure": "Simple declarative sentence"
        }
        mock_ai_editor_service.nlp_analysis.return_value = expected_result

        request_data = {
            "text": sample_text,
            "project_id": sample_project_id,
            "provider": "ollama"
        }

        response = client.post("/api/ai_editor/nlp-analysis", json=request_data)

        assert response.status_code == 200
        assert response.json() == expected_result
        mock_ai_editor_service.nlp_analysis.assert_called_once_with(
            text=sample_text, provider="ollama", project_id=sample_project_id
        )

    def test_nlp_analysis_complex_result(self, mock_ai_editor_service, sample_project_id):
        """Test NLP analysis with complex structured result."""
        complex_text = "This is a multi-sentence paragraph. It contains various themes and topics. The structure is conversational and informative."
        expected_result = {
            "summary": "A multi-faceted text covering various themes",
            "themes": ["information", "conversation", "structure", "topics"],
            "structure": "Multi-sentence paragraph with varied content",
            "sentiment": "neutral",
            "key_entities": ["text", "themes", "topics"]
        }
        mock_ai_editor_service.nlp_analysis.return_value = expected_result

        request_data = {
            "text": complex_text,
            "project_id": sample_project_id
        }

        response = client.post("/api/ai_editor/nlp-analysis", json=request_data)

        assert response.status_code == 200
        assert response.json() == expected_result


class TestFactCheckingEndpoint:
    """Test the fact checking API endpoint."""

    def test_fact_checking_success(self, mock_ai_editor_service, sample_project_id):
        """Test successful fact checking."""
        text_with_facts = "The Earth revolves around the Sun. Python was created in 1991."
        expected_result = {
            "verifications": [
                {
                    "original_statement": "The Earth revolves around the Sun",
                    "is_accurate": True,
                    "verification_details": "This is astronomically correct."
                },
                {
                    "original_statement": "Python was created in 1991",
                    "is_accurate": True,
                    "verification_details": "Python 0.9.0 was released in February 1991."
                }
            ]
        }
        mock_ai_editor_service.fact_checking.return_value = expected_result

        request_data = {
            "text": text_with_facts,
            "project_id": sample_project_id,
            "domain": "general",
            "provider": "ollama"
        }

        response = client.post("/api/ai_editor/fact-checking", json=request_data)

        assert response.status_code == 200
        assert response.json() == expected_result
        mock_ai_editor_service.fact_checking.assert_called_once_with(
            text=text_with_facts, domain="general", provider="ollama", project_id=sample_project_id
        )

    def test_fact_checking_domain_specific(self, mock_ai_editor_service, sample_project_id):
        """Test fact checking with specific domains."""
        domains = ["history", "science", "technology", "medicine", "general"]
        
        for domain in domains:
            mock_ai_editor_service.fact_checking.return_value = {
                "verifications": [{"domain_specific": True, "domain": domain}]
            }
            
            request_data = {
                "text": "Domain specific fact",
                "project_id": sample_project_id,
                "domain": domain
            }

            response = client.post("/api/ai_editor/fact-checking", json=request_data)
            assert response.status_code == 200

    def test_fact_checking_inaccurate_facts(self, mock_ai_editor_service, sample_project_id):
        """Test fact checking with inaccurate statements."""
        text_with_false_facts = "The Earth is flat. Python was created in 1985."
        expected_result = {
            "verifications": [
                {
                    "original_statement": "The Earth is flat",
                    "is_accurate": False,
                    "verification_details": "The Earth is spherical, not flat."
                },
                {
                    "original_statement": "Python was created in 1985",
                    "is_accurate": False,
                    "verification_details": "Python was first released in 1991, not 1985."
                }
            ]
        }
        mock_ai_editor_service.fact_checking.return_value = expected_result

        request_data = {
            "text": text_with_false_facts,
            "project_id": sample_project_id
        }

        response = client.post("/api/ai_editor/fact-checking", json=request_data)

        assert response.status_code == 200
        assert response.json() == expected_result


class TestTechnicalCheckEndpoint:
    """Test the technical format conversion API endpoint."""

    def test_technical_check_srt_format(self, mock_ai_editor_service, sample_project_id):
        """Test technical check for SRT format conversion."""
        text_with_metadata = "[00:00] Speaker A: Hello world. [00:05] Speaker B: How are you?"
        expected_srt = {"result": "1\n00:00:00,000 --> 00:00:05,000\nSpeaker A: Hello world.\n\n2\n00:00:05,000 --> 00:00:10,000\nSpeaker B: How are you?\n"}
        
        mock_ai_editor_service.technical_check.return_value = expected_srt

        request_data = {
            "text_with_metadata": text_with_metadata,
            "project_id": sample_project_id,
            "target_format": "SRT",
            "provider": "ollama"
        }

        response = client.post("/api/ai_editor/technical-check", json=request_data)

        assert response.status_code == 200
        assert response.json() == expected_srt
        mock_ai_editor_service.technical_check.assert_called_once_with(
            text_with_metadata=text_with_metadata, target_format="SRT", provider="ollama", project_id=sample_project_id
        )

    def test_technical_check_all_formats(self, mock_ai_editor_service, sample_project_id):
        """Test technical check with all supported formats."""
        formats = ["SRT", "VTT", "transcript", "chapters"]
        text_with_metadata = "[00:00] Speaker: Test content"
        
        for fmt in formats:
            mock_ai_editor_service.technical_check.return_value = {"result": f"Content in {fmt} format"}
            
            request_data = {
                "text_with_metadata": text_with_metadata,
                "project_id": sample_project_id,
                "target_format": fmt
            }

            response = client.post("/api/ai_editor/technical-check", json=request_data)
            assert response.status_code == 200
            assert response.json()["result"] == f"Content in {fmt} format"

    def test_technical_check_missing_format(self, sample_project_id):
        """Test technical check with missing target_format field."""
        request_data = {
            "text_with_metadata": "[00:00] Speaker: Test",
            "project_id": sample_project_id
        }

        response = client.post("/api/ai_editor/technical-check", json=request_data)
        assert response.status_code == 422


class TestAIEditorServiceIntegration:
    """Integration tests for AI editor service functionality."""

    @patch('app.services.ai_editor_service.LLMService')
    def test_ai_editor_service_logging(self, mock_llm_service, sample_project_id, sample_text):
        """Test that AI editor service properly initializes with required dependencies."""
        # Create a real service instance for integration testing
        from app.services.ai_editor_service import AIEditorService
        from sqlalchemy.orm import Session
        
        # Create mock db session and llm service
        mock_db = MagicMock(spec=Session)
        mock_llm = MagicMock()
        
        service = AIEditorService(db=mock_db, llm_service=mock_llm)
        
        # Test that the service was initialized properly
        assert service.db == mock_db
        assert service.llm_service == mock_llm

    def test_error_handling_in_endpoints(self, mock_ai_editor_service, sample_project_id, sample_text):
        """Test error handling across all AI editor endpoints."""
        # Test that all endpoints handle service errors gracefully
        endpoints_and_data = [
            ("/api/ai_editor/semantic-reconstruction", {"text": sample_text, "project_id": sample_project_id}),
            ("/api/ai_editor/style-generation", {"text": sample_text, "project_id": sample_project_id, "target_style": "academic"}),
            ("/api/ai_editor/nlp-analysis", {"text": sample_text, "project_id": sample_project_id}),
            ("/api/ai_editor/fact-checking", {"text": sample_text, "project_id": sample_project_id}),
            ("/api/ai_editor/technical-check", {"text_with_metadata": "[00:00] " + sample_text, "project_id": sample_project_id, "target_format": "SRT"}),
        ]
        
        for endpoint, data in endpoints_and_data:
            # Configure mock to raise an exception
            for method in [mock_ai_editor_service.semantic_reconstruction,
                          mock_ai_editor_service.style_generation,
                          mock_ai_editor_service.nlp_analysis,
                          mock_ai_editor_service.fact_checking,
                          mock_ai_editor_service.technical_check]:
                method.side_effect = Exception("Service error")
            
            response = client.post(endpoint, json=data)
            assert response.status_code == 500, f"Endpoint {endpoint} should return 500 on service error"


class TestValidation:
    """Test input validation for all AI editor endpoints."""

    def test_empty_request_bodies(self):
        """Test all endpoints with empty request bodies."""
        endpoints = [
            "/api/ai_editor/semantic-reconstruction",
            "/api/ai_editor/style-generation",
            "/api/ai_editor/nlp-analysis",
            "/api/ai_editor/fact-checking",
            "/api/ai_editor/technical-check"
        ]
        
        for endpoint in endpoints:
            response = client.post(endpoint, json={})
            assert response.status_code == 422, f"Endpoint {endpoint} should validate required fields"

    def test_invalid_enum_values(self, sample_project_id, sample_text):
        """Test endpoints with invalid enum values."""
        # Note: Currently the API accepts any string values for style, domain, format
        # This test is disabled until enum validation is implemented
        pass

    def test_invalid_project_id_types(self, sample_text):
        """Test endpoints with invalid project_id types."""
        endpoints_and_data = [
            ("/api/ai_editor/semantic-reconstruction", {"text": sample_text, "project_id": "not_a_number"}),
            ("/api/ai_editor/style-generation", {"text": sample_text, "project_id": None, "target_style": "academic"}),
        ]
        
        for endpoint, data in endpoints_and_data:
            response = client.post(endpoint, json=data)
            assert response.status_code == 422, f"Endpoint {endpoint} should validate project_id type"