# Transcription Completion Status Fix

## Problem Description

After force-restarting a transcription, the frontend would show stale "processing" status even after the backend completed the transcription. The file card and status panel would display inconsistent statuses, with the transcription being completed in the database but the UI stuck showing "processing" or "pending".

## Root Cause Analysis

### Issue 1: React Query Cache Lifecycle
The transcription status query had insufficient cache management:
- `gcTime: 1000` (1 second) kept stale data in cache
- When polling detected status change, stale cache data could still be returned briefly
- No aggressive cache invalidation when status transitioned from "processing" to "completed"

### Issue 2: Polling Race Condition
The `refetchInterval` logic would stop polling when status changed from "processing", but the UI might still show the last cached "processing" status:

```typescript
refetchInterval: (query: any) => {
  const status = query.state.data?.status
  if (pollInterval && status === 'processing') {
    return pollInterval  // Keep polling
  }
  return false  // Stop polling - but cache might still have old data!
}
```

### Issue 3: No Status Change Detection
The `useEffect` only invalidated related queries (segments, speakers, files) but didn't forcefully clear and refetch the status query itself when status changed to "completed" or "failed".

## Solution Implemented

### 1. Aggressive Cache Management

**File**: `frontend/src/hooks/useTranscription.ts`

Changed `gcTime` from 1000ms to 0:
```typescript
gcTime: 0, // Don't keep stale data in cache AT ALL - always fetch fresh
```

Added aggressive refetch options:
```typescript
refetchOnMount: 'always', // Always refetch when component mounts
refetchOnWindowFocus: true, // Refetch when window regains focus
refetchOnReconnect: true, // Refetch when reconnecting
```

### 2. Status Change Detection & Cache Clearing

Added comprehensive cache clearing when status transitions to completed/failed:

```typescript
useEffect(() => {
  const status = query.data?.status

  if (status === 'completed' || status === 'failed') {
    // When transcription finishes, force remove stale cache and refetch everything
    if (import.meta.env.DEV) {
      console.log(`[useTranscriptionStatus] Status changed to ${status}, clearing cache and refetching`)
    }

    // Remove stale cache first
    queryClient.removeQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
    queryClient.removeQueries({ queryKey: ['segments', fileId, 'v3'] })
    queryClient.removeQueries({ queryKey: ['speakers', fileId, 'v3'] })

    // Then invalidate to trigger fresh fetch
    queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
    queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
    queryClient.invalidateQueries({ queryKey: ['speakers', fileId, 'v3'] })
    queryClient.invalidateQueries({ queryKey: ['files'] })
    queryClient.invalidateQueries({ queryKey: ['project-files'] })
  }
}, [query.data?.status, queryClient, fileId])
```

## Key Differences: Before vs After

### Before
- `gcTime: 1000` - kept stale data for 1 second
- No status change detection
- Only invalidated related queries on completion
- Stale "processing" status could persist in UI
- Race conditions between polling and cache updates

### After
- `gcTime: 0` - never keep stale data in cache
- Active status change detection via `useEffect`
- Aggressive `removeQueries()` + `invalidateQueries()` on status change
- Always refetch on mount/focus/reconnect
- Status transitions are immediately reflected in UI

## Testing

### E2E Tests Created

**File**: `tests/e2e/tests/transcription-completion-status.spec.ts`

1. **status updates from processing to completed** - Verifies both file card and status panel show correct status throughout transcription lifecycle
2. **force-restart shows processing then updates to completed correctly** - Tests force-restart doesn't show "pending" and updates correctly
3. **status remains consistent during page refresh** - Ensures completed files stay completed after refresh
4. **no console errors during status transitions** - Validates no errors occur during status changes

### Manual Testing Steps

1. Upload a new audio file
2. Start transcription
3. Verify file card shows "processing"
4. Verify status panel shows "processing" (not "pending")
5. Wait for completion
6. Verify both file card and status panel update to "completed" within 5 seconds
7. Force-restart the file
8. Verify status goes to "processing" (not "pending")
9. Wait for completion again
10. Verify status updates to "completed" correctly
11. Refresh page
12. Verify status remains "completed"

## Expected Behavior

### During Transcription
- File card status: "processing"
- Status panel status: "processing"
- Progress bar visible
- Segment count increases in real-time

### Upon Completion
- File card status: "completed"
- Status panel status: "completed"
- Final segment count displayed
- Progress bar shows 100%
- **Status updates within 5 seconds of backend completion**

### After Force-Restart
- Status immediately changes from "completed" → "processing"
- **Never shows "pending" status**
- Segments cleared
- New transcription starts
- Upon completion, status updates to "completed"

## Related Files Modified

1. `frontend/src/hooks/useTranscription.ts` - Main fix for cache management
2. `frontend/src/App.tsx` - Already had cache clearing on force-restart (lines 496-519)
3. `tests/e2e/tests/transcription-completion-status.spec.ts` - New comprehensive E2E tests

## Performance Considerations

Setting `gcTime: 0` means React Query will immediately garbage collect unused queries. This is acceptable because:
1. Transcription status is actively polled while processing
2. When completed, status rarely changes
3. We explicitly refetch when needed (mount, focus, reconnect)
4. Status data is small (< 1KB per response)
5. Eliminates cache consistency issues entirely

## Future Improvements

1. **WebSocket for Real-Time Updates** - Replace polling with WebSocket for instant status updates
2. **Optimistic Updates** - Update UI optimistically when starting transcription
3. **Progress Streaming** - Stream progress updates in real-time instead of polling
4. **Background Sync** - Use Service Worker background sync for offline support

## Debugging

If status issues persist, check:

1. **Browser Console** - Look for `[useTranscriptionStatus]` logs
2. **React Query DevTools** - Inspect cache state and stale times
3. **Network Tab** - Verify `/api/transcription/{id}/status` returns correct data
4. **Backend Logs** - Check if transcription actually completed in database
5. **Database** - Query `audio_files` table for `transcription_status` and `transcription_completed_at`

### Debugging Commands

```bash
# Check backend API status
curl http://localhost:8000/api/transcription/{file_id}/status | jq

# Check database state
docker-compose exec backend python -c "
from app.core.database import SessionLocal
from app.models.audio_file import AudioFile
db = SessionLocal()
file = db.query(AudioFile).filter(AudioFile.id == {file_id}).first()
print(f'Status: {file.transcription_status}')
print(f'Progress: {file.transcription_progress}')
print(f'Completed: {file.transcription_completed_at}')
"

# Check segment count
curl http://localhost:8000/api/transcription/{file_id}/segments | jq '. | length'
```

## Summary

This fix ensures that transcription status updates are reflected immediately in the UI by:
1. Never keeping stale cache data (`gcTime: 0`)
2. Aggressively clearing cache when status changes to completed/failed
3. Always refetching on mount/focus/reconnect
4. Detecting status changes via `useEffect` and triggering cache invalidation

The result is a responsive UI that accurately reflects backend transcription state without race conditions or stale data issues.
