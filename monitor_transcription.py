#!/usr/bin/env python3
"""
Standalone transcription monitor script.

Features:
- Polls backend for a specific file's transcription status
- Shows status, progress, stage, segments, timing, speed estimates
- Prints model info when available
- Exits automatically when completed or failed

Usage:
    python monitor_transcription.py --file-id 2
    python monitor_transcription.py --file-id 2 --url http://localhost:8000 --interval 5
    python monitor_transcription.py --file-id 2 --timeout 20
    python monitor_transcription.py --file-id 2 --once

Notes:
- Uses only Python standard library (urllib) so it runs anywhere
- Works with the API: /api/transcription/{file_id}/status
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Any, Dict, Optional


def fetch_json(url: str, timeout: float = 8.0) -> Optional[Dict[str, Any]]:
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"HTTP error {e.code} for {url}: {e.reason}\n")
    except urllib.error.URLError as e:
        sys.stderr.write(f"URL error for {url}: {e.reason}\n")
    except Exception as e:
        sys.stderr.write(f"Failed to fetch {url}: {e}\n")
    return None


def parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        # Handle potential trailing 'Z'
        ts = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(ts)
    except Exception:
        return None


def get_stage(status: Dict[str, Any]) -> Optional[str]:
    # Prefer processing_stage when present
    stage = status.get("processing_stage")
    if stage:
        return stage
    # Fallback: error_message is reused to carry stage info (prefix "Stage: ")
    msg = status.get("error_message")
    if isinstance(msg, str) and msg.startswith("Stage: "):
        return msg[len("Stage: ") :]
    return None


def get_model(status: Dict[str, Any]) -> Optional[str]:
    meta = status.get("transcription_metadata")
    if not meta:
        return None
    try:
        j = json.loads(meta)
        return j.get("model_size") or j.get("actual_model_used")
    except Exception:
        return None


def render_snapshot(status: Dict[str, Any]) -> str:
    now = datetime.now().strftime("%H:%M:%S")
    fname = status.get("original_filename") or status.get("filename") or "Unknown"
    state = (status.get("status") or "unknown").upper()
    progress = float(status.get("progress") or 0.0)
    segments = int(status.get("segment_count") or 0)
    duration = float(status.get("duration") or 0.0)
    started_at = parse_iso(status.get("transcription_started_at"))
    completed_at = parse_iso(status.get("transcription_completed_at"))
    stage = get_stage(status)
    model = get_model(status)

    lines = []
    lines.append(f"🎬 TRANSCRIPTION MONITOR | {now}")
    lines.append("=" * 60)
    lines.append(f"📁 File: {fname}")
    if model:
        lines.append(f"🤖 Model: {model}")
    lines.append(f"📊 Status: {state}")
    lines.append(f"📈 Progress: {progress*100:.1f}%")
    lines.append(f"🗣️ Segments: {segments}")
    if duration:
        lines.append(f"⏱️ Audio Duration: {duration:.1f}s ({duration/60:.1f} min)")

    # Timing and speed estimates
    if started_at:
        elapsed = (datetime.now() - started_at).total_seconds()
        lines.append(f"🕐 Elapsed: {elapsed:.0f}s ({elapsed/60:.1f} min)")
        if progress > 0:
            estimated_total = elapsed / progress
            remaining = max(estimated_total - elapsed, 0)
            eta = datetime.now() + timedelta(seconds=remaining)
            lines.append(f"⏳ Remaining (est.): {remaining:.0f}s ({remaining/60:.1f} min) | ETA {eta.strftime('%H:%M:%S')}")
            if duration > 0:
                audio_processed = duration * progress
                speed_ratio = elapsed / max(audio_processed, 1e-6)
                lines.append(f"⚡ Speed: {speed_ratio:.2f}x realtime")

    if stage:
        lines.append(f"🔄 Stage: {stage}")

    # Errors (if any)
    if state == "FAILED":
        emsg = status.get("error_message")
        if emsg:
            lines.append(f"❌ Error: {emsg}")
    if completed_at:
        lines.append(f"✅ Completed at: {completed_at.strftime('%H:%M:%S')}")

    lines.append("=" * 60)
    return "\n".join(lines)


def monitor(url_base: str, file_id: int, interval: int, once: bool, timeout: float) -> int:
    status_url = f"{url_base.rstrip('/')}/api/transcription/{file_id}/status"
    last_state = None
    try:
        while True:
            status = fetch_json(status_url, timeout=timeout)
            if not status:
                print(f"⚠️  Unable to fetch status: {status_url}")
                if once:
                    return 2
                time.sleep(interval)
                continue

            print(render_snapshot(status))
            state = (status.get("status") or "unknown").lower()

            if once:
                return 0

            if state in {"completed", "failed"}:
                # Print one final snapshot and exit
                return 0 if state == "completed" else 1

            # Avoid spamming identical lines too quickly
            if last_state != state:
                last_state = state
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n🛑 Monitoring stopped by user")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Monitor a transcription by file ID")
    parser.add_argument("--file-id", type=int, required=True, help="Audio file ID to monitor")
    parser.add_argument("--url", default="http://localhost:8000", help="API base URL (default: http://localhost:8000)")
    parser.add_argument("--interval", type=int, default=5, help="Polling interval in seconds (default: 5)")
    parser.add_argument("--timeout", type=float, default=12.0, help="HTTP request timeout in seconds (default: 12)")
    parser.add_argument("--once", action="store_true", help="Print a single snapshot and exit")
    args = parser.parse_args()

    return monitor(args.url, args.file_id, args.interval, args.once, args.timeout)


if __name__ == "__main__":
    sys.exit(main())
