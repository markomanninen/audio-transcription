"""
Collect real AI editor responses from a running backend and store them locally
for manual inspection.

Usage:
    python scripts/capture_ai_editor_responses.py \
        --base-url http://localhost:8000 \
        --project-id 20 \
        --output ai_responses.json

The script assumes the backend is running and connected to an Ollama instance
that can process requests. Each endpoint is called sequentially with the sample
text from editor/20, responses are persisted, and a short inline analysis is
printed so you can review the actual model output.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from requests import Response


SAMPLE_EDITOR_TEXT = (
    "Welcome! Thanks for meeting today to review the release plan. "
    "Absolutely, I'm excited to walk through the milestones. "
    "Let's start with the transcription experience and status syncing. "
    "Segment caching has been rock-solid since the recent fixes. "
    "Great. We'll capture remaining action items before we wrap up. "
    "Perfect, I'll follow up with documentation after this call."
)

TECH_SEGMENTS = [
    ("00:00", "00:08", "Moderator", "Welcome! Thanks for meeting today to review the release plan."),
    ("00:08", "00:15", "Moderator", "Absolutely, I'm excited to walk through the milestones."),
    ("00:15", "00:23", "Moderator", "Let's start with the transcription experience and status syncing."),
    ("00:23", "00:31", "Moderator", "Segment caching has been rock-solid since the recent fixes."),
    ("00:31", "00:38", "Moderator", "Great. We'll capture remaining action items before we wrap up."),
    ("00:38", "00:43", "Moderator", "Perfect, I'll follow up with documentation after this call."),
]

TECHNICAL_METADATA = "\n".join(
    f"[{start}-{end}] {speaker}: {text}" for start, end, speaker, text in TECH_SEGMENTS
)


@dataclass
class EndpointCall:
    name: str
    path: str
    payload: Dict[str, Any]
    response: Optional[Dict[str, Any]] = None
    status_code: Optional[int] = None
    error: Optional[str] = None

    def analyse(self) -> Dict[str, Any]:
        """Produce lightweight diagnostics for the captured response."""
        summary: Dict[str, Any] = {"status_code": self.status_code}
        if self.error:
            summary["error"] = self.error
            return summary

        if not isinstance(self.response, dict):
            summary["warning"] = "Response is not a JSON object."
            return summary

        # Heuristic insights per endpoint.
        if self.name == "semantic_reconstruction":
            text = str(self.response.get("result", ""))
            summary["chars"] = len(text)
        elif self.name == "style_generation":
            summary["result_preview"] = str(self.response.get("result", ""))[:160]
        elif self.name == "nlp_analysis":
            summary["keys"] = list(self.response.keys())
            summary["summary_length"] = len(str(self.response.get("summary", "")))
        elif self.name == "fact_checking":
            verifications = self.response.get("verifications") or []
            summary["verification_count"] = len(verifications)
        elif self.name == "technical_check":
            summary["result_preview"] = str(self.response.get("result", ""))[:160]
        else:
            summary["note"] = "No analysis routine for this endpoint."

        return summary


def call_endpoint(base_url: str, endpoint: EndpointCall, timeout: int) -> EndpointCall:
    url = f"{base_url.rstrip('/')}{endpoint.path}"
    try:
        response: Response = requests.post(url, json=endpoint.payload, timeout=timeout)
        endpoint.status_code = response.status_code

        if response.headers.get("content-type", "").startswith("application/json"):
            endpoint.response = response.json()
        else:
            endpoint.error = f"Unexpected content type: {response.headers.get('content-type')}"
            endpoint.response = {"raw": response.text}

        if not response.ok:
            endpoint.error = endpoint.error or response.text
    except requests.RequestException as exc:
        endpoint.error = str(exc)

    return endpoint


def analyse_and_print(endpoint: EndpointCall) -> None:
    summary = endpoint.analyse()
    print(f"\n[{endpoint.name}] status={summary.get('status_code')}")
    if endpoint.error:
        print(f"  ERROR: {endpoint.error}")
        return

    for key, value in summary.items():
        if key == "status_code":
            continue
        print(f"  {key}: {value}")

    # When the response contains free-form text, provide a short excerpt.
    if isinstance(endpoint.response, dict) and "result" in endpoint.response:
        excerpt = str(endpoint.response["result"])[:240]
        print(f"  result_excerpt: {excerpt!r}")


def persist_results(output_path: Path, calls: list[EndpointCall]) -> None:
    serialisable = [asdict(call) for call in calls]
    output_path.write_text(json.dumps(serialisable, indent=2, ensure_ascii=False))
    print(f"\nCaptured responses saved to {output_path.resolve()}")


def build_calls(project_id: int, provider: str) -> list[EndpointCall]:
    base_payload = {"text": SAMPLE_EDITOR_TEXT, "project_id": project_id, "provider": provider}
    return [
        EndpointCall(
            name="semantic_reconstruction",
            path="/api/ai_editor/semantic-reconstruction",
            payload=base_payload,
        ),
        EndpointCall(
            name="style_generation",
            path="/api/ai_editor/style-generation",
            payload={**base_payload, "target_style": "formal briefing"},
        ),
        EndpointCall(
            name="nlp_analysis",
            path="/api/ai_editor/nlp-analysis",
            payload=base_payload,
        ),
        EndpointCall(
            name="fact_checking",
            path="/api/ai_editor/fact-checking",
            payload={**base_payload, "domain": "product strategy"},
        ),
        EndpointCall(
            name="technical_check",
            path="/api/ai_editor/technical-check",
            payload={
                "text_with_metadata": TECHNICAL_METADATA,
                "project_id": project_id,
                "provider": provider,
                "target_format": "srt",
            },
        ),
    ]


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect real AI editor responses.")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL.")
    parser.add_argument("--project-id", type=int, default=20, help="Project ID to send in payloads.")
    parser.add_argument("--provider", default="ollama", help="LLM provider name.")
    parser.add_argument("--output", default="ai_editor_responses.json", help="Where to store results.")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout per request in seconds.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    calls = build_calls(args.project_id, args.provider)
    for call in calls:
        call_endpoint(args.base_url, call, timeout=args.timeout)
        analyse_and_print(call)

    persist_results(Path(args.output), calls)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
