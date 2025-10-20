# Progress Bar Fix Implementation Checklist

**Issue**: Progress bar only appears after page refresh, not automatically
**Root Cause**: Multiple polling intervals + optimistic update race condition
**Full Analysis**: See [PROGRESS_BAR_STATE_INVESTIGATION.md](./PROGRESS_BAR_STATE_INVESTIGATION.md)

---

## Phase 1: Remove Redundant Polling (Quick Win)

**Impact**: 66% reduction in API calls, immediate improvement
**Risk**: None (React Query handles polling correctly)

### Task 1.1: Remove Extra Polling in TranscriptionProgress

**File**: `frontend/src/components/Dashboard/TranscriptionProgress.tsx`

**Action**: Delete these two useEffect blocks:

```typescript
// ❌ DELETE lines 100-107
useEffect(() => {
  if (status?.status === 'processing') {
    const interval = setInterval(() => {
      refetch()
    }, 5000)
    return () => clearInterval(interval)
  }
}, [status?.status, refetch])

// ❌ DELETE lines 191-200
useEffect(() => {
  if (status?.status === 'processing') {
    const interval = setInterval(() => {
      console.log('Force refetching status during processing...')
      refetch()
    }, 1500)
    return () => clearInterval(interval)
  }
}, [status?.status, refetch])
```

**Result**: Only React Query's `refetchInterval: 2000` will poll

**Test**:
- Start transcription
- Open DevTools → Network tab
- Count `/api/transcription/{id}/status` requests in 10 seconds
- **Before**: ~15-20 requests
- **After**: ~5 requests

---

### Task 1.2: Remove Cache Invalidation Cascade

**File**: `frontend/src/hooks/useTranscription.ts`

**Action**: Delete cache synchronization logic (lines 62-75)

```typescript
// ❌ DELETE THIS (inside queryFn, lines 62-75)
// Invalidate project files cache to keep FileList synchronized
const currentFiles = queryClient.getQueryData(['files']) as unknown[]
if (currentFiles) {
  const fileInList = currentFiles.find((f: unknown) => {
    const file = f as { file_id?: number; id?: number; status?: string }
    return file.file_id === fileId || file.id === fileId
  })
  if (fileInList) {
    const file = fileInList as { status?: string }
    if (file.status !== response.data.status) {
      queryClient.invalidateQueries({ queryKey: ['files'] })
    }
  }
}
```

**Replace with**: Add to useQuery config (after line 111):

```typescript
return useQuery({
  queryKey: ['transcription-status', fileId, 'v3'],
  queryFn: async (): Promise<TranscriptionStatus> => {
    if (!fileId) throw new Error('No file ID')

    if (import.meta.env.DEV) {
      console.log(`[useTranscriptionStatus] Fetching status for file ${fileId}`)
    }

    const response = await apiClient.get<TranscriptionStatus>(
      `/api/transcription/${fileId}/status`
    )

    // ✅ ADD: Update file list cache in-place instead of invalidating
    queryClient.setQueriesData<AudioFile[] | undefined>(
      { queryKey: ['files'] },
      (oldFiles) => {
        if (!oldFiles) return oldFiles
        return oldFiles.map(file =>
          file.file_id === fileId
            ? {
                ...file,
                status: response.data.status,
                progress: response.data.progress,
                transcription_started_at: response.data.transcription_started_at,
                transcription_completed_at: response.data.transcription_completed_at
              }
            : file
        )
      }
    )

    if (import.meta.env.DEV) {
      console.log(`[useTranscriptionStatus] File ${fileId} status:`, response.data.status)
    }

    // ... rest of normalization code
  },
  // ... rest of config
})
```

**Result**: File list updates in-place without full re-fetch, no UI flicker

**Test**:
- Start transcription
- Watch file list - should update smoothly without flicker
- Check DevTools → React Query DevTools → watch ['files'] query
- Should NOT see repeated invalidation/refetch

---

## Phase 2: Fix Race Condition

**Impact**: Eliminates delay between transcription start and progress bar appearance
**Risk**: Low (just timing adjustment)

### Task 2.1: Adjust StaleTime for Processing Status

**File**: `frontend/src/hooks/useTranscription.ts`

**Action**: Modify staleTime logic (lines 114-122)

```typescript
// ❌ CURRENT
staleTime: (query) => {
  const status = query.state.data?.status
  if (status === 'completed' || status === 'failed') {
    return 30000
  }
  return 0  // ← Problem: processing/pending always stale
}

// ✅ CHANGE TO
staleTime: (query) => {
  const status = query.state.data?.status
  if (status === 'completed' || status === 'failed') {
    return 30000  // Fresh for 30 seconds
  }
  if (status === 'processing') {
    return 1000  // Give backend 1 second to actually start processing
  }
  return 0  // Only 'pending' is always stale
}
```

**Result**: Reduces race condition window from 800ms to near-zero

**Test**:
- Start transcription
- Time from "Start" click to progress bar appearance
- **Before**: 1000-1500ms
- **After**: 200-500ms

---

### Task 2.2: Remove Scheduled Refetch Delays from FileList

**File**: `frontend/src/components/Dashboard/FileList.tsx`

**Action**: Delete scheduled refetches (lines 487-496)

```typescript
// ❌ DELETE THIS
// Force additional refetch after short delay to catch status change with v3 keys
setTimeout(() => {
  console.log('Force refetching after transcription start from FileList...')
  queryClient.refetchQueries({ queryKey: ['transcription-status', showTranscriptionModal.fileId, 'v3'] })
}, 1000)

setTimeout(() => {
  console.log('Second force refetch after transcription start from FileList...')
  queryClient.refetchQueries({ queryKey: ['transcription-status', showTranscriptionModal.fileId, 'v3'] })
}, 3000)
```

**Reason**: React Query will refetch automatically when TranscriptionProgress mounts

**Result**: Cleaner code, no redundant scheduled refetches

---

## Phase 3: Architecture Improvement (Optional)

**Impact**: Complete elimination of race condition
**Risk**: Medium (changes user flow - modal stays open briefly longer)

### Task 3.1: Wait for Backend Confirmation

**File**: `frontend/src/components/Dashboard/FileList.tsx`

**Action**: Move modal close to AFTER backend confirmation

```typescript
// Current: Optimistic update BEFORE API call (line 430)
queryClient.setQueryData(statusQueryKey, optimisticStatus)  // ❌ REMOVE

const handleStartTranscription = async (settings: TranscriptionSettings) => {
  const fileId = showTranscriptionModal!.fileId

  // Show loading state
  setActionInProgress({ fileId, action: 'Starting transcription' })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })

    if (!response.ok) {
      throw new Error(`Failed to start transcription`)
    }

    const result = await response.json()
    console.log('Backend confirmed:', result)

    // ✅ ONLY close modal AFTER backend confirms
    setShowTranscriptionModal(null)
    setActionInProgress(null)
    onSelectFile?.(fileId)

    // Invalidate queries - fresh data will be fetched
    queryClient.invalidateQueries({ queryKey: ['files'] })
    queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })

    // ❌ REMOVE scheduled refetches (rely on React Query)

  } catch (error) {
    console.error('Failed:', error)
    setActionInProgress(null)
    alert(`Failed: ${error.message}`)
  }
}
```

**Result**: UI waits for backend confirmation, no race condition possible

**User Impact**: Modal stays open ~200ms longer (showing "Starting..." spinner)

---

## Testing Protocol

### Before Starting

1. **Baseline measurement**:
   ```bash
   # Terminal 1: Watch backend logs
   docker-compose logs -f backend | grep "GET /api/transcription/.*/status"

   # Terminal 2: Monitor Redis (optional)
   docker-compose exec redis redis-cli monitor
   ```

2. **Browser setup**:
   - Open DevTools → Network tab
   - Filter: `/status`
   - Clear on navigation: OFF
   - Preserve log: ON

### Test Each Phase

After implementing each phase:

1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)

2. **Test scenario**:
   - Upload test file (use `tests/e2e/assets/Kaaritorpantie - Rainer 5min.mp3`)
   - Start transcription
   - **Measure**: Time from "Start" click to progress bar visible
   - **Count**: Status API requests in first 10 seconds

3. **Expected improvements**:

   | Phase | Time to Progress Bar | API Requests (10s) | Cache Invalidations |
   |-------|---------------------|-------------------|---------------------|
   | Before | 1000-1500ms | 15-20 | 5-8 |
   | Phase 1 | 800-1200ms | 5-7 | 1-2 |
   | Phase 2 | 200-500ms | 5-6 | 1-2 |
   | Phase 3 | 100-300ms | 4-5 | 0-1 |

4. **Regression check**:
   - Refresh page during transcription → progress still visible ✓
   - Switch between files → no stale progress ✓
   - Batch transcription → smooth file switching ✓

### Verification Commands

```bash
# Count status requests in backend logs (should be ~5 per 10 seconds)
docker-compose logs backend --since 10s | grep "GET /api/transcription/.*/status" | wc -l

# Watch React Query cache updates
# In browser console:
window.__REACT_QUERY_DEVTOOLS__ = true
# Then open React Query DevTools panel

# Check localStorage for stale state
localStorage.getItem('selectedFileId_<projectId>')
localStorage.getItem('lastUsedTranscriptionSettings')
```

---

## Rollback Plan

If issues arise after implementing fixes:

### Rollback Phase 1
```bash
git checkout HEAD -- frontend/src/components/Dashboard/TranscriptionProgress.tsx
git checkout HEAD -- frontend/src/hooks/useTranscription.ts
```

### Rollback Phase 2
```bash
git checkout HEAD -- frontend/src/hooks/useTranscription.ts
git checkout HEAD -- frontend/src/components/Dashboard/FileList.tsx
```

### Rollback Phase 3
```bash
git checkout HEAD -- frontend/src/components/Dashboard/FileList.tsx
```

---

## Success Criteria

✅ **Phase 1 Complete** when:
- API request count drops to ~5 per 10 seconds (from 15-20)
- No visual changes to user experience
- All tests pass

✅ **Phase 2 Complete** when:
- Progress bar appears within 500ms of "Start" click
- No UI flicker during status updates
- File list updates smoothly

✅ **Phase 3 Complete** when:
- Progress bar appears within 300ms of "Start" click
- Modal closes smoothly with brief "Starting..." state
- Zero race conditions observed in 10 test runs

---

## Notes

- **Phase 1 is safe** - removes redundant code, no behavior change
- **Phase 2 is recommended** - fixes timing, minimal risk
- **Phase 3 is optional** - architectural improvement, test user acceptance first

**Estimated time**:
- Phase 1: 15 minutes
- Phase 2: 20 minutes
- Phase 3: 30 minutes
- Testing: 30 minutes per phase

**Total**: 2-3 hours for complete fix with thorough testing
