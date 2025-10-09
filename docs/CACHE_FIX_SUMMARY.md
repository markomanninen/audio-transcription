# Cache and Status Issues - Complete Fix Summary

## Problems Identified

### 1. Backend: JSON Import Scope Error
**Symptom**: Transcriptions failed with error "cannot access local variable 'json' where it is not associated with a value"

**Root Cause**: Local `import json` statements inside try blocks created local scope, but `json.dumps()` was used outside those blocks.

**Files Affected**:
- `backend/app/services/transcription_service.py` (lines 536, 562, 175, 199, 333)

**Fix**: Removed all local `import json` statements since `json` is already imported at module level (line 8).

---

### 2. Backend: Missing Completion Timestamp on Resume
**Symptom**: Files with existing segments showed status="completed" but `transcription_completed_at` was null

**Root Cause**: Resume logic (line 476-480) set status to COMPLETED but didn't set the completion timestamp.

**Files Affected**:
- `backend/app/services/transcription_service.py` (lines 476-480)

**Fix**: Added completion timestamp check:
```python
# Set completion timestamp if not already set
if not audio_file.transcription_completed_at:
    audio_file.transcription_completed_at = datetime.utcnow()
```

---

### 3. Frontend: Stale Cache on File Switch
**Symptom**: Switching files sometimes showed stale "pending" status even though file was completed

**Root Cause**: When switching to a file, React Query might have stale cached data for that file from a previous session.

**Files Affected**:
- `frontend/src/App.tsx` (lines 136-148)

**Fix**: Clear cache for BOTH old and new file when switching:
```typescript
// Remove cache for previous file
queryClient.removeQueries({ queryKey: ['transcription-status', previousFileId, 'v3'] })
queryClient.removeQueries({ queryKey: ['segments', previousFileId, 'v3'] })
queryClient.removeQueries({ queryKey: ['speakers', previousFileId, 'v3'] })

// CRITICAL: Also remove any stale cache for the NEW file before fetching fresh data
queryClient.removeQueries({ queryKey: ['transcription-status', selectedFileId, 'v3'] })
queryClient.removeQueries({ queryKey: ['segments', selectedFileId, 'v3'] })
queryClient.removeQueries({ queryKey: ['speakers', selectedFileId, 'v3'] })

// Now fetch fresh data for new file
queryClient.invalidateQueries({ queryKey: ['transcription-status', selectedFileId, 'v3'] })
queryClient.invalidateQueries({ queryKey: ['segments', selectedFileId, 'v3'] })
queryClient.invalidateQueries({ queryKey: ['speakers', selectedFileId, 'v3'] })
```

---

### 4. Frontend: Stale Cache on Page Refresh
**Symptom**: Refreshing page sometimes showed stale status from previous session

**Root Cause**: React Query persists cache across page refreshes, so old data could appear.

**Files Affected**:
- `frontend/src/App.tsx` (added lines 79-91)

**Fix**: Clear all v3 caches on initial page load:
```typescript
// Clear all v3 caches on page load/refresh to ensure fresh data
useEffect(() => {
  if (import.meta.env.DEV) {
    console.log('[App] Page loaded - clearing all v3 caches to prevent stale data')
  }
  // Remove all v3 cache keys on mount
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey
      return Array.isArray(key) && key[key.length - 1] === 'v3'
    }
  })
}, []) // Empty dependency array - run once on mount
```

---

## Testing Verification

### Backend Fixes
✅ File 3 now shows:
- Status: "completed"
- Completion timestamp: "2025-10-09T14:07:32.601090"
- 2 segments created
- Progress: 1.0 (100%)

✅ File 1 shows:
- Status: "completed"
- Completion timestamp: "2025-10-09T08:12:27.900608"
- 2227 segments created
- Progress: 1.0 (100%)

### Frontend Fixes
✅ On page refresh: All v3 caches cleared, fresh data fetched
✅ On file switch: Both old and new file caches cleared, fresh data fetched
✅ No more stale "pending" status appearing

---

## Files Modified

### Backend
1. `backend/app/services/transcription_service.py`
   - Removed local `import json` statements (5 locations)
   - Added completion timestamp on resume (line 480-481)

### Frontend
2. `frontend/src/App.tsx`
   - Added page load cache clear (lines 79-91)
   - Enhanced file switch cache clear (lines 140-148)

3. `frontend/src/components/Dashboard/TranscriptionProgress.tsx`
   - Already had correct check on line 241 (from previous fix)

4. `backend/app/main.py`
   - Already fixed Whisper health status on line 142 (from previous fix)

---

## Expected Behavior After Fixes

1. **Fresh page load**: All caches cleared, fresh data fetched from API
2. **File switch**: Stale caches for both files cleared, fresh data fetched
3. **Completed files**: Show "completed" status with proper timestamps
4. **Processing files**: Show correct progress and status
5. **Pending files with model loading**: Show Whisper loading screen only if truly pending AND not completed

---

## Cache Strategy Summary

- **Cache Key Format**: `['resource-type', fileId, 'v3']`
- **staleTime**: 0 (always consider stale)
- **gcTime**: 1-10 seconds (garbage collect quickly)
- **Clear on mount**: Yes (page load)
- **Clear on switch**: Yes (both old and new files)
- **Invalidate after clear**: Yes (force fresh fetch)
