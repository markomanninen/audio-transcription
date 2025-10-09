# Transcription Process Reliability & Progress Tracking - Improvement Plan

## Problem Analysis

### Current Issues ❌

1. **Silent Failures**: Transcription processes can fail without proper error reporting
2. **Stuck Processes**: No timeout or recovery mechanism for hung transcriptions  
3. **Poor Progress Feedback**: Generic "processing 0%" doesn't tell users what's happening
4. **No Process Monitoring**: Can't detect if background processes crash or hang
5. **Manual Recovery**: Requires database manipulation to reset stuck jobs
6. **Resource Exhaustion**: No handling of memory/CPU limits during transcription
7. **Container Restart Issues**: Process state lost when containers restart

### Root Causes 🔍

1. **Synchronous Processing**: Transcription blocks the main thread
2. **No Task Queue**: No proper background job management
3. **Missing Progress Callbacks**: Whisper progress not captured and reported
4. **No Health Checks**: Can't detect stuck or failed processes
5. **Poor Error Handling**: Exceptions don't update database status properly
6. **No Timeouts**: Processes can run indefinitely
7. **State Management**: Process state not persisted across restarts

## Solution Architecture

### Phase 1: Immediate Fixes (1-2 days) 🚀

#### 1.1 Add Process Timeouts
```python
# backend/app/services/transcription_service.py
async def transcribe_audio_with_timeout(file_id: int, timeout: int = 1800):  # 30 min default
    try:
        await asyncio.wait_for(
            transcribe_audio(file_id), 
            timeout=timeout
        )
    except asyncio.TimeoutError:
        # Update status to FAILED with timeout message
        update_transcription_status(file_id, "FAILED", error="Transcription timeout after 30 minutes")
```

#### 1.2 Enhanced Progress Tracking
```python
# Detailed progress stages
TRANSCRIPTION_STAGES = {
    0: "Initializing...",
    10: "Loading audio file...", 
    20: "Preparing Whisper model...",
    30: "Starting transcription...",
    40: "Processing audio segments...",
    60: "Detecting speakers...",
    80: "Finalizing transcription...",
    100: "Complete"
}

async def update_progress(file_id: int, progress: int, stage: str):
    # Update both progress percentage and descriptive stage
    db.execute(
        "UPDATE audio_files SET transcription_progress = ?, progress_stage = ? WHERE id = ?",
        (progress, stage, file_id)
    )
```

#### 1.3 Proper Error Handling & Recovery
```python
async def transcribe_with_recovery(file_id: int):
    try:
        await update_progress(file_id, 0, "Initializing...")
        
        # Each step with progress updates
        audio_path = await load_audio_file(file_id)
        await update_progress(file_id, 20, "Audio loaded, preparing model...")
        
        model = await load_whisper_model()
        await update_progress(file_id, 30, "Starting transcription...")
        
        # Transcription with progress callbacks
        result = await transcribe_with_callbacks(audio_path, progress_callback)
        
    except Exception as e:
        logger.error(f"Transcription failed for file {file_id}: {str(e)}")
        await update_transcription_status(
            file_id, 
            "FAILED", 
            error=f"Transcription error: {str(e)}"
        )
        raise
```

### Phase 2: Robust Background Processing (3-5 days) 🏗️

#### 2.1 Implement Celery Task Queue
```python
# backend/app/tasks/transcription_tasks.py
from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure

app = Celery('transcription', broker='redis://redis:6379/0')

@app.task(bind=True, max_retries=3)
def transcribe_audio_task(self, file_id: int):
    try:
        # Set initial status
        update_status(file_id, "PROCESSING", 0, "Starting transcription...")
        
        # Actual transcription with progress updates
        result = transcribe_audio_with_progress(file_id, progress_callback=self.update_progress)
        
        # Mark as complete
        update_status(file_id, "COMPLETED", 100, "Transcription complete")
        return result
        
    except Exception as exc:
        # Retry logic
        if self.request.retries < self.max_retries:
            update_status(file_id, "RETRYING", self.request.retries * 25, f"Retry {self.request.retries + 1}/3")
            raise self.retry(countdown=60, exc=exc)
        else:
            # Final failure
            update_status(file_id, "FAILED", 0, f"Failed after 3 retries: {str(exc)}")
            raise
```

#### 2.2 Process Health Monitoring
```python
# backend/app/services/health_monitor.py
class TranscriptionHealthMonitor:
    async def monitor_stuck_processes(self):
        # Find processes stuck for > 30 minutes
        stuck_files = await db.execute("""
            SELECT id, filename, updated_at 
            FROM audio_files 
            WHERE transcription_status = 'PROCESSING' 
            AND updated_at < datetime('now', '-30 minutes')
        """)
        
        for file_data in stuck_files:
            logger.warning(f"Found stuck transcription: {file_data['filename']}")
            await self.handle_stuck_process(file_data['id'])
    
    async def handle_stuck_process(self, file_id: int):
        # Kill stuck process and reset status
        await kill_transcription_process(file_id)
        await update_status(file_id, "FAILED", 0, "Process timeout - automatically reset")
```

#### 2.3 Resource Management
```python
# backend/app/services/resource_manager.py
class ResourceManager:
    def __init__(self):
        self.max_concurrent_transcriptions = 2
        self.max_memory_per_process = "2GB"
        self.active_processes = {}
    
    async def can_start_transcription(self) -> bool:
        return len(self.active_processes) < self.max_concurrent_transcriptions
    
    async def monitor_resource_usage(self, process_id: str):
        # Monitor CPU/Memory usage
        # Kill process if it exceeds limits
        pass
```

### Phase 3: Enhanced User Experience (2-3 days) ✨

#### 3.1 Real-time Progress Updates
```typescript
// frontend/src/hooks/useTranscriptionProgress.ts
export const useTranscriptionProgress = (fileId: number) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);

  useEffect(() => {
    // WebSocket or SSE connection for real-time updates
    const ws = new WebSocket(`ws://localhost:8000/api/transcription/${fileId}/progress`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setStage(data.stage);
      setEstimatedTimeRemaining(data.eta);
    };

    return () => ws.close();
  }, [fileId]);

  return { progress, stage, estimatedTimeRemaining };
};
```

#### 3.2 Enhanced Progress UI Component
```typescript
// frontend/src/components/Transcription/TranscriptionProgress.tsx
export const EnhancedTranscriptionProgress = ({ fileId }: { fileId: number }) => {
  const { progress, stage, estimatedTimeRemaining, status } = useTranscriptionProgress(fileId);

  if (status === 'FAILED') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Transcription Failed</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
        <button 
          onClick={() => retryTranscription(fileId)}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry Transcription
        </button>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-blue-900">Transcribing Audio</span>
        <span className="text-sm text-blue-700">{progress}% complete</span>
      </div>
      
      {/* Animated progress bar */}
      <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Current stage */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-blue-700">{stage}</span>
        {estimatedTimeRemaining && (
          <span className="text-blue-600">~{estimatedTimeRemaining} remaining</span>
        )}
      </div>
      
      {/* Cancel button for long processes */}
      {progress > 0 && progress < 100 && (
        <button 
          onClick={() => cancelTranscription(fileId)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Cancel Transcription
        </button>
      )}
    </div>
  );
};
```

#### 3.3 Transcription Queue Management
```typescript
// Show queue position for pending transcriptions
export const TranscriptionQueue = () => {
  const { data: queue } = useQuery('transcription-queue', fetchTranscriptionQueue);
  
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="font-medium text-yellow-900 mb-2">Transcription Queue</h3>
      <div className="space-y-2">
        {queue.map((item, index) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span>{item.filename}</span>
            <span className="text-yellow-700">
              {index === 0 ? 'Processing...' : `Position ${index + 1} in queue`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Phase 4: Advanced Features (3-4 days) 🚀

#### 4.1 Intelligent Retry Logic
```python
class SmartRetryStrategy:
    def should_retry(self, error: Exception, attempt: int) -> bool:
        # Different retry strategies based on error type
        if isinstance(error, OutOfMemoryError):
            return attempt < 2  # Retry with smaller model
        elif isinstance(error, NetworkError):
            return attempt < 3  # Network issues are often temporary
        elif isinstance(error, ModelLoadError):
            return attempt < 1  # Model issues rarely resolve on retry
        return False
    
    def get_retry_delay(self, attempt: int) -> int:
        # Exponential backoff: 30s, 60s, 120s
        return min(30 * (2 ** attempt), 300)
```

#### 4.2 Performance Optimization
```python
class TranscriptionOptimizer:
    def select_optimal_model(self, audio_duration: float, audio_quality: str) -> str:
        # Auto-select model based on file characteristics
        if audio_duration < 300:  # < 5 minutes
            return "base"  # Fast for short files
        elif audio_quality == "high":
            return "large"  # Best quality for high-quality audio
        else:
            return "medium"  # Balanced for longer files
    
    def estimate_processing_time(self, duration: float, model: str) -> int:
        # Realistic time estimates based on model and duration
        model_speed = {"tiny": 0.1, "base": 0.2, "small": 0.3, "medium": 0.5, "large": 1.0}
        return int(duration * model_speed[model] * 60)  # Convert to seconds
```

#### 4.3 Batch Processing
```python
async def process_transcription_batch(file_ids: List[int]):
    # Process multiple files efficiently
    for file_id in file_ids:
        if await resource_manager.can_start_transcription():
            task = transcribe_audio_task.delay(file_id)
            await track_task(file_id, task.id)
        else:
            await add_to_queue(file_id)
```

## Implementation Timeline

### Week 1: Foundation
- ✅ Add timeouts and better error handling
- ✅ Implement detailed progress tracking  
- ✅ Add health monitoring for stuck processes
- ✅ Create enhanced UI components

### Week 2: Background Processing
- ✅ Set up Celery task queue
- ✅ Implement retry logic with exponential backoff
- ✅ Add resource management and limits
- ✅ Real-time progress updates via WebSocket

### Week 3: Polish & Advanced Features
- ✅ Intelligent model selection
- ✅ Batch processing capabilities
- ✅ Performance monitoring and optimization
- ✅ Comprehensive testing and documentation

## Database Schema Updates

```sql
-- Add new columns for enhanced tracking
ALTER TABLE audio_files ADD COLUMN progress_stage TEXT DEFAULT 'pending';
ALTER TABLE audio_files ADD COLUMN estimated_duration INTEGER;
ALTER TABLE audio_files ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE audio_files ADD COLUMN task_id TEXT;
ALTER TABLE audio_files ADD COLUMN started_at DATETIME;
ALTER TABLE audio_files ADD COLUMN completed_at DATETIME;

-- Add transcription queue table
CREATE TABLE transcription_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audio_file_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    FOREIGN KEY (audio_file_id) REFERENCES audio_files (id)
);
```

## Configuration Updates

```env
# New transcription settings
TRANSCRIPTION_TIMEOUT=1800  # 30 minutes
MAX_CONCURRENT_TRANSCRIPTIONS=2
MAX_RETRY_ATTEMPTS=3
ENABLE_PROGRESS_WEBSOCKET=true
TRANSCRIPTION_QUEUE_ENABLED=true

# Resource limits
MAX_MEMORY_PER_TRANSCRIPTION=2GB
CPU_LIMIT_PER_TRANSCRIPTION=2
```

## Testing Strategy

### Unit Tests
- ✅ Timeout handling
- ✅ Retry logic
- ✅ Progress tracking
- ✅ Error recovery

### Integration Tests  
- ✅ End-to-end transcription flow
- ✅ WebSocket progress updates
- ✅ Queue management
- ✅ Resource limit enforcement

### Load Tests
- ✅ Multiple concurrent transcriptions
- ✅ Large file handling
- ✅ Memory usage under load
- ✅ Recovery after system restart

## Monitoring & Alerting

```python
# Add metrics for monitoring
class TranscriptionMetrics:
    def __init__(self):
        self.total_transcriptions = Counter('transcriptions_total')
        self.failed_transcriptions = Counter('transcriptions_failed')
        self.processing_time = Histogram('transcription_duration_seconds')
        self.queue_size = Gauge('transcription_queue_size')
    
    def record_completion(self, duration: float, success: bool):
        self.total_transcriptions.inc()
        if not success:
            self.failed_transcriptions.inc()
        self.processing_time.observe(duration)
```

## Success Metrics

After implementation, we should see:

- ✅ **Zero stuck transcriptions** (all processes complete or fail gracefully)
- ✅ **90%+ transcription success rate** (with proper retries)
- ✅ **<5% user intervention needed** (automatic recovery)
- ✅ **Real-time progress visibility** (users know what's happening)
- ✅ **<1 minute recovery time** from failures
- ✅ **Graceful handling of system restarts** (no lost work)

This plan addresses the fundamental reliability issues and transforms the transcription system from a fragile, opaque process into a robust, user-friendly experience that handles failures gracefully and keeps users informed every step of the way.