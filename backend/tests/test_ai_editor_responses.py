import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.ai_editor import get_ai_editor_service


TEST_PROJECT_ID = 20
TEST_EDITOR_TEXT = (
    "Welcome! Thanks for meeting today to review the release plan. "
    "Absolutely, I'm excited to walk through the milestones. "
    "Let's start with the transcription experience and status syncing. "
    "Segment caching has been rock-solid since the recent fixes. "
    "Great. We'll capture remaining action items before we wrap up. "
    "Perfect, I'll follow up with documentation after this call."
)
TEST_TECHNICAL_TEXT = "\n".join(
    [
        "[00:00-00:08] Moderator: Welcome! Thanks for meeting today to review the release plan.",
        "[00:08-00:15] Moderator: Absolutely, I'm excited to walk through the milestones.",
        "[00:15-00:23] Moderator: Let's start with the transcription experience and status syncing.",
        "[00:23-00:31] Moderator: Segment caching has been rock-solid since the recent fixes.",
        "[00:31-00:38] Moderator: Great. We'll capture remaining action items before we wrap up.",
        "[00:38-00:43] Moderator: Perfect, I'll follow up with documentation after this call.",
    ]
)


class StubAIEditorService:
    """
    Lightweight async stub that echoes purposeful responses for API verification.
    """

    def __init__(self):
        self.recorded_calls: list[tuple[str, dict]] = []

    async def semantic_reconstruction(self, text: str, provider: str, project_id: int):
        self.recorded_calls.append(
            (
                "semantic_reconstruction",
                {"text": text, "provider": provider, "project_id": project_id},
            )
        )
        return {
            "result": (
                "Aligned semantic revision: the release discussion stays clear "
                "and actionable for every stakeholder."
            )
        }

    async def style_generation(
        self, text: str, target_style: str, provider: str, project_id: int
    ):
        self.recorded_calls.append(
            (
                "style_generation",
                {
                    "text": text,
                    "target_style": target_style,
                    "provider": provider,
                    "project_id": project_id,
                },
            )
        )
        return {
            "result": (
                f"Aligned {target_style} rendering keeps the briefing focused "
                "while respecting the original intent."
            )
        }

    async def nlp_analysis(self, text: str, provider: str, project_id: int):
        self.recorded_calls.append(
            (
                "nlp_analysis",
                {"text": text, "provider": provider, "project_id": project_id},
            )
        )
        return {
            "summary": (
                "Concise overview of the release planning conversation with clear follow-up expectations."
            ),
            "themes": [
                "release planning",
                "transcription reliability",
                "action tracking",
            ],
            "action_items": [
                "Document remaining tasks",
                "Confirm transcription cache stability",
                "Share meeting recap",
            ],
        }

    async def fact_checking(
        self, text: str, domain: str, provider: str, project_id: int
    ):
        self.recorded_calls.append(
            (
                "fact_checking",
                {
                    "text": text,
                    "domain": domain,
                    "provider": provider,
                    "project_id": project_id,
                },
            )
        )
        return {
            "verifications": [
                {
                    "statement": "Transcription cache stability",
                    "status": "confirmed",
                    "notes": "Caching improvements remain relevant for the release.",
                },
                {
                    "statement": "Documentation follow-up",
                    "status": "confirmed",
                    "notes": "Action aligns with product team expectations.",
                },
            ]
        }

    async def technical_check(
        self,
        text_with_metadata: str,
        target_format: str,
        provider: str,
        project_id: int,
    ):
        self.recorded_calls.append(
            (
                "technical_check",
                {
                    "text_with_metadata": text_with_metadata,
                    "target_format": target_format,
                    "provider": provider,
                    "project_id": project_id,
                },
            )
        )
        return {
            "result": (
                f"{target_format.upper()} export keeps timestamps in sync "
                "with the meeting summary."
            )
        }


client = TestClient(app)


@pytest.fixture(autouse=True)
def override_ai_editor_service():
    """
    Override the AI editor dependency with the deterministic stub for every test.
    """
    stub = StubAIEditorService()
    app.dependency_overrides[get_ai_editor_service] = lambda: stub
    try:
        yield stub
    finally:
        app.dependency_overrides.pop(get_ai_editor_service, None)


def test_semantic_reconstruction_returns_relevant_response(override_ai_editor_service):
    response = client.post(
        "/api/ai_editor/semantic-reconstruction",
        json={"text": TEST_EDITOR_TEXT, "project_id": TEST_PROJECT_ID},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["result"].startswith("Aligned semantic revision")

    call_name, call_args = override_ai_editor_service.recorded_calls[-1]
    assert call_name == "semantic_reconstruction"
    assert call_args["text"] == TEST_EDITOR_TEXT
    assert call_args["project_id"] == TEST_PROJECT_ID
    assert call_args["provider"] == "ollama"


def test_style_generation_returns_relevant_response(override_ai_editor_service):
    target_style = "formal briefing"
    response = client.post(
        "/api/ai_editor/style-generation",
        json={
            "text": TEST_EDITOR_TEXT,
            "project_id": TEST_PROJECT_ID,
            "target_style": target_style,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["result"].startswith("Aligned")
    assert target_style in payload["result"]

    call_name, call_args = override_ai_editor_service.recorded_calls[-1]
    assert call_name == "style_generation"
    assert call_args["text"] == TEST_EDITOR_TEXT
    assert call_args["target_style"] == target_style
    assert call_args["provider"] == "ollama"


def test_nlp_analysis_returns_structured_relevant_summary(override_ai_editor_service):
    response = client.post(
        "/api/ai_editor/nlp-analysis",
        json={"text": TEST_EDITOR_TEXT, "project_id": TEST_PROJECT_ID},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"].startswith("Concise overview")
    assert isinstance(payload["themes"], list)
    assert "release planning" in payload["themes"]

    call_name, call_args = override_ai_editor_service.recorded_calls[-1]
    assert call_name == "nlp_analysis"
    assert call_args["text"] == TEST_EDITOR_TEXT
    assert call_args["provider"] == "ollama"


def test_fact_checking_marks_relevant_findings(override_ai_editor_service):
    domain = "product strategy"
    response = client.post(
        "/api/ai_editor/fact-checking",
        json={
            "text": TEST_EDITOR_TEXT,
            "project_id": TEST_PROJECT_ID,
            "domain": domain,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert all(
        item["status"] == "confirmed" for item in payload["verifications"]
    )

    call_name, call_args = override_ai_editor_service.recorded_calls[-1]
    assert call_name == "fact_checking"
    assert call_args["domain"] == domain
    assert call_args["provider"] == "ollama"


def test_technical_check_confirms_relevant_export(override_ai_editor_service):
    response = client.post(
        "/api/ai_editor/technical-check",
        json={
            "text_with_metadata": TEST_TECHNICAL_TEXT,
            "project_id": TEST_PROJECT_ID,
            "target_format": "srt",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["result"].startswith("SRT export")
    assert "SRT" in payload["result"]

    call_name, call_args = override_ai_editor_service.recorded_calls[-1]
    assert call_name == "technical_check"
    assert call_args["text_with_metadata"] == TEST_TECHNICAL_TEXT
    assert call_args["provider"] == "ollama"
    assert call_args["target_format"] == "srt"
