# Manual Test: File Status Consistency

## Purpose
Verify that file list items and transcription status panel show consistent, accurate status information when switching files and refreshing the page.

## Prerequisites
- Backend and frontend running (`docker-compose up`)
- At least 2 audio files with completed transcriptions

## Test Procedure

### Test 1: File Switching Status Consistency

1. **Open application** in browser (http://localhost:3000)
2. **Select a project** with multiple files
3. **Click on File 1**
   - Note the status shown in the file card (e.g., "completed", "pending")
   - Check the transcription status panel shows:
     - Same status as the file card
     - Correct file ID matches
     - If completed: Shows segments and speakers (not "Whisper Model Loading")
     - If pending: Shows appropriate loading state

4. **Click on File 2** (different file)
   - File card shows its status
   - Status panel updates to match File 2's status
   - If File 2 is completed: Shows its segments (different count from File 1)
   - No stale data from File 1 appears

5. **Switch back to File 1**
   - Status panel shows File 1 data again
   - Segment count matches File 1 (not File 2)

6. **Rapid switching**: Click between files 5-10 times quickly
   - No console errors appear
   - Status always matches selected file
   - No cross-contamination of data

### Test 2: Page Refresh Consistency

1. **Select a completed file** (with segments)
2. **Note** the following:
   - File ID
   - Status shown
   - Segment count
3. **Refresh the page** (F5 or Cmd+R)
4. **Verify** after refresh:
   - Same file is auto-selected (from localStorage)
   - Status is still "completed" (NOT "pending" or "model loading")
   - Segment count matches pre-refresh count
   - No "Backend unavailable" errors after a few seconds

### Test 3: Backend Restart Recovery

1. **Select any file** and note its status
2. **Restart backend**: `docker-compose restart backend`
3. **Wait** for backend to start (~10-15 seconds)
4. **Observe frontend**:
   - Should show "Backend unavailable" banner initially
   - Banner should disappear within 5-10 seconds
   - File status should reload correctly
   - Completed files should NOT show "Whisper Model Loading"

## Expected Results

### ✅ Pass Criteria:
- File list status always matches status panel
- No stale data from previous file appears
- Completed files never show "Whisper Model Loading" screen
- Segment counts are correct for each file
- Page refresh preserves correct status
- Backend restart recovery happens within 10 seconds
- No console errors during file switching

### ❌ Fail Criteria:
- File shows "pending" but has segments
- Status panel shows wrong file's data
- Completed file shows "Whisper Model Loading"
- Segment count is 0 for completed file
- Backend unavailable error persists > 15 seconds
- Console errors during normal file switching

## Debug Steps if Test Fails

1. **Open browser console** (F12)
2. **Look for logs**:
   - `[App] File switched from X to Y`
   - `[useTranscriptionStatus] File X status: completed`
   - `[useSegments] File X returned N segments`

3. **Check API responses**:
   - Open Network tab
   - Filter by "status"
   - Check `/api/transcription/X/status` returns correct data

4. **Check circuit breaker**:
   - In console, run: `window.resetCircuitBreaker()`
   - Should log: "Circuit breaker manually reset"

5. **Verify backend database**:
   ```bash
   curl http://localhost:8000/api/transcription/1/status | jq '.status, .segment_count, .transcription_completed_at'
   ```

## Known Issues (Fixed)

- ✅ Backend JSON import scope error (fixed in transcription_service.py)
- ✅ Missing completion timestamp on resume (fixed in transcription_service.py:480)
- ✅ Completed files showing "model loading" when service not ready (fixed in transcription.py:473)
- ✅ Circuit breaker timeout too long (fixed: 30s → 5s in client.ts:10)

## Manual Test Results

**Tester**: ________________
**Date**: ________________
**Browser**: ________________
**Test 1 Result**: ☐ Pass ☐ Fail
**Test 2 Result**: ☐ Pass ☐ Fail
**Test 3 Result**: ☐ Pass ☐ Fail

**Notes**:
_______________________________________
_______________________________________
_______________________________________
