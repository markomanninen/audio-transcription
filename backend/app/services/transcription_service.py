"""
Transcription service using Whisper.
"""
import whisper
import time
import os
import psutil
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import SessionLocal
from ..models.audio_file import AudioFile, TranscriptionStatus
from ..models.segment import Segment
from .audio_service import AudioService

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Service for transcribing audio files using Whisper."""

    def __init__(self):
        self.model_size = settings.WHISPER_MODEL_SIZE
        self.device = self._detect_optimal_device(settings.WHISPER_DEVICE)
        self.model = None

    def _detect_optimal_device(self, device_setting: str) -> str:
        """Detect the optimal device for Whisper based on platform and availability."""
        if device_setting == "auto":
            import torch
            if torch.cuda.is_available():
                return "cuda"
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return "mps"  # Apple Silicon GPU acceleration
            else:
                return "cpu"
        return device_setting

    def load_model(self):
        """Load Whisper model (lazy loading)."""
        if self.model is None:
            self.model = whisper.load_model(
                self.model_size,
                device=self.device
            )

    def _update_progress_with_stage(self, audio_file: AudioFile, stage: str, progress: float, db: Session, elapsed_time: float = None):
        """Update progress with stage information and timing."""
        audio_file.transcription_progress = progress
        
        # Add timing info to stage only if it doesn't already contain timing
        if elapsed_time is not None and not ('(' in stage and 's)' in stage):
            stage_with_time = f"{stage} ({elapsed_time:.1f}s elapsed)"
        else:
            stage_with_time = stage
            
        audio_file.error_message = f"Stage: {stage_with_time}"  # Temporarily use error_message for stage info
        db.commit()
        print(f"Transcription progress: {progress:.1%} - {stage_with_time}")

    def _get_process_info(self) -> Dict[str, Any]:
        """Get current process information for progress monitoring."""
        try:
            process = psutil.Process()
            return {
                "cpu_percent": process.cpu_percent(),
                "memory_mb": process.memory_info().rss / 1024 / 1024,
                "threads": process.num_threads()
            }
        except:
            return {"cpu_percent": 0, "memory_mb": 0, "threads": 0}

    def can_resume_transcription(self, audio_file_id: int, db: Session) -> bool:
        """Check if transcription can be resumed from existing segments."""
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            return False
            
        # Check if we have existing segments
        segment_count = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).count()
        return segment_count > 0

    def save_transcription_checkpoint(self, audio_file: AudioFile, stage: str, 
                                    segment_index: int = 0, metadata: Dict = None, db: Session = None):
        """Save comprehensive transcription state for resume functionality."""
        import json
        from datetime import datetime
        
        checkpoint_data = {
            "stage": stage,
            "segment_index": segment_index,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        
        # Update audio file state
        audio_file.transcription_stage = stage
        audio_file.last_processed_segment = segment_index
        audio_file.processing_checkpoint = json.dumps(checkpoint_data)
        
        # Generate resume token if not exists
        if not audio_file.resume_token:
            import uuid
            audio_file.resume_token = str(uuid.uuid4())
        
        if db:
            db.commit()
    
    def load_transcription_checkpoint(self, audio_file: AudioFile) -> Dict[str, Any]:
        """Load transcription checkpoint for resume."""
        import json
        
        if not audio_file.processing_checkpoint:
            return {
                "stage": "pending",
                "segment_index": 0,
                "metadata": {}
            }
        
        try:
            checkpoint = json.loads(audio_file.processing_checkpoint)
            return checkpoint
        except (json.JSONDecodeError, TypeError):
            return {
                "stage": "pending", 
                "segment_index": 0,
                "metadata": {}
            }
    
    def mark_audio_transformed(self, audio_file: AudioFile, transformation_path: str, db: Session):
        """Mark audio as transformed and save the path."""
        audio_file.audio_transformed = True
        audio_file.audio_transformation_path = transformation_path
        self.save_transcription_checkpoint(audio_file, "audio_transformed", 0, 
                                         {"transformation_path": transformation_path}, db)
    
    def increment_interruption_count(self, audio_file: AudioFile, db: Session):
        """Track transcription interruptions."""
        from datetime import datetime
        audio_file.interruption_count += 1
        audio_file.last_error_at = datetime.utcnow()
        db.commit()
    
    def increment_recovery_attempts(self, audio_file: AudioFile, db: Session):
        """Track recovery attempts."""
        audio_file.recovery_attempts += 1
        db.commit()

    def get_transcription_status(self, audio_file_id: int, db: Session) -> Dict[str, Any]:
        """Get detailed transcription status for restart/resume decisions."""
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            return {"error": "File not found"}
        
        segment_count = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).count()
        checkpoint = self.load_transcription_checkpoint(audio_file)
        
        return {
            "file_id": audio_file_id,
            "filename": audio_file.filename,
            "status": audio_file.transcription_status.value,
            "progress": audio_file.transcription_progress,
            "segments_created": segment_count,
            "can_resume": self._can_resume_transcription(audio_file, segment_count),
            "is_stuck": self._is_transcription_stuck(audio_file),
            "error_message": audio_file.error_message,
            "started_at": audio_file.transcription_started_at.isoformat() if audio_file.transcription_started_at else None,
            "duration": audio_file.duration,
            # Enhanced state information
            "transcription_stage": audio_file.transcription_stage,
            "last_processed_segment": audio_file.last_processed_segment,
            "audio_transformed": bool(audio_file.audio_transformed),
            "audio_transformation_path": audio_file.audio_transformation_path,
            "whisper_model_loaded": audio_file.whisper_model_loaded,
            "resume_token": audio_file.resume_token,
            "interruption_count": audio_file.interruption_count,
            "recovery_attempts": audio_file.recovery_attempts,
            "last_error_at": audio_file.last_error_at.isoformat() if audio_file.last_error_at else None,
            "checkpoint": checkpoint,
            "transcription_metadata": audio_file.transcription_metadata
        }

    def _is_transcription_stuck(self, audio_file: AudioFile) -> bool:
        """Detect if transcription is stuck and needs restart."""
        if audio_file.transcription_status != TranscriptionStatus.PROCESSING:
            return False
        
        # If started more than 10 minutes ago and still processing, likely stuck
        if audio_file.transcription_started_at:
            from datetime import datetime, timedelta
            elapsed = datetime.utcnow() - audio_file.transcription_started_at
            if elapsed > timedelta(minutes=10) and audio_file.transcription_progress < 0.9:
                return True
        
        return False

    def _can_resume_transcription(self, audio_file: AudioFile, segment_count: int) -> bool:
        """Determine if transcription can be resumed based on progress made."""
        # If segments exist, can always resume
        if segment_count > 0:
            return True
        
        # If audio has been transformed and model was loaded, can resume from checkpoint
        if audio_file.audio_transformed and audio_file.whisper_model_loaded:
            return True
        
        # If we have a resume token and transcription was started, can attempt resume
        if audio_file.resume_token and audio_file.transcription_started_at:
            return True
        
        return False

    def force_restart_transcription(
        self, 
        audio_file_id: int, 
        db: Session, 
        model_size: str = "large",
        language: str | None = None,
        include_diarization: bool = True
    ) -> Dict[str, Any]:
        """Force restart a stuck transcription by cleaning up and resetting with new settings."""
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            return {"error": "File not found"}
        
        # Count existing segments before cleanup
        existing_segments = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).count()
        
        # Delete existing segments
        if existing_segments > 0:
            db.query(Segment).filter(Segment.audio_file_id == audio_file_id).delete()
        
        # Reset transcription status and update settings
        audio_file.transcription_status = TranscriptionStatus.PENDING
        audio_file.transcription_progress = 0.0
        audio_file.error_message = None
        audio_file.transcription_started_at = None
        audio_file.transcription_completed_at = None
        audio_file.transcription_duration_seconds = None
        audio_file.processing_stats = None
        
        # Update transcription settings
        audio_file.language = language  # None for auto-detect, or ISO 639-1 code
        audio_file.model_used = None  # Will be set when transcription starts
        
        # Store transcription metadata including diarization setting
        import json
        metadata = {
            "model_size": model_size,
            "include_diarization": include_diarization,
            "restart_timestamp": datetime.utcnow().isoformat()
        }
        audio_file.transcription_metadata = json.dumps(metadata)
        
        db.commit()
        
        return {
            "action": "force_restart",
            "file_id": audio_file_id,
            "deleted_segments": existing_segments,
            "new_status": "PENDING",
            "settings": {
                "model_size": model_size,
                "language": language,
                "include_diarization": include_diarization
            },
            "message": f"Force restarted transcription for {audio_file.filename} with new settings"
        }

    def smart_transcription_action(self, audio_file_id: int, db: Session, action: str = "auto") -> Dict[str, Any]:
        """
        Intelligent transcription action that decides whether to resume, restart, or continue.
        
        Args:
            audio_file_id: ID of audio file
            db: Database session
            action: "auto", "resume", "restart", "continue"
        
        Returns:
            Action result with details
        """
        logger.info(f"🎯 Starting smart transcription action '{action}' for file {audio_file_id}")
        
        status = self.get_transcription_status(audio_file_id, db)
        
        if "error" in status:
            logger.error(f"❌ Error getting status for file {audio_file_id}: {status['error']}")
            return status
        
        logger.info(f"📊 Current status: {status['status']}, progress: {status['progress']*100:.1f}%, segments: {status['segments_created']}")

        # Auto-decide action based on current state
        if action == "auto":
            if status["status"] == "COMPLETED":
                logger.info(f"✅ File {audio_file_id} already completed with {status['segments_created']} segments")
                return {
                    "action": "already_complete",
                    "message": f"Transcription already completed with {status['segments_created']} segments",
                    "segments": status["segments_created"]
                }
            elif status["can_resume"] and not status["is_stuck"]:
                action = "resume"
                logger.info(f"🔄 Auto-deciding to RESUME transcription (found {status['segments_created']} existing segments)")
            elif status["is_stuck"] or status["status"] == "FAILED":
                action = "restart"
                logger.info(f"🔄 Auto-deciding to RESTART transcription (stuck or failed)")
            else:
                action = "continue"
                logger.info(f"▶️ Auto-deciding to CONTINUE transcription")
        
        # Execute the determined action
        if action == "resume":
            if status["can_resume"]:
                logger.info(f"🚀 RESUMING transcription for file {audio_file_id}")
                segments = self.resume_or_transcribe_audio(audio_file_id, db, force_restart=False)
                logger.info(f"✅ Resume completed with {len(segments)} total segments")
                return {
                    "action": "resumed",
                    "message": f"Resumed existing transcription with {len(segments)} segments",
                    "segments": len(segments)
                }
            else:
                # No segments to resume, start fresh
                logger.info(f"📝 No segments to resume, starting fresh transcription for file {audio_file_id}")
                segments = self.resume_or_transcribe_audio(audio_file_id, db, force_restart=False)
                logger.info(f"✅ Fresh transcription completed with {len(segments)} segments")
                return {
                    "action": "started_fresh",
                    "message": f"No segments to resume, started fresh transcription",
                    "segments": len(segments)
                }
        
        elif action == "restart":
            logger.info(f"🔄 FORCE RESTARTING transcription for file {audio_file_id}")
            restart_result = self.force_restart_transcription(audio_file_id, db)
            if "error" not in restart_result:
                logger.info(f"🗑️ Deleted {restart_result['deleted_segments']} existing segments")
                logger.info(f"▶️ Starting fresh transcription...")
                segments = self.resume_or_transcribe_audio(audio_file_id, db, force_restart=False)
                logger.info(f"✅ Restart completed with {len(segments)} new segments")
                return {
                    "action": "restarted",
                    "message": f"Force restarted and completed transcription with {len(segments)} segments",
                    "deleted_segments": restart_result["deleted_segments"],
                    "new_segments": len(segments)
                }
            logger.error(f"❌ Restart failed: {restart_result}")
            return restart_result
        
        elif action == "continue":
            logger.info(f"▶️ CONTINUING transcription for file {audio_file_id}")
            segments = self.resume_or_transcribe_audio(audio_file_id, db, force_restart=False)
            logger.info(f"✅ Continue completed with {len(segments)} total segments")
            return {
                "action": "continued",
                "message": f"Continued transcription, created {len(segments)} segments",
                "segments": len(segments)
            }
        
        else:
            logger.error(f"❌ Unknown action: {action}")
            return {"error": f"Unknown action: {action}"}

    def resume_or_transcribe_audio(
        self,
        audio_file_id: int,
        db: Session,
        force_restart: bool = False
    ) -> List[Segment]:
        """
        Resume existing transcription or start new one. NO MORE WASTED PROCESSING!

        Args:
            audio_file_id: ID of audio file to transcribe
            db: Database session
            force_restart: If True, delete existing segments and restart

        Returns:
            List of created Segment objects
        """
        # Get audio file record
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {audio_file_id} not found")

        # Check for existing segments
        existing_segments = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).all()
        
        if existing_segments and not force_restart:
            print(f"🚀 RESUMING: Found {len(existing_segments)} existing segments - no re-processing needed!")
            audio_file.transcription_status = TranscriptionStatus.COMPLETED
            audio_file.transcription_progress = 1.0
            audio_file.error_message = None
            db.commit()
            return existing_segments
        elif existing_segments and force_restart:
            print(f"🔄 RESTARTING: Will safely replace {len(existing_segments)} existing segments after new transcription succeeds")
            # Don't delete segments here - let transcribe_audio_simple handle safe replacement
            # db.delete calls removed for safety

        # Start fresh transcription (existing segments preserved until success)
        return self.transcribe_audio_simple(audio_file_id, db)

    def transcribe_audio_simple(
        self,
        audio_file_id: int,
        db: Session
    ) -> List[Segment]:
        """
        Transcribe audio file WITHOUT threading deadlocks. Simple and reliable.

        Args:
            audio_file_id: ID of audio file to transcribe
            db: Database session

        Returns:
            List of created Segment objects

        Raises:
            ValueError: If audio file not found or already transcribed
        """
        # Get audio file record
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {audio_file_id} not found")

        try:
            # Read file-specific settings from metadata
            file_model_size = self.model_size  # Default to global setting
            file_language = audio_file.language
            include_diarization = True  # Default
            
            if audio_file.transcription_metadata:
                try:
                    import json
                    metadata = json.loads(audio_file.transcription_metadata)
                    file_model_size = metadata.get("model_size", self.model_size)
                    include_diarization = metadata.get("include_diarization", True)
                    logger.info(f"Using file-specific settings: model_size={file_model_size}, language={file_language}, diarization={include_diarization}")
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f"Failed to parse transcription metadata, using defaults: {e}")
            
            # Set initial status
            start_time = time.time()
            audio_file.transcription_status = TranscriptionStatus.PROCESSING
            audio_file.model_used = file_model_size  # Use file-specific model size
            audio_file.transcription_started_at = datetime.utcnow()
            
            # Save initial checkpoint
            self.save_transcription_checkpoint(audio_file, "initializing", 0, 
                                             {}, db)
            
            self._update_progress_with_stage(audio_file, "Starting transcription", 0.0, db, 0)

            # Convert to WAV if needed
            audio_service = AudioService()
            elapsed = time.time() - start_time
            
            # Save audio conversion checkpoint
            self.save_transcription_checkpoint(audio_file, "converting_audio", 0, 
                                             {"original_path": audio_file.file_path}, db)
            
            self._update_progress_with_stage(audio_file, "Converting audio format", 0.05, db, elapsed)
            wav_path = audio_service.convert_to_wav(audio_file.file_path)
            
            # Mark audio as transformed
            self.mark_audio_transformed(audio_file, wav_path, db)

            # Get file info for progress estimation
            file_size_mb = os.path.getsize(wav_path) / 1024 / 1024
            estimated_duration = audio_file.duration or 60  # Default to 60 seconds if unknown
            
            # Load model
            elapsed = time.time() - start_time
            
            # Save model loading checkpoint
            self.save_transcription_checkpoint(audio_file, "loading_model", 0, 
                                             {}, db)
            
            self._update_progress_with_stage(audio_file, "Loading Whisper model", 0.10, db, elapsed)
            
            # Load model with file-specific size if needed
            if self.model is None or self.model_size != file_model_size:
                logger.info(f"Loading Whisper model: {file_model_size}")
                self.model = whisper.load_model(file_model_size, device=self.device)
                self.model_size = file_model_size  # Update current model size
            
            # Mark model as loaded
            audio_file.whisper_model_loaded = file_model_size

            # Transcribe with word-level timestamps with progress monitoring
            elapsed = time.time() - start_time
            self._update_progress_with_stage(audio_file, "Running Whisper transcription - this may take several minutes", 0.15, db, elapsed)
            
            # Use specified language or auto-detect (None)
            language = audio_file.language if audio_file.language else None
            
            print(f"Starting Whisper transcription with {self.model_size} model...")
            
            # Start a progress monitor thread that updates during transcription
            import threading
            progress_active = threading.Event()
            progress_active.set()
            
            def monitor_progress():
                """Monitor progress during transcription."""
                monitor_start = time.time()
                while progress_active.is_set():
                    try:
                        elapsed_monitor = time.time() - start_time
                        # Estimate progress based on time (rough estimation)
                        # For 30-second file with tiny model, expect ~30-60 seconds processing
                        estimated_total_time = max(estimated_duration * 2, 30)  # At least 30 seconds
                        time_progress = min(elapsed_monitor / estimated_total_time, 0.95)
                        
                        # Progressive stages during transcription
                        if time_progress < 0.3:
                            progress = 0.15 + (time_progress * 0.3)  # 15% to 45%
                            stage = f"Transcribing audio - early stage ({elapsed_monitor:.0f}s)"
                        elif time_progress < 0.7:
                            progress = 0.45 + ((time_progress - 0.3) * 0.25)  # 45% to 70%
                            stage = f"Transcribing audio - processing speech ({elapsed_monitor:.0f}s)"
                        else:
                            progress = 0.70 + ((time_progress - 0.7) * 0.15)  # 70% to 85%
                            stage = f"Transcribing audio - finalizing ({elapsed_monitor:.0f}s)"
                        
                        # Update database in a separate session
                        monitor_db = SessionLocal()
                        try:
                            fresh_file = monitor_db.query(AudioFile).filter(AudioFile.id == audio_file.id).first()
                            if fresh_file:
                                self._update_progress_with_stage(fresh_file, stage, progress, monitor_db, elapsed_monitor)
                        finally:
                            monitor_db.close()
                            
                        time.sleep(3)  # Update every 3 seconds
                    except Exception as e:
                        print(f"Progress monitor error: {e}")
                        break
            
            # Start progress monitor
            progress_thread = threading.Thread(target=monitor_progress, daemon=True)
            progress_thread.start()
            
            try:
                result = self.model.transcribe(
                    wav_path,
                    word_timestamps=True,
                    language=language,  # Auto-detect if None, or use specified language code
                    task="transcribe",
                    verbose=False  # Reduce console output
                )
            finally:
                # Stop progress monitor
                progress_active.clear()
                progress_thread.join(timeout=2)
            
            print(f"Whisper transcription completed! Found {len(result['segments'])} segments.")

            # Update progress for segment creation
            elapsed = time.time() - start_time
            self._update_progress_with_stage(audio_file, "Creating text segments", 0.85, db, elapsed)
            print(f"Whisper transcription completed, creating {len(result['segments'])} segments...")

            # Create segments from transcription (SAFE REPLACEMENT STRATEGY)
            # First, get existing segments to preserve them in case of failure
            existing_segments = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).all()
            logger.info(f"Found {len(existing_segments)} existing segments to preserve during transcription")
            
            new_segments = []
            total_segments = len(result["segments"])
            batch_size = 100  # Process segments in batches for better performance
            
            try:
                # Create new segments first (don't delete old ones yet)
                for i, segment_data in enumerate(result["segments"]):
                    segment = Segment(
                        audio_file_id=audio_file_id,
                        start_time=segment_data["start"],
                        end_time=segment_data["end"],
                        original_text=segment_data["text"].strip(),
                        sequence=i
                    )
                    db.add(segment)
                    new_segments.append(segment)
                    
                    # Commit new segments in batches
                    if (i + 1) % batch_size == 0 or (i + 1) == total_segments:
                        db.commit()
                        
                        # Update progress during segment creation
                        elapsed = time.time() - start_time
                        segment_progress = 0.85 + (0.10 * (i + 1) / total_segments)
                        self._update_progress_with_stage(audio_file, f"Created {i+1}/{total_segments} segments", segment_progress, db, elapsed)

                # All new segments created successfully, now safely replace old ones
                if existing_segments:
                    logger.info(f"Transcription successful! Safely removing {len(existing_segments)} old segments")
                    for old_segment in existing_segments:
                        db.delete(old_segment)
                    db.commit()
                    logger.info("Old segments safely removed after successful transcription")
                
                segments = new_segments  # Use the new segments
                
            except Exception as e:
                # If segment creation failed, clean up any partial new segments
                logger.error(f"Segment creation failed: {e}")
                if new_segments:
                    logger.info(f"Cleaning up {len(new_segments)} partial new segments")
                    for segment in new_segments:
                        if segment in db:
                            db.delete(segment)
                    db.commit()
                # Existing segments are preserved since we didn't delete them
                raise

            # Calculate final timing and performance stats
            end_time = time.time()
            total_duration = end_time - start_time
            
            # Create performance stats
            process_info = self._get_process_info()
            performance_stats = {
                "total_duration_seconds": total_duration,
                "audio_duration_seconds": estimated_duration,
                "processing_speed_ratio": total_duration / max(estimated_duration, 1),
                "segments_created": total_segments,
                "model_used": self.model_size,
                "device": self.device,
                "file_size_mb": file_size_mb,
                "final_memory_mb": process_info.get("memory_mb", 0),
                "completed_at": datetime.utcnow().isoformat()
            }
            
            # Update status to completed with audit data
            audio_file.transcription_status = TranscriptionStatus.COMPLETED
            audio_file.transcription_progress = 1.0
            audio_file.transcription_completed_at = datetime.utcnow()
            audio_file.transcription_duration_seconds = total_duration
            audio_file.processing_stats = json.dumps(performance_stats)
            audio_file.error_message = None  # Clear stage info
            db.commit()

            print(f"Transcription completed: {total_segments} segments in {total_duration:.1f}s (speed: {total_duration/estimated_duration:.2f}x)")
            return segments

        except Exception as e:
            # Update status to failed
            audio_file.transcription_status = TranscriptionStatus.FAILED
            audio_file.error_message = str(e)
            db.commit()
            raise

    def transcribe_audio(
        self,
        audio_file_id: int,
        db: Session
    ) -> List[Segment]:
        """
        Legacy transcribe_audio method that calls the new resume_or_transcribe_audio.
        This maintains backward compatibility while adding smart resume functionality.
        """
        return self.resume_or_transcribe_audio(audio_file_id, db, force_restart=False)

    def get_transcription_info(self, audio_file_id: int, db: Session) -> Dict[str, Any]:
        """
        Get transcription status and info.

        Args:
            audio_file_id: ID of audio file
            db: Database session

        Returns:
            Dictionary with transcription info
        """
        audio_file = db.query(AudioFile).filter(AudioFile.id == audio_file_id).first()
        if not audio_file:
            raise ValueError(f"Audio file {audio_file_id} not found")

        segment_count = db.query(Segment).filter(Segment.audio_file_id == audio_file_id).count()
        
        # Try to get real-time segment count from processing stage if transcription is active
        realtime_segment_count = None

        # Separate processing stage from actual error messages
        processing_stage = None
        error_message = audio_file.error_message
        
        if audio_file.transcription_status == TranscriptionStatus.PROCESSING and audio_file.error_message:
            if audio_file.error_message.startswith("Stage: "):
                stage_info = audio_file.error_message[7:]  # Remove "Stage: " prefix
                
                # Extract real-time segment count from stage info if available
                if "Creating segments:" in stage_info:
                    import re
                    match = re.search(r'Creating segments: (\d+(?:,\d+)*) created', stage_info)
                    if match:
                        # Remove commas and convert to int
                        realtime_segment_count = int(match.group(1).replace(',', ''))
                
                # Enhanced processing stage with intelligent progress
                if "Finalizing" in stage_info or "Creating" in stage_info:
                    # Use real-time count if available, otherwise fall back to database count
                    current_segment_count = realtime_segment_count or segment_count
                    # Estimate progress based on segments created vs audio duration
                    if audio_file.duration and current_segment_count > 0:
                        # Rough estimate: 1 segment per 3 seconds of audio
                        estimated_total_segments = max(int(audio_file.duration / 3), 1)
                        segment_progress = min((current_segment_count / estimated_total_segments) * 100, 99)
                        
                        processing_stage = f"Creating segments: {current_segment_count:,} created (~{segment_progress:.0f}% of text processing)"
                    else:
                        processing_stage = f"Creating segments: {current_segment_count:,} created"
                else:
                    processing_stage = stage_info
                    
                error_message = None
        
        return {
            "file_id": audio_file.id,
            "filename": audio_file.original_filename,
            "status": audio_file.transcription_status.value,
            "progress": audio_file.transcription_progress,
            "error_message": error_message,
            "processing_stage": processing_stage,
            "segment_count": segment_count,
            "duration": audio_file.duration,
            "transcription_started_at": audio_file.transcription_started_at.isoformat() if audio_file.transcription_started_at else None,
            "transcription_completed_at": audio_file.transcription_completed_at.isoformat() if audio_file.transcription_completed_at else None,
            "created_at": audio_file.created_at.isoformat() if audio_file.created_at else None,
            "updated_at": audio_file.updated_at.isoformat() if audio_file.updated_at else None,
            "transcription_metadata": audio_file.transcription_metadata
        }