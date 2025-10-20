"""
Global transcription service singleton to avoid repeated model downloads.
"""
import re
import subprocess
import threading
from typing import Optional, Dict, Any
from .transcription_service import (
    TranscriptionService,
    VALID_MODEL_SIZES,
    MODEL_PRIORITIES,
    normalize_model_name,
)
from ..core.config import settings

# Global instance and lock for thread safety
_global_transcription_service: Optional[TranscriptionService] = None
_initialization_lock = threading.Lock()
_initialization_in_progress = False
_model_ready = False


def _model_cache_candidates(model_size: str) -> list[str]:
    """Return possible cache filenames for a given model."""
    special_cases = {
        "large": ["large-v3.pt", "large-v2.pt", "large.pt"],
        "large-v1": ["large-v1.pt"],
        "large-v2": ["large-v2.pt"],
        "large-v3": ["large-v3.pt"],
        "turbo": ["turbo.pt"],
    }
    return special_cases.get(model_size, [f"{model_size}.pt"])


def _normalize_model_size(value: Optional[str]) -> Optional[str]:
    """Convert model size to canonical form if valid."""
    return normalize_model_name(value)


def _determine_initial_model_size() -> str:
    """Decide which Whisper model should be initialized first."""
    from ..core.config import settings

    configured = normalize_model_name(settings.WHISPER_MODEL_SIZE) or "base"

    pending_models: list[str] = []
    for entry in _pending_transcriptions:
        model_value = _normalize_model_size(entry.get("model_size"))
        if model_value:
            pending_models.append(model_value)

    if pending_models:
        preferred = max(pending_models, key=lambda size: MODEL_PRIORITIES[size])
        if MODEL_PRIORITIES[preferred] > MODEL_PRIORITIES[configured]:
            return preferred

    return configured


def get_transcription_service() -> TranscriptionService:
    """Get the global transcription service instance."""
    global _global_transcription_service, _initialization_in_progress
    
    with _initialization_lock:
        if _global_transcription_service is None:
            if _initialization_in_progress:
                raise RuntimeError("❌ Transcription service initialization in progress. Please wait.")
            raise RuntimeError("❌ Transcription service not initialized. Call initialize_transcription_service() first.")
        
        # Verify model is actually loaded
        if _global_transcription_service.model is None:
            raise RuntimeError("❌ Whisper model not loaded. Service initialization may have failed.")

        return _global_transcription_service


def is_transcription_service_ready() -> bool:
    """Check if the transcription service is ready for use."""
    global _global_transcription_service, _initialization_in_progress
    
    with _initialization_lock:
        if _initialization_in_progress:
            return False  # Still initializing
            
        return (
            _global_transcription_service is not None and 
            _global_transcription_service.model is not None
        )


def is_initialization_in_progress() -> bool:
    """Return True if the Whisper service is currently being initialized."""
    global _initialization_in_progress

    with _initialization_lock:
        return _initialization_in_progress


def get_target_model_size() -> str:
    """
    Get the Whisper model size that should be loaded next.
    If the service is ready, return the active model size; otherwise, return the pending/configured target.
    """
    with _initialization_lock:
        if _global_transcription_service and _global_transcription_service.model:
            return _global_transcription_service.model_size

    return _determine_initial_model_size()


def _mark_model_ready(is_ready: bool) -> None:
    """Update internal readiness flag."""
    global _model_ready
    _model_ready = is_ready


def is_model_cached_on_disk(model_size: str = None) -> bool:
    """Check if any Whisper model is already downloaded and cached on disk."""
    import os
    
    cache_dir = os.path.expanduser("~/.cache/whisper")
    if not os.path.exists(cache_dir):
        return False
    
    if model_size is None:
        # If no specific model requested, check if ANY model is cached
        try:
            files = os.listdir(cache_dir)
            model_files = [f for f in files if f.endswith('.pt')]
            return len(model_files) > 0
        except OSError:
            return False
    else:
        # Check for specific model
        cache_candidates = _model_cache_candidates(model_size)
        for candidate in cache_candidates:
            model_path = os.path.join(cache_dir, candidate)
            if os.path.exists(model_path):
                return True
        return False


def is_model_ready() -> bool:
    """Return True if the Whisper model has been loaded into memory."""
    return _model_ready


def initialize_transcription_service() -> None:
    """Initialize the global transcription service and pre-load the model."""
    global _global_transcription_service, _initialization_in_progress
    
    with _initialization_lock:
        # Check if already initialized
        if _global_transcription_service is not None:
            print("ℹ️  Transcription service already initialized.")
            return
            
        # Check if initialization is already in progress
        if _initialization_in_progress:
            print("ℹ️  Transcription service initialization already in progress.")
            return
            
        # Mark initialization as in progress
        _initialization_in_progress = True
    
    try:
        _mark_model_ready(False)
        if settings.E2E_TRANSCRIPTION_STUB:
            print("🤖 [E2E] Initializing transcription stub service (skipping Whisper download)...")
            service = TranscriptionService(model_size_override="tiny")
            service.model = "stub"  # Mark as ready without loading actual model
            with _initialization_lock:
                _global_transcription_service = service
                _initialization_in_progress = False
                _mark_model_ready(True)
            process_pending_transcriptions()
            return

        print("🤖 Initializing Whisper transcription service...")
        desired_model_size = _determine_initial_model_size()
        
        # Monitor memory usage
        import psutil
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024
        print(f"💾 Initial memory usage: {initial_memory:.1f}MB")
        
        # Create service instance
        service = TranscriptionService(model_size_override=desired_model_size)
        if service.model_size != service.configured_model_size:
            print(
                f"🎯 Pending transcription requested Whisper '{service.model_size}' "
                f"(configured default: '{service.configured_model_size}'). Using requested model for initialization."
            )
        
        # Check if model cache exists before loading
        import os
        # Lazy import whisper to avoid blocking during module import
        import whisper
        
        model_size = service.model_size
        cache_dir = os.path.expanduser("~/.cache/whisper")
        
        # Resolve potential cache filenames for the selected model
        cache_candidates = _model_cache_candidates(model_size)
        model_filename = cache_candidates[0]
        existing_path = None
        for candidate in cache_candidates:
            candidate_path = os.path.join(cache_dir, candidate)
            if os.path.exists(candidate_path):
                existing_path = candidate_path
                model_filename = candidate
                break
        
        if existing_path:
            file_size = os.path.getsize(existing_path) / (1024 * 1024)
            print(f"📁 Found cached Whisper model '{model_filename}' ({file_size:.1f}MB) - loading from cache...")
        else:
            print(f"📦 Whisper model '{model_filename}' not cached - downloading...")
            print("⏳ Please wait - this may take several minutes on first download...")
        
        # Load model with memory monitoring
        print(f"🔄 Loading Whisper model '{model_size}' into memory...")
        pre_load_memory = process.memory_info().rss / 1024 / 1024
        print(f"💾 Memory before model load: {pre_load_memory:.1f}MB")
        
        service.load_model()  # This will block until loading completes
        _mark_model_ready(True)
        
        post_load_memory = process.memory_info().rss / 1024 / 1024
        memory_increase = post_load_memory - pre_load_memory
        print(f"💾 Memory after model load: {post_load_memory:.1f}MB (+{memory_increase:.1f}MB)")
        print(f"✅ Whisper model '{model_size}' loaded successfully!")
        print("🚀 Transcription service ready - API can now accept requests.")
        
        # Set the global service atomically
        with _initialization_lock:
            _global_transcription_service = service
            _initialization_in_progress = False
        
        # Process any pending transcription requests
        process_pending_transcriptions()
        
    except Exception as e:
        import traceback
        print(f"❌ Failed to load Whisper model: {e}")
        print(f"❌ Stack trace: {traceback.format_exc()}")
        
        # Clear initialization state on failure
        with _initialization_lock:
            _global_transcription_service = None
            _initialization_in_progress = False
            _mark_model_ready(False)
            
        raise RuntimeError(f"Whisper initialization failed: {e}")


def get_model_download_progress() -> Optional[Dict[str, Any]]:
    """
    Get current model download/loading progress.
    Returns dict with progress info or None if not downloading.
    """
    global _download_progress, _global_transcription_service
    
    # If service is ready, no progress needed
    if _global_transcription_service and _global_transcription_service.model:
        return None
    
    # If we have tracked progress, return it
    if _download_progress:
        return _download_progress.copy()
    
    # Check if model file already exists (download completed)
    import os
    import glob
    model_size = get_target_model_size()
    cache_dir = os.path.expanduser("~/.cache/whisper")
    
    # Model sizes in MB (actual file sizes from disk)
    model_sizes = {
        "tiny": 72,      # Actual: 72MB
        "tiny.en": 72,
        "base": 142,
        "base.en": 142,
        "small": 461,    # Actual: 461MB
        "small.en": 461,
        "medium": 1460,
        "medium.en": 1460,
        "turbo": 1540,
        "large": 2900,
        "large-v1": 2900,
        "large-v2": 2900,
        "large-v3": 2900,
    }
    
    model_size_mb = model_sizes.get(model_size, 142)  # Default to base size
    model_size_display = f"{model_size_mb}MB" if model_size_mb < 1000 else f"{model_size_mb/1000:.1f}GB"
    
    cache_candidates = _model_cache_candidates(model_size)
    for candidate in cache_candidates:
        model_path = os.path.join(cache_dir, candidate)
        if os.path.exists(model_path):
            file_size_mb = os.path.getsize(model_path) / (1024 * 1024)
            downloaded_display = f"{int(file_size_mb)}MB" if file_size_mb < 1000 else f"{file_size_mb/1000:.1f}GB"

            # Check if file is still being downloaded (file size < expected size)
            # Allow 5% tolerance for size variations between model versions
            expected_min_size = model_size_mb * 0.95

            if file_size_mb < expected_min_size:
                # File exists but is incomplete - still downloading
                progress = min(int((file_size_mb / model_size_mb) * 100), 99)
                return {
                    'progress': progress,
                    'downloaded': downloaded_display,
                    'total': model_size_display,
                    'speed': "Downloading...",
                    'model_size': model_size
                }
            else:
                # File is complete
                return {
                    'progress': 100,
                    'downloaded': downloaded_display,
                    'total': model_size_display,
                    'speed': "Complete - ready to load into memory",
                    'model_size': model_size
                }
    
    # Check if we're in the process of loading/downloading
    if not is_transcription_service_ready():
        # Check if download is in progress by looking for partial file or active downloads
        import glob
        partial_patterns = []
        for candidate in cache_candidates:
            base = candidate.rsplit(".pt", 1)[0]
            partial_patterns.append(os.path.join(cache_dir, f"{base}*.pt.tmp"))
            partial_patterns.append(os.path.join(cache_dir, f"{base}*.pt.part"))

        partial_files = []
        for pattern in partial_patterns:
            partial_files.extend(glob.glob(pattern))
    
        if partial_files:
            # Get the size of the downloading file
            partial_file = partial_files[0]
            try:
                current_size_bytes = os.path.getsize(partial_file)
                current_size_mb = current_size_bytes / (1024 * 1024)
                progress = min(int((current_size_mb / model_size_mb) * 100), 99)  # Cap at 99% until complete
                
                return {
                    'progress': progress,
                    'downloaded': f"{int(current_size_mb)}MB" if current_size_mb < 1000 else f"{current_size_mb/1000:.1f}GB",
                    'total': model_size_display,
                    'speed': "Downloading..." if progress < 50 else "Completing..."
                }
            except OSError:
                pass
        
        # Only show time-based estimation if we have marked a start time (download actually triggered)
        if hasattr(get_model_download_progress, '_start_time'):
            import time
            elapsed = time.time() - get_model_download_progress._start_time
            estimated_total_time = model_size_mb / 4  # seconds for download at ~4MB/s
            estimated_progress = min(int((elapsed / estimated_total_time) * 100), 95)  # Allow up to 95%
            estimated_downloaded = int((estimated_progress / 100.0) * model_size_mb)
            
            return {
                'progress': estimated_progress,
                'downloaded': f"{estimated_downloaded}MB" if estimated_downloaded < 1000 else f"{estimated_downloaded/1000:.1f}GB",
                'total': model_size_display,
                'speed': f"~{int(model_size_mb/estimated_total_time)}MB/s" if elapsed > 10 else "Downloading..."
            }
    
    return None  # No download in progress

    return None


def update_model_loading_progress_in_db() -> None:
    """
    Update transcription_progress in database for all files waiting on model download.
    Maps download progress (0-100%) to main progress (0-10% range).
    """
    download_info = get_model_download_progress()

    # If no download in progress or model is ready, nothing to update
    if not download_info or download_info.get('progress') is None:
        return

    # Map download progress (0-100%) to main progress (0-10%)
    download_percent = download_info['progress']  # 0-100
    main_progress = download_percent * 0.10  # Convert to 0.0-10.0
    main_progress_fraction = main_progress / 100.0  # Convert to 0.0-0.10 for database

    # Find all files waiting for model loading
    from ..core.database import get_db
    from ..models.audio_file import AudioFile

    db = next(get_db())
    try:
        # Find files with status=PROCESSING and stage containing "Loading Whisper model"
        files_waiting = db.query(AudioFile).filter(
            AudioFile.transcription_stage.ilike("%Loading Whisper model%")
        ).all()

        if files_waiting:
            for audio_file in files_waiting:
                # Update progress (0.0 to 0.10)
                audio_file.transcription_progress = main_progress_fraction

            db.commit()
            print(f"📊 Updated model loading progress to {main_progress:.1f}% ({download_percent}% download) for {len(files_waiting)} file(s)")
    except Exception as e:
        print(f"⚠️ Failed to update model loading progress in DB: {e}")
        db.rollback()
    finally:
        db.close()


# Global progress tracking
_download_progress = None

# Track pending transcription requests (file_id, include_diarization)
_pending_transcriptions: list[dict] = []


def cleanup_transcription_service() -> None:
    """Clean up the global transcription service."""
    global _global_transcription_service
    _global_transcription_service = None
    _mark_model_ready(False)
    print("Transcription service cleaned up.")


def add_pending_transcription(
    file_id: int,
    *,
    include_diarization: bool = True,
    model_size: str | None = None,
    language: str | None = None,
    force_restart: bool = False,
) -> None:
    """Add or update a transcription request in the pending queue."""
    global _pending_transcriptions

    for entry in _pending_transcriptions:
        if entry["file_id"] == file_id:
            entry.update(
                {
                    "include_diarization": include_diarization,
                    "model_size": model_size,
                    "language": language,
                    "force_restart": force_restart,
                }
            )
            break
    else:
        _pending_transcriptions.append(
            {
                "file_id": file_id,
                "include_diarization": include_diarization,
                "model_size": model_size,
                "language": language,
                "force_restart": force_restart,
            }
        )

    print(f"📝 Added file {file_id} to pending transcription queue")


def get_pending_transcriptions() -> list:
    """Get and clear the list of pending transcriptions."""
    global _pending_transcriptions
    pending = [entry.copy() for entry in _pending_transcriptions]
    _pending_transcriptions.clear()
    return pending


def has_pending_transcriptions() -> bool:
    """Check if there are pending transcription requests."""
    global _pending_transcriptions
    return len(_pending_transcriptions) > 0


def process_pending_transcriptions() -> None:
    """Process all pending transcription requests after model is ready."""
    pending = get_pending_transcriptions()
    if pending:
        print(f"🚀 Processing {len(pending)} pending transcription request(s)...")
        
        # Import here to avoid circular imports
        from ..api.transcription import transcribe_task

        for entry in pending:
            file_id = entry["file_id"]
            include_diarization = entry.get("include_diarization", True)
            model_size = entry.get("model_size")
            language = entry.get("language")
            force_restart = entry.get("force_restart", False)
            try:
                print(f"📝 Starting transcription for file {file_id}")
                # Create a new thread for each transcription to avoid blocking
                import threading
                thread = threading.Thread(
                    target=transcribe_task, 
                    kwargs={
                        "audio_file_id": file_id,
                        "include_diarization": include_diarization,
                        "model_size": model_size,
                        "language": language,
                        "force_restart": force_restart,
                    },
                    daemon=True
                )
                thread.start()
            except Exception as e:
                print(f"❌ Failed to start transcription for file {file_id}: {e}")
    else:
        print("ℹ️ No pending transcription requests to process after model initialization.")
