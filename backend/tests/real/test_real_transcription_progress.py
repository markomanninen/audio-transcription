"""
Real transcription progress test - NO STUBS, uses actual Whisper with large model.
This test verifies that the tqdm monkey-patch correctly captures real progress.

CURRENTLY SKIPPED due to FFmpeg configuration challenges in real test environment.
"""
import time
import pytest

from app.models.audio_file import AudioFile, TranscriptionStatus
from app.services.transcription_service import TranscriptionService


@pytest.mark.slow
def test_real_transcription_with_large_model_progress(client, sample_project, sample_audio_file, test_db):
    """
    REAL transcription test - NO MOCKING!
    - Uses actual 30-second audio file
    - Uses LARGE Whisper model
    - Verifies REAL progress updates from tqdm
    - Confirms progress increases monotonically
    - Validates all stages appear
    """
    file_id = sample_audio_file.id

    print("\n" + "=" * 80)
    print("REAL TRANSCRIPTION PROGRESS TEST - LARGE MODEL")
    print("=" * 80)
    print(f"File ID: {file_id}")
    print("Model: LARGE (tests real progress tracking)")
    print("Expected duration: ~2-3 minutes")
    print("-" * 80)

    # Start real transcription with LARGE model
    start_response = client.post(
        f"/api/transcription/{file_id}/start",
        json={
            "model_size": "large",
            "language": None,
            "include_diarization": False
        }
    )
    assert start_response.status_code in [200, 202], f"Failed to start: {start_response.text}"
    print("Transcription started successfully\n")

    # Monitor real progress
    progress_history = []
    stage_history = []
    last_progress = -1.0
    stuck_count = 0

    # Different timeouts for different phases:
    # - Model loading can take 60+ seconds (3GB model loading into memory)
    # - Once transcription starts, progress should update frequently
    max_stuck_during_init = 180  # 3 minutes allowed for model loading (large model needs time!)
    max_stuck_during_transcription = 60  # 60 seconds without progress during transcription = fail
    model_loaded = False  # Track if we've seen the model finish loading

    start_time = time.time()
    timeout = 300  # 5 minutes max

    while time.time() - start_time < timeout:
        elapsed = time.time() - start_time

        # Get current status
        status_response = client.get(f"/api/transcription/{file_id}/status")
        assert status_response.status_code == 200
        status_data = status_response.json()

        current_status = status_data["status"]
        current_progress = status_data.get("progress", 0.0)
        current_stage = status_data.get("processing_stage", "unknown")

        # Check if model loading is complete (actual transcription started)
        # During model loading, we stay at processing/pending with low progress
        # Once transcription starts, we should see progress > 0.1 or different stage
        if (current_status == "processing" and 
            (current_progress > 0.1 or current_stage not in ["pending", "unknown"])):
            model_loaded = True

        # Record progress
        if current_progress != last_progress:
            progress_history.append({
                "elapsed": elapsed,
                "progress": current_progress,
                "stage": current_stage,
                "status": current_status
            })

            # Print progress update
            print(f"[{elapsed:>6.1f}s] {current_progress*100:>5.1f}% | {current_status:12s} | {current_stage} | Model loaded: {model_loaded}")

            # Verify progress INCREASES (no regression!)
            if current_progress < last_progress:
                pytest.fail(
                    f"PROGRESS REGRESSION! "
                    f"Went from {last_progress*100:.1f}% to {current_progress*100:.1f}%"
                )

            last_progress = current_progress
            stuck_count = 0
        else:
            stuck_count += 1
            # Print stuck status every 10 seconds
            if stuck_count % 10 == 0:
                print(f"[{elapsed:>6.1f}s] STUCK at {current_progress*100:>5.1f}% for {stuck_count}s | {current_status} | {current_stage} | Model loaded: {model_loaded}")

        # Record unique stages
        if current_stage not in stage_history:
            stage_history.append(current_stage)

        # Check if completed (API returns uppercase status)
        if current_status in ["completed", "COMPLETED"]:
            print("\n" + "=" * 80)
            print("TRANSCRIPTION COMPLETED SUCCESSFULLY")
            print("=" * 80)
            break

        # Check if failed
        if current_status in ["failed", "FAILED"]:
            error_msg = status_data.get("error_message", "Unknown error")
            pytest.fail(f"Transcription failed: {error_msg}")

        # Check if stuck - use different timeout based on phase
        max_stuck_allowed = max_stuck_during_transcription if model_loaded else max_stuck_during_init

        if stuck_count >= max_stuck_allowed:
            phase = "transcription" if model_loaded else "initialization (model loading)"
            pytest.fail(
                f"PROGRESS STUCK at {last_progress*100:.1f}% for {stuck_count} seconds during {phase}!\n"
                f"Last stage: {current_stage}\n"
                f"Status: {current_status}"
            )

        time.sleep(1)
    else:
        pytest.fail(f"Transcription timed out after {timeout} seconds")

    # Final verification
    final_status = client.get(f"/api/transcription/{file_id}/status").json()

    print("\n" + "-" * 80)
    print("FINAL VERIFICATION")
    print("-" * 80)
    print(f"Final status: {final_status['status']}")
    print(f"Final progress: {final_status['progress']*100:.1f}%")
    print(f"Segment count: {final_status.get('segment_count', 0)}")
    print(f"Total stages seen: {len(stage_history)}")
    print(f"Progress updates: {len(progress_history)}")
    print(f"Total time: {elapsed:.1f}s")

    # Assertions
    assert final_status["status"].lower() == "completed", f"Transcription did not complete: {final_status['status']}"
    assert final_status["progress"] == pytest.approx(1.0, rel=1e-2), "Progress did not reach 100%"
    assert final_status["segment_count"] > 0, "No segments created"

    # Verify we saw meaningful progress updates
    assert len(progress_history) >= 3, f"Too few progress updates: {len(progress_history)}"

    # Verify we saw key stages (with large model we should see more detailed stages)
    expected_stages_patterns = [
        "running",    # Running whisper transcription 
        "transcrib",  # Transcribing
        "complete"    # Completion
    ]

    # Filter out None values from stage_history before joining
    valid_stages = [stage for stage in stage_history if stage is not None]
    stages_text = " ".join(valid_stages).lower()
    for pattern in expected_stages_patterns:
        assert pattern in stages_text, f"Missing expected stage pattern: {pattern}"

    print("\n" + "=" * 80)
    print("PROGRESS HISTORY:")
    print("-" * 80)
    for i, entry in enumerate(progress_history, 1):
        print(f"{i:3d}. [{entry['elapsed']:>6.1f}s] {entry['progress']*100:>5.1f}% | {entry['stage']}")

    print("\n" + "=" * 80)
    print("UNIQUE STAGES OBSERVED:")
    print("-" * 80)
    for i, stage in enumerate(stage_history, 1):
        print(f"{i:3d}. {stage}")

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED - REAL PROGRESS TRACKING WORKS!")
    print("=" * 80)
