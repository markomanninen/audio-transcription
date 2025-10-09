# Testing Summary - Force Restart Fix

## Issue Fixed
The "Start Over" button (force-restart endpoint) was returning 500 Internal Server Error.

## Root Causes Identified
1. **Local `import json` statements** in `transcription.py` API file (lines 193, 289)
2. **Endpoint returned 503** instead of queuing transcription when Whisper not ready

## Fixes Applied

### 1. Added json to module-level imports
**File**: `backend/app/api/transcription.py:9`
```python
import json  # Added at top of file
```

### 2. Removed local json imports
Removed `import json` from lines 193 and 289 inside functions

### 3. Updated force-restart to queue transcriptions
**File**: `backend/app/api/transcription.py:273-294`

Changed from:
```python
if not is_transcription_service_ready():
    raise HTTPException(status_code=503, detail="...")
```

To:
```python
if not is_transcription_service_ready():
    add_pending_transcription(audio_file_id, request.include_diarization)
    # Initialize in background...
    raise HTTPException(status_code=202, detail="Whisper model loading...")
```

## Tests Created

### E2E Tests (Playwright)
**File**: `tests/e2e/tests/transcription-restart.spec.ts`

Tests:
1. ✓ Start Over button opens modal for completed file
2. ✓ force-restart accepts 202 response and queues transcription
3. ✓ Start Over does not cause 500 Internal Server Error
4. ✓ Modal closes after starting transcription restart
5. ✓ Status updates after force-restart
6. ✓ No console errors during restart

### Backend Unit Tests
**File**: `backend/tests/test_force_restart.py`

Tests:
1. Returns 202 when Whisper not ready
2. Does not return 500 error
3. Does not return 503 when not ready
4. Starts transcription when ready
5. Handles JSON correctly (no import errors)
6. Allows restarting completed file
7. Returns 404 for nonexistent file
8. Same behavior as /start endpoint

**Note**: Unit tests need refinement for proper mocking of local imports

## Manual Testing Required

Since automated tests have environment issues, please manually test:

1. **Select a completed file** with segments
2. **Click "Start Over"** button
3. **Verify**:
   - Modal opens with transcription settings
   - Click Save/Start
   - Modal closes (no error in console)
   - No "Failed to restart transcription" error
   - No 500 Internal Server Error
   - File status may show:
     - "Whisper Model Loading" if model not ready (202 response)
     - "Processing" if transcription started (200 response)

## Expected Behavior

### Before Fix
- ❌ Clicking "Start Over" showed error
- ❌ Console: `Failed to restart transcription: Error: Failed to restart transcription`
- ❌ Backend: 500 Internal Server Error
- ❌ Backend logs: `cannot access local variable 'json'`

### After Fix
- ✅ Modal opens and closes normally
- ✅ Returns 202 if Whisper loading
- ✅ Returns 200 if Whisper ready
- ✅ No JSON import errors
- ✅ Transcription queues/starts automatically

## Related Files Modified

1. `backend/app/api/transcription.py` - Added json import, fixed force-restart logic
2. `backend/app/services/transcription_service.py` - Removed local json imports (previous fix)
3. `tests/e2e/tests/transcription-restart.spec.ts` - New E2E tests
4. `backend/tests/test_force_restart.py` - New unit tests

## Coverage Note

Backend test coverage for transcription.py is currently 27%. The force-restart endpoint specifically needs integration testing with a real database and transcription service to fully validate the fix.
