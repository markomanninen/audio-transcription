# Frontend Panel Identification Issues - Comprehensive Analysis

## Problem Summary

The transcription progress panels are displaying incorrect data for both files, indicating a fundamental issue with file identification and data binding between the frontend and backend. This affects multiple UI components and panels throughout the application, not just the main transcription progress display.

## Affected UI Components and Panels

### 1. **Splash Screen / Initial Loading States**
- **Component**: Initial application loading overlay
- **Issues**: May show cached/incorrect model information on startup
- **Data Dependencies**: Global health status, Whisper model state
- **File Relationship**: Global state affects all files

### 2. **Progress Bars and Loading Indicators**
- **Component**: Various progress indicators throughout the app
- **Issues**: 
  - Model download progress bars showing wrong percentages
  - Transcription progress not matching actual file progress
  - Loading spinners appearing for wrong files
- **Data Dependencies**: Real-time progress updates, model loading status
- **File Relationship**: Should be file-specific but may be sharing state

### 3. **File List Component**
- **Component**: Left sidebar file listing with file cards
- **Issues**:
  - File status badges showing incorrect states
  - Multiple files showing same status (e.g., both "COMPLETED")
  - File metadata (size, duration, format) may be mixed up
  - Thumbnail/preview states incorrect
- **Data Dependencies**: File metadata, transcription status per file
- **File Relationship**: Each file card should have unique state

### 4. **File Actions and Context Menus**
- **Component**: Action buttons on file cards (Start, Resume, Cancel, etc.)
- **Issues**:
  - Actions may target wrong file
  - Button states (enabled/disabled) incorrect for file status
  - Action confirmation modals showing wrong file information
- **Data Dependencies**: File-specific permissions, current transcription state
- **File Relationship**: Actions must be scoped to specific file

### 5. **Transcription Status Panel (Main Content Area)**
This has multiple sub-states that are all affected:

#### 5a. **Model Downloading Progress State**
- **Component**: Whisper model download progress display
- **Issues**:
  - Shows wrong model size (tiny vs medium)
  - Progress percentage incorrect (100% when still downloading)
  - Speed/ETA calculations wrong
- **Data Dependencies**: Model download progress, model size configuration
- **File Relationship**: Should reflect model for current file

#### 5b. **Transcription Progress State**
- **Component**: Active transcription progress display
- **Issues**:
  - Progress percentage doesn't match backend
  - Time estimates completely wrong
  - Stage information ("early stage") incorrect
- **Data Dependencies**: Real-time transcription progress, segment count
- **File Relationship**: Must be file-specific progress

#### 5c. **Completed/Error State Panel**
- **Component**: Final state display with results/errors
- **Issues**:
  - Shows wrong completion status
  - Error messages from different files
  - Success metrics (segments, duration) mixed up
- **Data Dependencies**: Final transcription results, error logs
- **File Relationship**: Results must match specific file

### 6. **Status Badges and Indicators**
- **Component**: Small status indicators throughout UI
- **Issues**:
  - "WHISPER MODEL LOADING" badge appears on wrong files
  - Status colors (green/red/yellow) don't match actual state
  - Badge text shows outdated information
- **Data Dependencies**: Current file status, global system status
- **File Relationship**: Badges should reflect individual file states

### 7. **Action Buttons and Modals**
- **Component**: Start, Cancel, Restart, Resume buttons and their confirmation dialogs
- **Issues**:
  - Buttons show wrong enabled/disabled state
  - Confirmation modals display wrong file names
  - Action results applied to wrong files
  - Modal content doesn't match selected file
- **Data Dependencies**: File status, available actions, user permissions
- **File Relationship**: All actions must be file-scoped

### 8. **Audio Playback Component**
- **Component**: Audio player with controls and timeline
- **Issues**:
  - May load wrong audio file
  - Playback position not synced with correct transcription
  - Audio controls affecting wrong file
  - Timeline markers for wrong segments
- **Data Dependencies**: Audio file URL, current playback position, segment timings
- **File Relationship**: Must be tightly coupled to selected file

### 9. **Speaker Identification Panel**
- **Component**: Speaker list and speaker assignment interface
- **Issues**:
  - Shows speakers from wrong file
  - Speaker count incorrect (showing 4 speakers when file has 1)
  - Speaker labels mixed between files
  - Color assignments inconsistent
- **Data Dependencies**: Speaker diarization results, speaker metadata
- **File Relationship**: Speakers must be file-specific

### 10. **Transcribed Segments List**
- **Component**: Scrollable list of transcription segments with timestamps
- **Issues**:
  - Displays segments from wrong file
  - Segment count doesn't match (shows 1096 vs actual)
  - Text content from different transcriptions
  - Timestamp synchronization with wrong audio
- **Data Dependencies**: Segment data, speaker assignments, text content
- **File Relationship**: All segments must belong to specific file

### 11. **Segment Editor Components**
- **Component**: Individual segment editing interface
- **Issues**:
  - Editing changes applied to wrong segments
  - Original vs edited text from different files
  - Save operations targeting wrong file
  - Undo/redo history mixed between files
- **Data Dependencies**: Segment content, edit history, file permissions
- **File Relationship**: Edits must be file-scoped

### 12. **Export and Download Modals**
- **Component**: Export format selection and download interfaces
- **Issues**:
  - Export may generate content from wrong file
  - Download filename doesn't match selected file
  - Export progress tracking wrong file
  - Format options may be file-specific but showing wrong data
- **Data Dependencies**: File content, export settings, download progress
- **File Relationship**: Export must be file-specific

### 13. **System Health Overlay**
- **Component**: Global system status indicator (top-right corner)
- **Issues**:
  - Shows outdated Whisper model information
  - Health status doesn't reflect current operations
  - May show conflicting information with file-specific states
- **Data Dependencies**: Global system health, service status
- **File Relationship**: Global but affects all file operations

### 14. **Navigation and Breadcrumbs**
- **Component**: Project/file navigation elements
- **Issues**:
  - Active file highlight may be wrong
  - Breadcrumb trail showing incorrect file path
  - Back/forward navigation may load wrong file state
- **Data Dependencies**: Current file selection, navigation history
- **File Relationship**: Must accurately reflect current file context

### 15. **Notification Toasts and Alerts**
- **Component**: Temporary notification messages
- **Issues**:
  - Success/error messages about wrong files
  - Progress notifications for incorrect operations
  - Toast messages appearing at wrong times
- **Data Dependencies**: Event triggers, operation results
- **File Relationship**: Notifications must be contextually accurate

## Data Flow and State Management Issues

### 1. **React Query Cache Contamination**
- **Problem**: Shared cache keys across file instances
- **Affected Components**: All components using `useTranscriptionStatus`, `useSegments`, `useSpeakers`
- **Manifestation**: File A's data appears in File B's components
- **Root Cause**: Cache keys not properly scoped to file IDs

### 2. **Global State Leakage**
- **Problem**: Singleton services (Whisper, Audio Player) affecting multiple file contexts
- **Affected Components**: Audio playback, model status displays, progress indicators
- **Manifestation**: Audio from File A plays when File B is selected
- **Root Cause**: Global state not properly isolated per file

### 3. **Component Re-render Cascades**
- **Problem**: File selection changes don't properly trigger re-renders
- **Affected Components**: All file-dependent components
- **Manifestation**: Stale data persists after file switches
- **Root Cause**: Missing dependencies in useEffect hooks

### 4. **Event Handler Mix-ups**
- **Problem**: Event handlers bound to wrong file contexts
- **Affected Components**: Action buttons, modals, audio controls
- **Manifestation**: Actions performed on wrong files
- **Root Cause**: Closure capture of outdated file IDs

### 5. **Polling and Real-time Update Conflicts**
- **Problem**: Multiple polling intervals interfering with each other
- **Affected Components**: Progress indicators, status displays
- **Manifestation**: Rapid state changes, incorrect progress updates
- **Root Cause**: Uncoordinated polling intervals for different files

## Component Hierarchy and Data Dependencies

```
App
├── ProjectSelector (global state)
├── FileList (per-project state)
│   ├── FileCard[] (per-file state)
│   │   ├── StatusBadge (file-specific)
│   │   ├── ActionButtons (file-specific)
│   │   └── ProgressIndicator (file-specific)
│   └── UploadArea (project-specific)
├── MainContent (selected file state)
│   ├── AudioPlayer (file-specific)
│   ├── TranscriptionStatusPanel (file-specific)
│   │   ├── ModelDownloadProgress (global + file-specific)
│   │   ├── TranscriptionProgress (file-specific)
│   │   └── CompletedState (file-specific)
│   ├── SpeakerPanel (file-specific)
│   │   ├── SpeakerList (file-specific)
│   │   └── SpeakerEditor (file-specific)
│   └── SegmentsList (file-specific)
│       ├── SegmentItem[] (segment-specific)
│       └── SegmentEditor (segment-specific)
├── SystemHealth (global state)
├── NotificationToasts (event-driven)
└── Modals (context-specific)
    ├── ConfirmationDialog (action-specific)
    ├── ExportDialog (file-specific)
    └── SettingsDialog (global)
```

## Critical State Isolation Requirements

### 1. **File-Scoped State**
Components that MUST be isolated per file:
- TranscriptionProgress
- AudioPlayer
- SegmentsList
- SpeakerPanel
- FileCard status
- Action button states

### 2. **Global State**
Components that should share global state:
- SystemHealth
- ModelDownload (when not file-specific)
- ProjectSelector
- NotificationToasts (but with file context)

### 3. **Hybrid State**
Components that need both global and file-specific state:
- ModelDownloadProgress (global download + file context)
- ActionButtons (global permissions + file status)
- StatusBadges (global health + file state)

## Backend Requirements for Reliable Data Provision

### 1. **Real-time Status API Architecture**

#### A. Non-blocking Status Endpoints
```python
# Proposed endpoint structure
@router.get("/{file_id}/status/realtime")
async def get_realtime_status(file_id: int):
    """Non-blocking status endpoint with microsecond precision"""
    return {
        "file_id": file_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "request_id": str(uuid.uuid4()),
        "status": {
            "state": "processing",  # pending, processing, completed, failed, paused
            "progress": 0.16045,    # Precise decimal progress
            "stage": "transcription_active",
            "substage": "audio_chunking",
            "estimated_completion": "2025-10-09T18:45:00Z"
        },
        "whisper_model": {
            "size": "medium",
            "status": "loaded",  # downloading, loading, loaded, failed
            "device": "cpu",
            "memory_usage_mb": 1340,
            "load_time": "2025-10-09T15:10:30Z"
        },
        "transcription": {
            "segments_processed": 156,
            "total_segments_estimated": 972,
            "current_segment_start": 513.2,
            "processing_speed_ratio": 2.1,  # 2.1x realtime
            "words_per_minute": 145
        },
        "performance": {
            "cpu_usage_percent": 85.4,
            "memory_usage_mb": 2048,
            "disk_io_mb_per_sec": 12.3,
            "queue_depth": 0
        },
        "recovery_info": {
            "checkpoint_id": "ckpt_2_156_segments",
            "last_checkpoint_time": "2025-10-09T15:15:45Z",
            "resumable": true,
            "recovery_data_size_mb": 15.2
        }
    }
```

#### B. Server-Sent Events for Real-time Updates
```python
@router.get("/{file_id}/events")
async def stream_status_events(file_id: int):
    """SSE endpoint for real-time status streaming"""
    async def event_generator():
        while True:
            status = await get_current_status(file_id)
            if status["state"] in ["completed", "failed"]:
                break
            yield f"data: {json.dumps(status)}\n\n"
            await asyncio.sleep(1)  # 1-second updates
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )
```

#### C. WebSocket Alternative for Bi-directional Communication
```python
@router.websocket("/{file_id}/ws")
async def websocket_status(websocket: WebSocket, file_id: int):
    """WebSocket for real-time bidirectional communication"""
    await websocket.accept()
    try:
        while True:
            # Send status updates
            status = await get_current_status(file_id)
            await websocket.send_json(status)
            
            # Listen for client commands (pause, resume, cancel)
            try:
                command = await asyncio.wait_for(
                    websocket.receive_json(), timeout=1.0
                )
                await handle_client_command(file_id, command)
            except asyncio.TimeoutError:
                pass  # No command received, continue
                
            if status["state"] in ["completed", "failed"]:
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for file {file_id}")
```

### 2. **Non-blocking Whisper Model Management**

#### A. Asynchronous Model Loading
```python
class AsyncWhisperService:
    def __init__(self):
        self.model_load_tasks = {}
        self.download_progress = {}
        
    async def load_model_async(self, model_size: str, file_id: int):
        """Non-blocking model loading with progress tracking"""
        task_id = f"load_{model_size}_{file_id}"
        
        if task_id in self.model_load_tasks:
            return await self.model_load_tasks[task_id]
            
        async def _load_with_progress():
            # Start download progress tracking
            self.download_progress[model_size] = {
                "status": "downloading",
                "progress": 0.0,
                "speed_mbps": 0.0,
                "eta_seconds": None
            }
            
            # Use thread pool for CPU-bound model loading
            loop = asyncio.get_event_loop()
            model = await loop.run_in_executor(
                None, self._load_model_sync, model_size
            )
            
            self.download_progress[model_size]["status"] = "loaded"
            return model
            
        self.model_load_tasks[task_id] = asyncio.create_task(_load_with_progress())
        return await self.model_load_tasks[task_id]
```

#### B. Progress Tracking with Callbacks
```python
def _load_model_sync(self, model_size: str):
    """Synchronous model loading with progress callbacks"""
    def progress_callback(downloaded: int, total: int):
        progress = downloaded / total
        speed = self._calculate_download_speed(downloaded)
        eta = (total - downloaded) / speed if speed > 0 else None
        
        self.download_progress[model_size].update({
            "progress": progress,
            "downloaded_mb": downloaded / (1024 * 1024),
            "total_mb": total / (1024 * 1024),
            "speed_mbps": speed / (1024 * 1024),
            "eta_seconds": eta
        })
    
    return whisper.load_model(
        model_size, 
        progress_callback=progress_callback
    )
```

### 3. **Robust Recovery System**

#### A. Checkpoint Management
```python
class TranscriptionCheckpointManager:
    def __init__(self):
        self.checkpoint_dir = Path("./data/checkpoints")
        self.checkpoint_dir.mkdir(exist_ok=True)
        
    async def save_checkpoint(self, file_id: int, checkpoint_data: dict):
        """Save transcription checkpoint for recovery"""
        checkpoint = {
            "file_id": file_id,
            "timestamp": datetime.utcnow().isoformat(),
            "checkpoint_id": f"ckpt_{file_id}_{len(checkpoint_data.get('segments', []))}",
            "progress": checkpoint_data.get("progress", 0.0),
            "processed_segments": checkpoint_data.get("segments", []),
            "current_audio_position": checkpoint_data.get("audio_position", 0.0),
            "model_state": checkpoint_data.get("model_state", {}),
            "speaker_map": checkpoint_data.get("speakers", {}),
            "processing_metadata": {
                "chunk_size": checkpoint_data.get("chunk_size", 30),
                "overlap": checkpoint_data.get("overlap", 5),
                "language": checkpoint_data.get("language"),
                "model_size": checkpoint_data.get("model_size")
            }
        }
        
        checkpoint_file = self.checkpoint_dir / f"file_{file_id}_latest.json"
        async with aiofiles.open(checkpoint_file, 'w') as f:
            await f.write(json.dumps(checkpoint, indent=2))
            
        # Keep last 5 checkpoints for each file
        await self._rotate_checkpoints(file_id)
        
    async def load_checkpoint(self, file_id: int) -> Optional[dict]:
        """Load latest checkpoint for file"""
        checkpoint_file = self.checkpoint_dir / f"file_{file_id}_latest.json"
        if not checkpoint_file.exists():
            return None
            
        async with aiofiles.open(checkpoint_file, 'r') as f:
            content = await f.read()
            return json.loads(content)
            
    async def can_resume(self, file_id: int) -> bool:
        """Check if transcription can be resumed"""
        checkpoint = await self.load_checkpoint(file_id)
        if not checkpoint:
            return False
            
        # Check if checkpoint is recent (within 24 hours)
        checkpoint_time = datetime.fromisoformat(checkpoint["timestamp"])
        age_hours = (datetime.utcnow() - checkpoint_time).total_seconds() / 3600
        
        return age_hours < 24 and checkpoint.get("progress", 0) > 0.1
```

#### B. Automatic Recovery on Startup
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan with automatic recovery"""
    # Startup: Check for interrupted transcriptions
    await recover_interrupted_transcriptions()
    yield
    # Shutdown: Save final checkpoints
    await save_all_active_checkpoints()

async def recover_interrupted_transcriptions():
    """Recover transcriptions interrupted by crashes/restarts"""
    from .core.database import SessionLocal
    from .models.audio_file import AudioFile, TranscriptionStatus
    
    db = SessionLocal()
    try:
        # Find files that were processing when server stopped
        interrupted_files = db.query(AudioFile).filter(
            AudioFile.transcription_status == TranscriptionStatus.PROCESSING
        ).all()
        
        checkpoint_manager = TranscriptionCheckpointManager()
        
        for file in interrupted_files:
            logger.info(f"🔄 Checking recovery options for file {file.id}")
            
            if await checkpoint_manager.can_resume(file.id):
                logger.info(f"✅ File {file.id} can be resumed from checkpoint")
                file.transcription_status = TranscriptionStatus.PENDING
                file.error_message = "Ready to resume from checkpoint"
                # Don't reset progress - keep it for resume
            else:
                logger.info(f"❌ File {file.id} checkpoint too old or missing - will restart")
                file.transcription_status = TranscriptionStatus.PENDING
                file.transcription_progress = 0.0
                file.error_message = "Transcription was interrupted - will restart"
                file.transcription_started_at = None
        
        db.commit()
        logger.info(f"🔄 Processed {len(interrupted_files)} interrupted transcription(s)")
        
    finally:
        db.close()
```

### 4. **Enhanced Command-line Monitoring Script**

#### A. Comprehensive Monitoring Features
```python
#!/usr/bin/env python3
"""
Advanced transcription monitoring script with problem detection.
"""

import asyncio
import aiohttp
import json
import time
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

class TranscriptionMonitor:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = None
        self.health_history = []
        self.status_history = {}
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout))
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def check_backend_health(self) -> Dict:
        """Comprehensive backend health check"""
        try:
            async with self.session.get(f"{self.base_url}/health") as resp:
                if resp.status == 200:
                    health = await resp.json()
                    self.health_history.append({
                        "timestamp": datetime.now(),
                        "status": "healthy",
                        "response_time_ms": resp.headers.get("X-Response-Time", "unknown"),
                        "whisper_status": health.get("components", {}).get("whisper", {}).get("status"),
                        "database_status": health.get("components", {}).get("database", {}).get("status")
                    })
                    return health
                else:
                    raise Exception(f"HTTP {resp.status}")
        except Exception as e:
            self.health_history.append({
                "timestamp": datetime.now(),
                "status": "unhealthy",
                "error": str(e)
            })
            return {"status": "unhealthy", "error": str(e)}
            
    async def get_file_status(self, file_id: int) -> Dict:
        """Get detailed file status with error detection"""
        try:
            async with self.session.get(f"{self.base_url}/api/transcription/{file_id}/status") as resp:
                if resp.status == 200:
                    status = await resp.json()
                    
                    # Store status history for trend analysis
                    if file_id not in self.status_history:
                        self.status_history[file_id] = []
                    
                    self.status_history[file_id].append({
                        "timestamp": datetime.now(),
                        "progress": status.get("progress", 0),
                        "status": status.get("status"),
                        "stage": status.get("processing_stage"),
                        "error": status.get("error_message")
                    })
                    
                    # Keep only last 50 entries
                    self.status_history[file_id] = self.status_history[file_id][-50:]
                    
                    return status
                else:
                    return {"error": f"HTTP {resp.status}", "status": "api_error"}
        except Exception as e:
            return {"error": str(e), "status": "connection_error"}
            
    def detect_problems(self, file_id: int) -> List[str]:
        """Detect potential problems with transcription"""
        problems = []
        
        if file_id not in self.status_history or len(self.status_history[file_id]) < 3:
            return problems
            
        recent_status = self.status_history[file_id][-10:]  # Last 10 status checks
        
        # Check for stuck progress
        progress_values = [s["progress"] for s in recent_status if s["progress"] is not None]
        if len(progress_values) >= 5 and all(p == progress_values[0] for p in progress_values):
            problems.append("⚠️  Progress appears stuck - no change in last 5 checks")
            
        # Check for error messages
        latest_status = recent_status[-1]
        if latest_status.get("error"):
            problems.append(f"❌ Error detected: {latest_status['error']}")
            
        # Check for processing time anomalies
        if len(recent_status) >= 3:
            time_diffs = []
            for i in range(1, len(recent_status)):
                diff = (recent_status[i]["timestamp"] - recent_status[i-1]["timestamp"]).total_seconds()
                time_diffs.append(diff)
            
            avg_interval = sum(time_diffs) / len(time_diffs)
            if avg_interval > 30:  # Should update more frequently
                problems.append("⏰ Status updates are slow - possible backend overload")
                
        # Check for backend health issues
        recent_health = self.health_history[-5:] if len(self.health_history) >= 5 else self.health_history
        unhealthy_count = sum(1 for h in recent_health if h["status"] == "unhealthy")
        if unhealthy_count > 2:
            problems.append("🏥 Backend health issues detected - multiple failed health checks")
            
        return problems
        
    async def monitor_file(self, file_id: int, interval: int = 5, max_duration_hours: int = 24):
        """Monitor file with problem detection and auto-recovery suggestions"""
        start_time = datetime.now()
        max_duration = timedelta(hours=max_duration_hours)
        
        print(f"🎬 Starting enhanced monitoring for file {file_id}")
        print(f"⏰ Maximum monitoring duration: {max_duration_hours} hours")
        print(f"🔄 Check interval: {interval} seconds")
        print("=" * 80)
        
        while datetime.now() - start_time < max_duration:
            # Check backend health
            health = await self.check_backend_health()
            
            # Get file status
            status = await self.get_file_status(file_id)
            
            # Detect problems
            problems = self.detect_problems(file_id)
            
            # Display status
            await self.display_status(file_id, status, health, problems)
            
            # Check if transcription is complete
            if status.get("status") in ["completed", "failed"]:
                print(f"\n✅ Transcription finished with status: {status.get('status')}")
                break
                
            # Auto-recovery suggestions
            if problems:
                await self.suggest_recovery_actions(file_id, problems, status)
                
            await asyncio.sleep(interval)
            
    async def display_status(self, file_id: int, status: Dict, health: Dict, problems: List[str]):
        """Display comprehensive status information"""
        now = datetime.now().strftime("%H:%M:%S")
        
        print(f"\n🎬 ENHANCED MONITOR | {now} | File {file_id}")
        print("=" * 80)
        
        # File status
        file_status = status.get("status", "unknown").upper()
        progress = status.get("progress", 0) * 100
        stage = status.get("processing_stage", "unknown")
        
        print(f"📊 Status: {file_status} | Progress: {progress:.1f}% | Stage: {stage}")
        
        # Model information
        whisper_info = health.get("components", {}).get("whisper", {})
        model_status = whisper_info.get("status", "unknown")
        model_size = whisper_info.get("model_size", "unknown")
        print(f"🤖 Model: {model_size} | Status: {model_status}")
        
        # Performance metrics
        if "performance" in status:
            perf = status["performance"]
            print(f"⚡ CPU: {perf.get('cpu_usage_percent', 0):.1f}% | Memory: {perf.get('memory_usage_mb', 0)}MB")
            
        # Recovery information
        if "recovery_info" in status:
            recovery = status["recovery_info"]
            resumable = "✅" if recovery.get("resumable") else "❌"
            print(f"💾 Checkpoint: {recovery.get('checkpoint_id', 'none')} | Resumable: {resumable}")
            
        # Problems
        if problems:
            print(f"\n⚠️  PROBLEMS DETECTED ({len(problems)}):")
            for problem in problems:
                print(f"   {problem}")
                
    async def suggest_recovery_actions(self, file_id: int, problems: List[str], status: Dict):
        """Suggest recovery actions based on detected problems"""
        print(f"\n🔧 SUGGESTED RECOVERY ACTIONS:")
        
        for problem in problems:
            if "stuck" in problem.lower():
                print("   • Try restarting the transcription")
                print(f"   • Command: curl -X POST {self.base_url}/api/transcription/{file_id}/action?action=restart")
                
            if "error" in problem.lower():
                print("   • Check backend logs for detailed error information")
                print("   • Command: docker logs transcribe-backend-1 --tail=50")
                
            if "slow" in problem.lower():
                print("   • Check system resources (CPU, memory, disk)")
                print("   • Command: docker stats transcribe-backend-1")
                
            if "health" in problem.lower():
                print("   • Restart backend service")
                print("   • Command: docker compose restart backend")

# CLI interface
async def main():
    parser = argparse.ArgumentParser(description="Enhanced transcription monitoring")
    parser.add_argument("--file-id", type=int, required=True)
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--interval", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--max-hours", type=int, default=24)
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    
    args = parser.parse_args()
    
    logging.basicConfig(level=getattr(logging, args.log_level))
    
    async with TranscriptionMonitor(args.url, args.timeout) as monitor:
        await monitor.monitor_file(
            args.file_id, 
            args.interval, 
            args.max_hours
        )

if __name__ == "__main__":
    asyncio.run(main())
```

#### B. Usage Examples
```bash
# Basic monitoring
python3 enhanced_monitor.py --file-id 2

# Intensive monitoring with problem detection
python3 enhanced_monitor.py --file-id 2 --interval 2 --max-hours 12 --log-level DEBUG

# Monitor with custom timeout for slow backends
python3 enhanced_monitor.py --file-id 2 --timeout 60 --url http://production-server:8000
```

These backend enhancements will provide:
- **Real-time, non-blocking status updates**
- **Robust checkpoint-based recovery system**
- **Comprehensive monitoring with problem detection**
- **Automatic recovery suggestions**
- **Performance metrics and health tracking**
- **WebSocket/SSE support for live updates**

## Current Observable Issues

### 1. File Identification Problems
- Both files display the same transcription status and progress
- Panel data does not correspond to the actual file being displayed
- File ID routing appears to be incorrect or cached
- Multiple files show identical Whisper model information

### 2. Data Inconsistency
- **File 1**: Shows "COMPLETED" but panel displays download progress
- **File 2**: Should show medium model loading, but displays tiny model info
- Progress percentages don't match backend reality
- Whisper model size information is incorrect (shows tiny instead of medium)

### 3. UI State Management Issues
- Panels swap between different states randomly
- Cache invalidation not working properly
- React Query cache appears to be shared between file instances
- Status polling may be using wrong file IDs

## Root Cause Analysis

### Frontend Architecture Issues

#### 1. Component State Management
```tsx
// Current problematic pattern in TranscriptionProgress.tsx
const { data: status, isLoading, refetch } = useTranscriptionStatus(fileId, 2000)
```

**Problems:**
- React Query cache keys may not properly differentiate between files
- `fileId` prop changes don't trigger proper cache invalidation
- Shared state between multiple component instances

#### 2. Cache Key Structure
```typescript
// Likely problematic cache key pattern
queryKey: ['enhanced-transcription-status', fileId]
```

**Issues:**
- Cache may be returning stale data for wrong file
- Invalidation doesn't properly scope to specific file
- Cross-contamination between file instances

#### 3. Component Rendering
- Multiple `TranscriptionProgress` components may be sharing state
- File ID prop changes not properly triggering re-renders
- Memoization issues preventing updates

### Backend Data Flow Issues

#### 1. API Endpoint Responses
- `/api/transcription/{file_id}/status` may be returning cached data
- Health endpoint showing outdated model information
- Database queries may be using wrong file IDs

#### 2. Model State Management
- Whisper service singleton showing outdated model size
- Multiple model switches not properly reflected in health status
- Progress updates may be applied to wrong file records

## Required Fix Strategy

### 1. Frontend Component Architecture

#### A. Unique Component Identification
Each transcription panel component should have:

```tsx
// Proposed component structure
interface TranscriptionProgressProps {
  fileId: number
  projectId: number  // Additional context
  uniqueKey: string  // Unique identifier for component instance
}

// Component with proper data attributes
<div 
  className="transcription-panel"
  data-file-id={fileId}
  data-component-key={`transcription-${fileId}-${uniqueKey}`}
  data-testid={`transcription-progress-${fileId}`}
>
```

#### B. CSS Class Structure
```scss
// Proposed CSS class hierarchy
.transcription-panel {
  &[data-file-id="1"] {
    // File 1 specific styles
  }
  
  &[data-file-id="2"] {
    // File 2 specific styles
  }
  
  .progress-indicator {
    &--loading { /* Loading state */ }
    &--processing { /* Processing state */ }
    &--completed { /* Completed state */ }
    &--failed { /* Failed state */ }
  }
  
  .model-info {
    &--tiny { /* Tiny model indicator */ }
    &--medium { /* Medium model indicator */ }
    &--large { /* Large model indicator */ }
  }
  
  .file-info {
    &__filename { /* File name display */ }
    &__size { /* File size display */ }
    &__duration { /* Duration display */ }
  }
}
```

### 2. React Query Cache Management

#### A. Proper Cache Key Structure
```typescript
// Proposed cache key improvements
const useTranscriptionStatus = (fileId: number, projectId: number) => {
  return useQuery({
    queryKey: ['transcription-status', projectId, fileId, 'v2'], // Version for cache busting
    queryFn: () => fetchTranscriptionStatus(fileId),
    staleTime: 1000, // Very short stale time for real-time updates
    cacheTime: 2000, // Short cache time to prevent stale data
  })
}
```

#### B. Cache Invalidation Strategy
```typescript
// Proper invalidation patterns
const invalidateFileCache = (fileId: number, projectId: number) => {
  queryClient.invalidateQueries({ 
    queryKey: ['transcription-status', projectId, fileId] 
  })
  queryClient.invalidateQueries({ 
    queryKey: ['segments', projectId, fileId] 
  })
  queryClient.invalidateQueries({ 
    queryKey: ['speakers', projectId, fileId] 
  })
}
```

### 3. Backend API Improvements

#### A. Response Structure Enhancement
```json
{
  "file_id": 2,
  "request_timestamp": "2025-10-09T15:12:00Z",
  "cache_key": "file-2-status-abc123",
  "status": "processing",
  "progress": 0.16,
  "model_info": {
    "model_size": "medium",
    "model_loaded": true,
    "device": "cpu"
  },
  "debug_info": {
    "query_execution_time": "0.002s",
    "database_hit": true,
    "whisper_service_status": "ready"
  }
}
```

#### B. Health Endpoint Improvement
```json
{
  "whisper": {
    "status": "up",
    "current_model": "medium",
    "loaded_at": "2025-10-09T15:10:00Z",
    "active_transcriptions": [
      {
        "file_id": 2,
        "model_size": "medium",
        "progress": 0.16
      }
    ]
  }
}
```

### 4. Component Lifecycle Management

#### A. Mount/Unmount Behavior
```tsx
useEffect(() => {
  // Clear cache on component mount to ensure fresh data
  queryClient.removeQueries({ 
    queryKey: ['transcription-status', projectId, fileId] 
  })
  
  return () => {
    // Cleanup on unmount
    queryClient.cancelQueries({ 
      queryKey: ['transcription-status', projectId, fileId] 
    })
  }
}, [fileId, projectId])
```

#### B. File ID Change Handling
```tsx
useEffect(() => {
  if (prevFileId && prevFileId !== fileId) {
    // Clear previous file's cache when switching files
    queryClient.removeQueries({ 
      queryKey: ['transcription-status', projectId, prevFileId] 
    })
  }
}, [fileId, prevFileId])
```

## Testing and Debugging Improvements

### 1. Component Testing Attributes
```tsx
// Each panel should have testable attributes
<div 
  data-testid={`transcription-panel-${fileId}`}
  data-file-id={fileId}
  data-status={status.status}
  data-progress={status.progress}
  data-model={status.model_size}
>
```

### 2. Debug Information Display
```tsx
// Development mode debug panel
{process.env.NODE_ENV === 'development' && (
  <div className="debug-info">
    <p>File ID: {fileId}</p>
    <p>Cache Key: {cacheKey}</p>
    <p>Last Updated: {status.updated_at}</p>
    <p>Component Instance: {uniqueKey}</p>
  </div>
)}
```

### 3. Console Logging Improvements
```typescript
// Structured logging for debugging
console.group(`TranscriptionProgress[${fileId}]`)
console.log('Props:', { fileId, projectId, uniqueKey })
console.log('Status:', status)
console.log('Cache State:', queryClient.getQueryState(['transcription-status', projectId, fileId]))
console.groupEnd()
```

## Implementation Priority

### Phase 1: Critical Fixes
1. Add unique data attributes to all panel components
2. Fix React Query cache key structure
3. Implement proper cache invalidation on file ID changes
4. Add debug logging to identify data flow issues

### Phase 2: Architecture Improvements
1. Implement component lifecycle management
2. Add backend response validation
3. Implement proper error boundaries for each file panel
4. Add development mode debug information

### Phase 3: Testing and Monitoring
1. Add comprehensive component testing with unique identifiers
2. Implement performance monitoring for cache hits/misses
3. Add user feedback mechanisms for incorrect data display
4. Create automated tests for multi-file scenarios

## Expected Outcome

After implementing these fixes:
- Each file panel will display accurate, file-specific information
- Cache invalidation will work properly per file
- Components will be easily identifiable for testing and debugging
- Data consistency between frontend and backend will be maintained
- File switches will trigger proper state updates
- Multiple file panels can coexist without data contamination

This comprehensive approach will ensure reliable, accurate file-specific data display and eliminate the current cross-contamination issues.