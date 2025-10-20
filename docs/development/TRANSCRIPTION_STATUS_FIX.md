# Transcription Status API Fix - October 20, 2025

## Problem Summary

The `/api/transcription/{file_id}/status` endpoint was returning incorrect status information when the transcription service singleton was not initialized (`is_transcription_service_ready()` returned `False`), even though the actual transcription was actively running in the background.

### Symptoms

- **API Response**: Returned `status: "pending"` with `progress: 0.0` and `processing_stage: "model_ready_to_load"`
- **Database Reality**: File status was `PROCESSING` with `progress: 0.54` (54% complete)
- **Backend Logs**: Showed active transcription progress: `🎵 [TRANSCRIPTION] Progress: 54.0%`
- **UI Display**: Showed inconsistent status due to API returning wrong data

### Example of the Bug

```bash
# Database shows:
Status: TranscriptionStatus.PROCESSING
Progress: 0.5401026647289594 (54%)
Started: 2025-10-19 23:55:06.551391

# API returned (WRONG):
{
  "status": "pending",
  "progress": 0.0,
  "processing_stage": "model_ready_to_load",
  "error_message": "AI model is cached and ready. Click 'Start Transcription' to begin."
}

# Backend logs (CORRECT):
🎵 00:07:45 [TRANSCRIPTION] Progress: 53.3% - Transcribing audio - processing speech (759s)
```

## Root Cause

The status endpoint at [backend/app/api/transcription.py:696-755](../../backend/app/api/transcription.py#L696-L755) had logic that checked if the transcription service singleton was ready:

```python
if not is_transcription_service_ready():
    # Only handled COMPLETED status
    if audio_file.transcription_status == TranscriptionStatus.COMPLETED:
        # Return database data
        ...

    # For all other statuses (including PROCESSING!), returned generic "pending"
    return TranscriptionStatusResponse(
        status="pending",
        progress=0.0,
        processing_stage="model_ready_to_load",
        ...
    )
```

This meant that if the transcription service singleton was not initialized (which can happen after backend restart or during certain initialization states), the endpoint would ignore the actual database status for PROCESSING and FAILED files.

## The Fix

Modified the condition to check for ALL non-pending statuses (PROCESSING, COMPLETED, FAILED) and return the actual database data:

```python
if not is_transcription_service_ready():
    # CRITICAL FIX: If file is already processing, completed, or failed, return actual data from database
    # Don't show "model loading" for files that have actual transcription status!
    if audio_file.transcription_status in (TranscriptionStatus.PROCESSING, TranscriptionStatus.COMPLETED, TranscriptionStatus.FAILED):
        segment_count = db.query(Segment).filter(Segment.audio_file_id == file_id).count()

        # For processing files, use the stored progress and stage from database
        progress_value = audio_file.transcription_progress or 0.0
        if audio_file.transcription_status == TranscriptionStatus.COMPLETED:
            progress_value = 1.0  # Ensure completed files show 100%

        return TranscriptionStatusResponse(
            file_id=audio_file.id,
            filename=audio_file.filename,
            original_filename=audio_file.original_filename,
            status=audio_file.transcription_status.value.lower(),
            progress=progress_value,
            error_message=audio_file.error_message if audio_file.transcription_status == TranscriptionStatus.FAILED else None,
            processing_stage=audio_file.transcription_stage,
            segment_count=segment_count,
            duration=audio_file.duration,
            transcription_started_at=audio_file.transcription_started_at.isoformat() if audio_file.transcription_started_at else None,
            transcription_completed_at=audio_file.transcription_completed_at.isoformat() if audio_file.transcription_completed_at else None,
            created_at=audio_file.created_at.isoformat() if audio_file.created_at else None,
            updated_at=audio_file.updated_at.isoformat() if audio_file.updated_at else None,
            transcription_metadata=audio_file.transcription_metadata,
            **split_context,
        )
```

## Changes Made

**File**: [backend/app/api/transcription.py](../../backend/app/api/transcription.py)
**Lines**: 696-723

### Key Improvements

1. **Expanded Status Check**: Now checks for `PROCESSING`, `COMPLETED`, and `FAILED` statuses (previously only `COMPLETED`)
2. **Database-First Approach**: Returns actual database status for any file with active transcription state
3. **Progress Preservation**: Uses `audio_file.transcription_progress` from database instead of hardcoded `0.0`
4. **Stage Information**: Returns `audio_file.transcription_stage` to show actual processing stage
5. **Error Handling**: Returns `audio_file.error_message` for failed transcriptions

## Impact

### Before Fix
- Active transcriptions showed as "pending" when service singleton wasn't initialized
- UI displayed incorrect progress (0%) while transcription was running at 50%+
- Users couldn't see actual transcription progress after backend restart
- FileList and TranscriptionProgress components showed conflicting information

### After Fix
- API always returns accurate status from database for active transcriptions
- UI correctly displays progress even if service singleton isn't ready
- Transcription progress persists across backend restarts
- Consistent status display across all UI components

## Frontend Components Affected

The fix ensures these components receive correct data:

1. **TranscriptionProgress.tsx** - Shows accurate progress bars and status badges
2. **FileList.tsx** - Displays correct file status and action buttons
3. **useTranscription.ts** hook - Receives accurate polling data

All frontend components were already correctly implemented to handle the data - they just needed the backend to return accurate information.

## Testing

### Manual Verification

```bash
# 1. Check database status
docker exec transcribe-backend-1 python -c "
from app.core.database import SessionLocal
from app.models.audio_file import AudioFile
db = SessionLocal()
file = db.query(AudioFile).filter(AudioFile.id == 8).first()
print(f'Status: {file.transcription_status}')
print(f'Progress: {file.transcription_progress}')
db.close()
"

# 2. Check API status
curl -s "http://localhost:8080/api/transcription/8/status" | jq '{status, progress, processing_stage}'

# 3. They should now match!
```

### Test Scenarios

1. ✅ Active transcription returns PROCESSING status with correct progress
2. ✅ Completed transcription returns COMPLETED status with 100% progress
3. ✅ Failed transcription returns FAILED status with error message
4. ✅ Pending transcription (never started) returns model ready/download needed status
5. ✅ Status persists correctly across backend restarts

## Related Documentation

- [UI Status Inconsistency Debug Guide](../UI_STATUS_INCONSISTENCY_DEBUG.md)
- [Transcription Service Architecture](./API.md)
- [Frontend Status Display Implementation](../../frontend/src/components/Dashboard/)

## Technical Details

### Why This Bug Occurred

The transcription service uses a singleton pattern with lazy initialization. The service can be in a "not ready" state:
- After backend restart (before first transcription starts)
- During model loading phase
- If initialization fails

The original code assumed "not ready" meant "no active transcriptions", which was incorrect. Transcriptions can run via background tasks even when the singleton isn't fully initialized.

### Design Decision

The database is the **single source of truth** for transcription status. The service singleton provides real-time progress updates during active processing, but the API should always fall back to database state when the service isn't available.

## Deployment Notes

- **No database migration required** - uses existing schema
- **No frontend changes required** - components already handle the data correctly
- **Backend restart required** - to apply the Python code fix
- **No breaking changes** - API response format remains the same

## Future Improvements

Consider these enhancements:

1. **Service Health Monitoring**: Add metrics for singleton initialization failures
2. **Progress Sync**: Ensure background task progress updates are atomic with database writes
3. **Status Audit Trail**: Log all status transitions for debugging
4. **Recovery Logic**: Auto-restart transcriptions that are stuck in PROCESSING after backend restart

---

**Fixed By**: Claude Code
**Date**: October 20, 2025
**Commit**: (to be added)
**Issue**: Transcription status API returning incorrect data when service singleton not ready
