"""
Global transcription service singleton to avoid repeated model downloads.
"""
import re
import subprocess
import threading
from typing import Optional, Dict, Any
from .transcription_service import TranscriptionService

# Global instance and lock for thread safety
_global_transcription_service: Optional[TranscriptionService] = None
_initialization_lock = threading.Lock()
_initialization_in_progress = False


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
        print("🤖 Initializing Whisper transcription service...")
        
        # Monitor memory usage
        import psutil
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024
        print(f"💾 Initial memory usage: {initial_memory:.1f}MB")
        
        # Create service instance
        service = TranscriptionService()
        
        # Check if model cache exists before loading
        import os
        import whisper
        
        model_size = service.model_size
        cache_dir = os.path.expanduser("~/.cache/whisper")
        
        # Check for the actual model file that Whisper creates (it uses -v3 suffix for large model)
        model_filename = f"{model_size}-v3.pt" if model_size == "large" else f"{model_size}.pt"
        model_path = os.path.join(cache_dir, model_filename)
        
        if os.path.exists(model_path):
            file_size = os.path.getsize(model_path) / (1024 * 1024)
            print(f"📁 Found cached Whisper model '{model_filename}' ({file_size:.1f}MB) - loading from cache...")
        else:
            print(f"📦 Whisper model '{model_size}' not cached - downloading...")
            print("⏳ Please wait - this may take several minutes on first download...")
        
        # Load model with memory monitoring
        print(f"🔄 Loading Whisper model '{model_size}' into memory...")
        pre_load_memory = process.memory_info().rss / 1024 / 1024
        print(f"💾 Memory before model load: {pre_load_memory:.1f}MB")
        
        service.load_model()  # This will block until loading completes
        
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
    import os
    import glob
    from .transcription_service import TranscriptionService
    temp_service = TranscriptionService()
    model_size = temp_service.model_size
    cache_dir = os.path.expanduser("~/.cache/whisper")
    
    # Model sizes in MB
    model_sizes = {
        "tiny": 39,
        "base": 142, 
        "small": 488,
        "medium": 1460,
        "large": 2900
    }
    
    model_size_mb = model_sizes.get(model_size, 142)  # Default to base size
    model_size_display = f"{model_size_mb}MB" if model_size_mb < 1000 else f"{model_size_mb/1000:.1f}GB"
    
    # Check for the actual model file that Whisper creates (it uses -v3 suffix for large model)
    model_filename = f"{model_size}-v3.pt" if model_size == "large" else f"{model_size}.pt"
    model_path = os.path.join(cache_dir, model_filename)
    
    if os.path.exists(model_path):
        # Model file exists, download is complete
        return {
            'progress': 100,
            'downloaded': model_size_display,
            'total': model_size_display,
            'speed': "Complete - ready to load into memory"
        }
    
    # Check if we're in the process of loading/downloading
    if not is_transcription_service_ready():
        # Check if download is in progress by looking for partial file or active downloads
        import glob
        partial_files = glob.glob(os.path.join(cache_dir, f"{model_size}*.pt.tmp")) + \
                       glob.glob(os.path.join(cache_dir, f"{model_size}*.pt.part"))
        
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


# Global progress tracking
_download_progress = None

# Track pending transcription requests (file_id, include_diarization)
_pending_transcriptions = []


def cleanup_transcription_service() -> None:
    """Clean up the global transcription service."""
    global _global_transcription_service
    _global_transcription_service = None
    print("Transcription service cleaned up.")


def add_pending_transcription(file_id: int, include_diarization: bool = False) -> None:
    """Add a transcription request to the pending queue."""
    global _pending_transcriptions
    # Avoid duplicates
    if not any(req[0] == file_id for req in _pending_transcriptions):
        _pending_transcriptions.append((file_id, include_diarization))
        print(f"📝 Added file {file_id} to pending transcription queue")


def get_pending_transcriptions() -> list:
    """Get and clear the list of pending transcriptions."""
    global _pending_transcriptions
    pending = _pending_transcriptions.copy()
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
        from fastapi import BackgroundTasks
        from ..api.transcription import transcribe_task
        from ..core.database import SessionLocal
        
        # Create a background tasks instance and process each pending request
        for file_id, include_diarization in pending:
            try:
                print(f"📝 Starting transcription for file {file_id}")
                # Create a new thread for each transcription to avoid blocking
                import threading
                thread = threading.Thread(
                    target=transcribe_task, 
                    args=(file_id, include_diarization),
                    daemon=True
                )
                thread.start()
            except Exception as e:
                print(f"❌ Failed to start transcription for file {file_id}: {e}")