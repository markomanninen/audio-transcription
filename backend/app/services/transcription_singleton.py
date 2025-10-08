"""
Global transcription service singleton to avoid repeated model downloads.
"""
import re
import subprocess
from typing import Optional, Dict, Any
from .transcription_service import TranscriptionService

# Global instance
_global_transcription_service: Optional[TranscriptionService] = None


def get_transcription_service() -> TranscriptionService:
    """Get the global transcription service instance."""
    global _global_transcription_service
    if _global_transcription_service is None:
        raise RuntimeError("❌ Transcription service not initialized. Call initialize_transcription_service() first.")
    
    # Verify model is actually loaded
    if _global_transcription_service.model is None:
        raise RuntimeError("❌ Whisper model not loaded. Service initialization may have failed.")
    
    return _global_transcription_service


def is_transcription_service_ready() -> bool:
    """Check if the transcription service is ready for use."""
    global _global_transcription_service
    return (
        _global_transcription_service is not None and 
        _global_transcription_service.model is not None
    )


def initialize_transcription_service() -> None:
    """Initialize the global transcription service and pre-load the model."""
    global _global_transcription_service
    if _global_transcription_service is None:
        print("🤖 Initializing Whisper transcription service...")
        
        _global_transcription_service = TranscriptionService()
        
        # Check if model cache exists before loading
        import os
        import whisper
        
        model_size = _global_transcription_service.model_size
        cache_dir = os.path.expanduser("~/.cache/whisper")
        model_file = f"{model_size}.pt"
        model_path = os.path.join(cache_dir, model_file)
        
        if os.path.exists(model_path):
            print(f"📁 Found cached Whisper model '{model_size}' - loading from cache...")
        else:
            print(f"📦 Whisper model '{model_size}' not cached - downloading...")
            print("⏳ Please wait - this may take several minutes on first download...")
        
        # Block here until model is fully loaded
        print(f"🔄 Loading Whisper model '{model_size}'...")
        _global_transcription_service.load_model()  # This will block until download completes
        
        print(f"✅ Whisper model '{model_size}' loaded successfully!")
        print("🚀 Transcription service ready - API can now accept requests.")
    else:
        print("ℹ️  Transcription service already initialized.")


def get_model_download_progress() -> Optional[Dict[str, Any]]:
    """
    Try to extract download progress from recent Docker logs.
    Returns dict with progress info or None if not downloading.
    """
    try:
        # Get recent logs from the backend container with proper encoding handling
        result = subprocess.run([
            "docker", "logs", "--tail", "50", "--timestamps", 
            "audio-transcription-backend-1"
        ], capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=5)
        
        if result.returncode != 0:
            return None
        
        # Safely handle potential None values
        stdout = result.stdout or ""
        stderr = result.stderr or ""
        logs = stdout + stderr
        
        # Look for download progress patterns with more flexible regex
        # Example: "30%|█████████▍                          | 879M/2.88G [14:52<1:07:17, 537kiB/s]"
        progress_patterns = [
            # Full pattern with speed
            r'(\d+)%\|[^|]*\|\s*([0-9.]+)([KMGT]?)B?/([0-9.]+)([KMGT]?)B?\s*\[[^<]*<[^,]*,\s*([0-9.]+)([KMGT]?)iB/s\]',
            # Simpler pattern without speed
            r'(\d+)%\|[^|]*\|\s*([0-9.]+)([KMGT]?)B?/([0-9.]+)([KMGT]?)B?',
            # Very basic pattern
            r'(\d+)%.*?([0-9.]+)([KMGT]).*?/.*?([0-9.]+)([KMGT])B?'
        ]
        
        lines = logs.split('\n')
        latest_progress = None
        
        for line in reversed(lines):  # Start from most recent
            # Skip empty lines and clean up encoding issues
            line = line.strip()
            if not line or len(line) < 10:
                continue
                
            for pattern in progress_patterns:
                match = re.search(pattern, line)
                if match:
                    try:
                        groups = match.groups()
                        percent = int(groups[0])
                        downloaded_val = float(groups[1])
                        downloaded_unit = groups[2] if len(groups) > 2 and groups[2] else 'M'
                        total_val = float(groups[3])
                        total_unit = groups[4] if len(groups) > 4 and groups[4] else 'G'
                        
                        # Speed might not be available in all patterns
                        speed_val = None
                        speed_unit = None
                        if len(groups) >= 7 and groups[5]:
                            try:
                                speed_val = float(groups[5])
                                speed_unit = groups[6] or 'K'
                            except:
                                pass
                        
                        # Convert to MB for consistency
                        def to_mb(val, unit):
                            multipliers = {'': 1, 'K': 0.001, 'M': 1, 'G': 1000, 'T': 1000000}
                            return val * multipliers.get(unit.upper(), 1)
                        
                        downloaded_mb = to_mb(downloaded_val, downloaded_unit)
                        total_mb = to_mb(total_val, total_unit)
                        
                        result_data = {
                            'progress': percent,
                            'downloaded': f"{downloaded_mb:.0f}MB" if downloaded_mb < 1000 else f"{downloaded_mb/1000:.1f}GB",
                            'total': f"{total_mb:.0f}MB" if total_mb < 1000 else f"{total_mb/1000:.1f}GB"
                        }
                        
                        if speed_val:
                            speed_mb = to_mb(speed_val, speed_unit)
                            result_data['speed'] = f"{speed_mb:.1f}MB/s" if speed_mb >= 1 else f"{speed_mb*1000:.0f}KB/s"
                        else:
                            result_data['speed'] = "Calculating..."
                        
                        latest_progress = result_data
                        break  # Found a match, use this one
                    except (ValueError, IndexError):
                        continue  # Try next pattern
            
            if latest_progress:
                break  # Found progress info, stop looking
        
        # Also check for model loading without progress
        if not latest_progress:
            loading_patterns = [
                r'Loading Whisper model',
                r'Downloading.*whisper',
                r'Whisper model.*downloading',
                r'model.*loading'
            ]
            
            for line in reversed(lines[-20:]):  # Check last 20 lines
                for pattern in loading_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        return {
                            'progress': 0,
                            'downloaded': '0MB',
                            'total': 'Unknown',
                            'speed': 'Initializing...',
                            'status': 'initializing'
                        }
        
        return latest_progress
        
    except Exception as e:
        # Don't log errors here as this runs frequently
        return None


def cleanup_transcription_service() -> None:
    """Clean up the global transcription service."""
    global _global_transcription_service
    _global_transcription_service = None
    print("Transcription service cleaned up.")