"""
Tests for transcription API endpoints.
"""
import json
import os
import sys
import threading
import time
import types
from io import BytesIO
from unittest.mock import Mock, patch

import pytest

from app.core import database as database_module
from app.models.audio_file import AudioFile, TranscriptionStatus
from app.models.segment import Segment
from app.services import transcription_service as transcription_service_module
from app.services.transcription_service import TranscriptionService


@pytest.fixture
def project_with_file(client, temp_audio_dir, sample_audio_content):
    """Create a project with an uploaded file."""
    # Create project
    project_response = client.post(
        "/api/upload/project",
        json={"name": "Test Project"}
    )
    project_id = project_response.json()["id"]

    # Upload file
    files = {"file": ("test.wav", BytesIO(sample_audio_content), "audio/wav")}
    upload_response = client.post(f"/api/upload/file/{project_id}", files=files)
    file_id = upload_response.json()["file_id"]

    return {"project_id": project_id, "file_id": file_id}


def test_get_transcription_status_pending(client, project_with_file):
    """Test getting status of untranscribed file."""
    file_id = project_with_file["file_id"]

    response = client.get(f"/api/transcription/{file_id}/status")
    assert response.status_code == 200
    data = response.json()
    assert data["file_id"] == file_id
    assert data["status"] == "pending"
    assert data["progress"] == 0.0
    assert data["segment_count"] == 0


def test_get_transcription_status_invalid_file(client):
    """Test getting status for non-existent file."""
    response = client.get("/api/transcription/99999/status")
    assert response.status_code == 404


def test_start_transcription(client, project_with_file, test_db):
    """Test starting transcription."""
    file_id = project_with_file["file_id"]

    # Patch SessionLocal where it's imported (in the function)
    with patch('app.core.database.SessionLocal') as mock_session, \
         patch('app.api.transcription.initialize_transcription_service') as mock_init, \
         patch('app.api.transcription.add_pending_transcription') as mock_add_pending, \
         patch('app.api.transcription.is_transcription_service_ready', return_value=False) as mock_ready:
        mock_session.return_value = test_db
        mock_init.return_value = None
        mock_add_pending.return_value = None
        mock_ready.return_value = False

        response = client.post(
            f"/api/transcription/{file_id}/start",
            json={"include_diarization": True}
        )
        assert response.status_code == 202
        data = response.json()
        assert data["file_id"] == file_id
        assert data["include_diarization"] is True

        # Verify queuing behavior when service not yet ready
        mock_add_pending.assert_called_once()
        mock_init.assert_called_once()


def test_get_segments_empty(client, project_with_file):
    """Test getting segments before transcription."""
    file_id = project_with_file["file_id"]

    response = client.get(f"/api/transcription/{file_id}/segments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_get_speakers_empty(client, project_with_file):
    """Test getting speakers before diarization."""
    file_id = project_with_file["file_id"]

    response = client.get(f"/api/transcription/{file_id}/speakers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_split_audio_batch_creates_new_files(client, test_db, project_with_file):
    """Splitting an audio file should create chunk entries without starting transcription."""
    file_id = project_with_file["file_id"]

    response = client.post(
        f"/api/transcription/{file_id}/split-batch",
        json={"chunk_duration_seconds": 30, "start_transcription": False}
    )

    assert response.status_code == 200
    payload = response.json()
    created_files = payload["created_files"]
    assert len(created_files) >= 2
    assert all(not entry["transcription_requested"] for entry in created_files)

    created_ids = [entry["file_id"] for entry in created_files]
    stored_files = test_db.query(AudioFile).filter(AudioFile.id.in_(created_ids)).all()
    assert len(stored_files) == len(created_ids)
    # Files should inherit parent relationship and metadata
    for chunk in created_files:
        assert "chunk_label" in chunk
        assert chunk["chunk_label"] is not None
        assert chunk["parent_file_id"] == file_id
        assert chunk["original_filename"].startswith(f"{chunk['chunk_label']} -")

    for stored in stored_files:
        assert stored.parent_audio_file_id == file_id
        assert stored.split_start_seconds is not None
        assert stored.split_end_seconds is not None
        assert stored.split_depth == 1
        assert stored.split_order >= 0
        assert stored.original_filename.split(" - ", 1)[0].count("/") == 1
        metadata = json.loads(stored.transcription_metadata or "{}")
        assert metadata.get("chunk_label")
        assert metadata.get("chunk_total") == len(created_files)


def test_split_files_ordered_after_parent(client, project_with_file):
    """Splits should appear directly beneath their parent when listing files."""
    file_id = project_with_file["file_id"]
    project_id = project_with_file["project_id"]

    response = client.post(
        f"/api/transcription/{file_id}/split-batch",
        json={"chunk_duration_seconds": 30, "start_transcription": False}
    )
    assert response.status_code == 200
    created_ids = [entry["file_id"] for entry in response.json()["created_files"]]

    files_response = client.get(f"/api/upload/files/{project_id}")
    assert files_response.status_code == 200
    files = files_response.json()

    parent_index = next(i for i, entry in enumerate(files) if entry["file_id"] == file_id)
    child_indices = [i for i, entry in enumerate(files) if entry["file_id"] in created_ids]

    assert child_indices, "Expected split files to be present in listing"
    expected_sequence = list(range(parent_index + 1, parent_index + 1 + len(created_ids)))
    assert child_indices == expected_sequence

    for child in (entry for entry in files if entry["file_id"] in created_ids):
        assert child["parent_audio_file_id"] == file_id
        assert child["split_depth"] == 1
        assert child["split_start_seconds"] is not None
        assert child["split_end_seconds"] is not None


@patch('app.services.transcription_service.whisper')
def test_transcription_service(mock_whisper, test_db, temp_audio_dir):
    """Test transcription service with mocked Whisper."""
    from app.models.project import Project
    from app.models.audio_file import AudioFile
    import tempfile

    # Create test project and file
    project = Project(name="Test Project")
    test_db.add(project)
    test_db.flush()

    # Create temporary audio file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(b'\x00' * 1000)
        temp_path = f.name

    audio_file = AudioFile(
        project_id=project.id,
        filename="test.wav",
        original_filename="test.wav",
        file_path=temp_path,
        file_size=1000,
        format="wav"
    )
    test_db.add(audio_file)
    test_db.commit()

    # Mock Whisper model
    mock_model = Mock()
    mock_model.transcribe.return_value = {
        "segments": [
            {
                "start": 0.0,
                "end": 5.0,
                "text": "Hello, this is a test."
            },
            {
                "start": 5.0,
                "end": 10.0,
                "text": "This is the second segment."
            }
        ]
    }
    mock_whisper.load_model.return_value = mock_model

    # Run transcription
    service = TranscriptionService()
    
    # Create a real temporary file for converted output 
    with tempfile.NamedTemporaryFile(suffix="_converted.wav", delete=False) as f:
        f.write(b'\x00' * 1000)  # Write some dummy data
        converted_path = f.name

    def mock_convert_to_wav(file_path):
        """Mock that returns a real file path with dummy content"""
        return converted_path

    with patch('app.services.audio_service.AudioService.convert_to_wav', side_effect=mock_convert_to_wav):
        segments = service.transcribe_audio(audio_file.id, test_db)

    # Verify results
    assert len(segments) == 2
    assert segments[0].original_text == "Hello, this is a test."
    assert segments[1].original_text == "This is the second segment."
    assert segments[0].start_time == 0.0
    assert segments[1].end_time == 10.0

    # Cleanup
    for path in [temp_path, converted_path]:
        if os.path.exists(path):
            os.remove(path)


def test_transcription_status_progress_states(client, project_with_file, test_db, monkeypatch):
    """Ensure transcription status endpoint reflects real progress updates from service."""
    file_id = project_with_file["file_id"]

    # Provide deterministic psutil metrics so readiness checks return quickly.
    memory_snapshot = types.SimpleNamespace(
        available=16 * 1024**3,
        total=32 * 1024**3,
    )
    monkeypatch.setattr(
        transcription_service_module.psutil,
        "virtual_memory",
        lambda: memory_snapshot,
    )
    monkeypatch.setattr(
        transcription_service_module.psutil,
        "cpu_percent",
        lambda interval=None: 10.0,
    )

    class FakeProcess:
        def cpu_percent(self):
            return 12.0

        def memory_info(self):
            return types.SimpleNamespace(rss=128 * 1024 * 1024)

        def num_threads(self):
            return 4

    monkeypatch.setattr(
        transcription_service_module.psutil,
        "Process",
        lambda: FakeProcess(),
    )

    # Accelerate internal sleeps so the test runs quickly.
    original_sleep = transcription_service_module.time.sleep

    def fast_sleep(seconds: float) -> None:
        return original_sleep(min(seconds, 0.01))

    monkeypatch.setattr(transcription_service_module.time, "sleep", fast_sleep)

    # Avoid expensive audio conversions during the test.
    monkeypatch.setattr(
        "app.services.audio_service.AudioService.convert_to_wav",
        lambda self, path: path,
    )

    # Provide lightweight tqdm implementation to drive progress monitoring.
    fake_tqdm_module = types.ModuleType("tqdm")

    class DummyTqdm:
        def __init__(self, iterable=None, total=None, **kwargs):
            if total is None:
                if iterable is not None:
                    try:
                        total = len(iterable)
                    except TypeError:
                        total = 1
                else:
                    total = 1
            self.total = max(int(total), 1)
            self.n = 0

        def update(self, n: int = 1):
            self.n += n
            return self.n

    fake_tqdm_module.tqdm = DummyTqdm
    monkeypatch.setitem(sys.modules, "tqdm", fake_tqdm_module)

    # Provide a deterministic Whisper model that exercises the progress monitor.
    class FakeWhisperModel:
        def transcribe(
            self,
            wav_path,
            temperature=0.0,
            word_timestamps=True,
            language=None,
            task="transcribe",
            verbose=False,
        ):
            import tqdm as tqdm_module

            progress_steps = 5
            bar = tqdm_module.tqdm(total=progress_steps)
            for _ in range(progress_steps):
                time.sleep(0.05)
                bar.update(1)

            return {
                "segments": [
                    {"start": 0.0, "end": 2.5, "text": "First synthetic segment."},
                    {"start": 2.5, "end": 5.0, "text": "Second synthetic segment."},
                ]
            }

    fake_whisper_module = types.ModuleType("whisper")
    fake_whisper_module.load_model = lambda model_name, device=None: FakeWhisperModel()

    monkeypatch.setitem(sys.modules, "whisper", fake_whisper_module)
    monkeypatch.setattr(transcription_service_module, "whisper", fake_whisper_module)

    # Use a dedicated service instance and expose it via the API helpers.
    service = TranscriptionService(model_size_override="tiny")
    service.model = FakeWhisperModel()
    service.loaded_models["tiny"] = service.model

    monkeypatch.setattr("app.api.transcription.is_transcription_service_ready", lambda: True)
    monkeypatch.setattr("app.api.transcription.get_transcription_service", lambda: service)

    original_override = client.app.dependency_overrides.get(database_module.get_db)

    def fresh_session_override():
        session = database_module.SessionLocal()
        try:
            yield session
        finally:
            session.close()

    client.app.dependency_overrides[database_module.get_db] = fresh_session_override

    try:
        # Ensure the audio file will request the tiny model and has a clean state.
        audio_file = test_db.get(AudioFile, file_id)
        audio_file.transcription_metadata = json.dumps({
            "model_size": "tiny",
            "include_diarization": False,
            "language": None,
        })
        audio_file.language = None
        audio_file.transcription_status = TranscriptionStatus.PENDING
        audio_file.transcription_progress = 0.0
        audio_file.transcription_stage = ""
        audio_file.error_message = None
        audio_file.transcription_started_at = None
        audio_file.transcription_completed_at = None
        test_db.query(Segment).filter(Segment.audio_file_id == file_id).delete()
        test_db.commit()

        def run_transcription():
            thread_db = database_module.SessionLocal()
            try:
                service.resume_or_transcribe_audio(file_id, thread_db, force_restart=True)
            finally:
                thread_db.close()

        worker = threading.Thread(target=run_transcription, daemon=True)
        worker.start()

        stage_history: list[str] = []
        progress_values: list[float] = []
        final_payload: dict | None = None

        def record_stage(payload: dict) -> None:
            stage_value = payload.get("processing_stage")
            if stage_value and (not stage_history or stage_history[-1] != stage_value):
                stage_history.append(stage_value)

        start_time = time.time()
        timeout_seconds = 5.0

        while time.time() - start_time < timeout_seconds:
            response = client.get(f"/api/transcription/{file_id}/status")
            assert response.status_code == 200
            payload = response.json()

            progress_values.append(payload["progress"])
            record_stage(payload)

            status_value = payload["status"].lower()
            if status_value == "completed":
                final_payload = payload
                break
            if status_value == "failed":
                pytest.fail(f"Transcription reported failure: {payload.get('error_message')}")

            time.sleep(0.02)

        worker.join(timeout=3)
        if worker.is_alive():
            pytest.fail("Transcription thread did not finish in time")

        if final_payload is None:
            for _ in range(20):
                status_response = client.get(f"/api/transcription/{file_id}/status")
                assert status_response.status_code == 200
                fallback_payload = status_response.json()
                progress_values.append(fallback_payload["progress"])
                record_stage(fallback_payload)
                if fallback_payload["status"].lower() == "completed":
                    final_payload = fallback_payload
                    break
                time.sleep(0.05)

        if not final_payload:
            pytest.fail(
                f"Transcription did not complete. Stages observed: {stage_history}"
            )

        assert progress_values, "Expected to record at least one progress value"
        for earlier, later in zip(progress_values, progress_values[1:]):
            assert later + 1e-6 >= earlier, f"Progress regressed from {earlier} to {later}"

        informative_stages = [
            entry for entry in stage_history if entry and not entry.lower().startswith("initializing")
        ]
        expected_stage_sequence = [
            (("Running Whisper transcription -",), True),
            (("Transcribing audio -",), True),
            (
                (
                    "Creating text segments",
                    "Creating segments",
                    "Created ",
                ),
                False,
            ),
        ]

        assert informative_stages, f"No informative stages recorded: {stage_history}"
        current_index = -1
        for prefixes, required in expected_stage_sequence:
            matches = [
                idx
                for idx, entry in enumerate(informative_stages)
                if any(entry.startswith(prefix) for prefix in prefixes)
            ]
            if not matches:
                assert not required, (
                    "Missing required stage matching any of "
                    f"{prefixes}. Observed: {informative_stages}"
                )
                continue
            first_match = matches[0]
            assert first_match > current_index, (
                f"Stage sequence invalid. Expected one of {prefixes} after index "
                f"{current_index}, observed order: {informative_stages}"
            )
            current_index = first_match

        assert final_payload["status"].lower() == "completed"
        assert final_payload["progress"] == pytest.approx(1.0, rel=1e-3)
        assert final_payload["segment_count"] == 2
    finally:
        if original_override is not None:
            client.app.dependency_overrides[database_module.get_db] = original_override
        else:
            client.app.dependency_overrides.pop(database_module.get_db, None)


def test_split_status_includes_origin_details(client, project_with_file, monkeypatch):
    """Transcription status for split chunks should expose split metadata."""
    file_id = project_with_file["file_id"]

    split_response = client.post(
        f"/api/transcription/{file_id}/split-batch",
        json={"chunk_duration_seconds": 30, "start_transcription": False}
    )
    assert split_response.status_code == 200
    first_child_id = split_response.json()["created_files"][0]["file_id"]

    monkeypatch.setattr("app.api.transcription.is_transcription_service_ready", lambda: False)
    monkeypatch.setattr("app.api.transcription.has_pending_transcriptions", lambda: False)

    status_response = client.get(f"/api/transcription/{first_child_id}/status")
    assert status_response.status_code == 200
    body = status_response.json()
    assert body["parent_file_id"] == file_id
    assert body["split_label"] is not None
    assert body["split_origin_filename"] is not None
    assert body["split_start_seconds"] is not None
    assert body["split_end_seconds"] is not None
