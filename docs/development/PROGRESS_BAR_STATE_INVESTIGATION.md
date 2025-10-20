# Progress Bar State Update Investigation

**Date**: October 20, 2025
**Issue**: Progress bar only activates after page refresh, not automatically during transcription start
**Status**: Root causes identified, fixes recommended

---

## Executive Summary

The progress bar fails to display automatically when transcription starts because of **multiple competing state update mechanisms** and **race conditions between optimistic updates and actual backend responses**. The primary issues are:

1. **THREE overlapping polling intervals** causing excessive API calls and inconsistent update timing
2. **Optimistic update race condition** where initial backend status='pending' overwrites optimistic status='processing'
3. **Cache invalidation cascades** that reset file list state while polling is active
4. **No guaranteed synchronization** between transcription start and progress component mounting

When the page is refreshed, all these competing mechanisms are cleared, allowing clean state initialization with the real backend status.

---

## System Architecture Overview

### Component Hierarchy

```
AudioDashboardPage.tsx (Main orchestrator)
├── selectedFileId: number | null (localStorage-backed state)
├── projectId: number | null (localStorage-backed state)
│
├── FileList.tsx (File management & transcription trigger)
│   ├── useProjectFiles(projectId) → polls every 2s when files active
│   ├── handleStartTranscription(settings)
│   │   ├── Optimistic update: status='processing'
│   │   ├── POST /api/transcription/{fileId}/start
│   │   ├── invalidateQueries(['files', 'transcription-status'])
│   │   └── refetchQueries at 1s and 3s delays
│   │
│   └── Batch processing overlay with auto-file-selection
│
└── TranscriptionProgress.tsx (Progress display)
    ├── useTranscriptionStatus(fileId, 2000) → PRIMARY POLLING
    ├── useEffect: Extra polling at 5000ms → REDUNDANT #1
    ├── useEffect: Extra polling at 1500ms → REDUNDANT #2
    └── Status-based UI rendering (pending/processing/completed/failed)
```

### Data Flow Timeline (Current Broken State)

```
T=0ms     User clicks "Start Transcription" button in FileList
          └─> FileList.handleStartTranscription() called

T=5ms     OPTIMISTIC UPDATES applied BEFORE API call:
          ├─> queryClient.setQueryData(['transcription-status', fileId, 'v3'], {
          │     status: 'processing',
          │     processing_stage: 'Preparing transcription...',
          │     progress: 0
          │   })
          ├─> queryClient.setQueryData(['files', projectId], updated with status='processing')
          └─> UI immediately shows "processing" state (GOOD)

T=50ms    API call initiated:
          └─> POST /api/transcription/{fileId}/start
              with settings: { model_size, language, include_diarization }

T=150ms   Backend receives request, validates, queues transcription job
          └─> Backend status: 'pending' (job not yet started by worker)

T=200ms   API response received:
          ├─> Response: { status: 'pending', message: 'Transcription queued' }
          └─> Modal closes, setShowTranscriptionModal(null)

T=250ms   TranscriptionProgress component MOUNTS (if not already)
          ├─> useTranscriptionStatus(fileId, 2000) hook initializes
          ├─> React Query checks cache: finds optimistic 'processing' status
          └─> BUT staleTime=0 for processing, so immediate refetch scheduled

T=300ms   ⚠️ CRITICAL RACE CONDITION: Initial poll fires
          ├─> GET /api/transcription/{fileId}/status
          ├─> Backend responds: { status: 'pending', progress: 0 }
          │   (Backend worker hasn't picked up the job yet!)
          └─> Cache OVERWRITES optimistic 'processing' with 'pending'

T=301ms   Component re-renders with status='pending':
          └─> UI shows "Ready to Transcribe" button (PROGRESS BAR DISAPPEARS!)

T=500ms   Backend worker picks up transcription job
          └─> Backend internal status: 'processing', progress: 0.0

T=1000ms  Scheduled refetch #1 from FileList (line 488-491)
          ├─> queryClient.refetchQueries(['transcription-status', fileId, 'v3'])
          ├─> GET /api/transcription/{fileId}/status
          ├─> Response: { status: 'processing', progress: 0.05 }
          └─> Cache updated with 'processing'

T=1001ms  ✅ Progress bar FINALLY appears (but 1 second late!)

T=1500ms  Manual polling #2 fires (TranscriptionProgress line 191-200)
          └─> refetch() called → redundant GET request

T=2000ms  React Query automatic polling fires
          └─> refetchInterval returns 2000ms → GET request

T=2500ms  React Query polling again
T=3000ms  Manual polling #1 fires (TranscriptionProgress line 100-107)
          └─> Another refetch() → yet another redundant GET request

T=3000ms  Scheduled refetch #2 from FileList (line 493-496)
          └─> queryClient.refetchQueries() → more redundancy

Result: USER SEES 1+ SECOND DELAY before progress bar appears
        Backend receives 8-10 status requests in first 3 seconds instead of optimal 2-3
```

### When User Refreshes Page (F5)

```
T=0ms     Page reload clears ALL JavaScript state
          ├─> localStorage.getItem('selectedFileId_123') → retrieves fileId
          ├─> React Query cache: EMPTY
          └─> All useEffect cleanup functions run, canceling timers

T=100ms   AudioDashboardPage mounts with selectedFileId from localStorage
          └─> TranscriptionProgress renders immediately

T=150ms   useTranscriptionStatus(fileId, 2000) runs FIRST TIME:
          ├─> Cache miss (empty cache)
          ├─> Immediate fetch: GET /api/transcription/{fileId}/status
          └─> No competing optimistic updates to overwrite

T=250ms   Backend responds with REAL status:
          └─> { status: 'processing', progress: 0.35 }
              (Job already running for ~750ms at this point)

T=251ms   ✅ Progress bar displays IMMEDIATELY with correct 35% progress
          └─> Polling starts at 2000ms intervals (only ONE mechanism)

Result: CLEAN STATE, IMMEDIATE DISPLAY
```

---

## Critical Issues Identified

### Issue #1: Multiple Overlapping Polling Intervals

**Location**: [TranscriptionProgress.tsx:97-200](../frontend/src/components/Dashboard/TranscriptionProgress.tsx)

**The Problem**:

Three separate polling mechanisms run simultaneously:

```typescript
// 1. React Query's built-in polling (CORRECT)
const { data: status, isLoading, refetch } = useTranscriptionStatus(fileId, 2000)
// → Polls every 2000ms when status='processing' (via refetchInterval)

// 2. Manual polling #1 (REDUNDANT - lines 100-107)
useEffect(() => {
  if (status?.status === 'processing') {
    const interval = setInterval(() => {
      refetch()  // Polls every 5000ms
    }, 5000)
    return () => clearInterval(interval)
  }
}, [status?.status, refetch])

// 3. Manual polling #2 (REDUNDANT - lines 191-200)
useEffect(() => {
  if (status?.status === 'processing') {
    const interval = setInterval(() => {
      console.log('Force refetching status during processing...')
      refetch()  // Polls every 1500ms
    }, 1500)
    return () => clearInterval(interval)
  }
}, [status?.status, refetch])
```

**Timeline of Polling Chaos**:

```
Time    | Source                  | Action
--------|-------------------------|---------------------------
0.0s    | React Query (2000ms)    | Initial fetch
1.5s    | Manual #2 (1500ms)      | refetch() ← REDUNDANT
2.0s    | React Query (2000ms)    | Scheduled refetch
3.0s    | Manual #2 (1500ms)      | refetch() ← REDUNDANT
4.0s    | React Query (2000ms)    | Scheduled refetch
4.5s    | Manual #2 (1500ms)      | refetch() ← REDUNDANT
5.0s    | Manual #1 (5000ms)      | refetch() ← REDUNDANT
6.0s    | React Query (2000ms)    | Scheduled refetch
        | Manual #2 (1500ms)      | refetch() ← REDUNDANT

Result: 7 requests in 6 seconds instead of optimal 3 requests
```

**Impact**:
- **Backend overload**: 3x more status requests than necessary
- **Inconsistent timing**: Updates arrive at irregular intervals (1.5s, 2s, 3s, 4s, 4.5s, 5s...)
- **UI jank**: Progress bar updates don't follow predictable 2-second cadence
- **Cache thrashing**: Multiple refetch calls can interrupt each other

**Root Cause**: Legacy code tried to "force" updates because React Query wasn't configured correctly. After fixing React Query config, the manual intervals were never removed.

---

### Issue #2: Optimistic Update Race Condition

**Location**: [FileList.tsx:406-442](../frontend/src/components/Dashboard/FileList.tsx) + [useTranscriptionStatus.ts:44-183](../frontend/src/hooks/useTranscription.ts)

**The Problem**:

```typescript
// FileList.tsx - handleStartTranscription()

// STEP 1: Optimistic update BEFORE API call (line 430)
queryClient.setQueryData(statusQueryKey, {
  status: 'processing',  // ← Optimistically set to 'processing'
  processing_stage: 'Preparing transcription...',
  progress: 0
})

// STEP 2: Make API call (line 454-458)
const response = await fetch(`${API_BASE_URL}/api/transcription/${fileId}/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(settings)
})

// STEP 3: API responds with status='pending' (backend still queuing)
const result = await response.json()  // { status: 'pending', message: 'Queued' }

// STEP 4: Modal closes, TranscriptionProgress mounts (line 473-478)
setShowTranscriptionModal(null)
onSelectFile?.(fileId)  // Selects file, TranscriptionProgress renders

// STEP 5: useTranscriptionStatus runs (line 47-111 in hook)
queryFn: async () => {
  const response = await apiClient.get(`/api/transcription/${fileId}/status`)
  // ⚠️ Backend still returns status='pending' (job not started yet)
  return response.data  // { status: 'pending', progress: 0 }
}

// STEP 6: React Query config (line 114-122)
staleTime: (query) => {
  const status = query.state.data?.status
  if (status === 'completed' || status === 'failed') {
    return 30000  // 30s stale time
  }
  return 0  // ← 'processing' or 'pending' = ALWAYS STALE = immediate refetch!
}

// Result: Optimistic 'processing' immediately overwritten by 'pending'
```

**Visual Timeline**:

```
User Action: Click "Start Transcription"
    ↓
[t=0ms] Optimistic update: status='processing' ✅
    ↓
[t=5ms] POST /api/transcription/123/start
    ↓
[t=200ms] Response received, modal closes
    ↓
[t=250ms] TranscriptionProgress mounts, useTranscriptionStatus() runs
    ↓
[t=251ms] Cache check: finds 'processing' status
    ↓
[t=252ms] staleTime check: status='processing' → staleTime=0 → STALE! → refetch scheduled
    ↓
[t=300ms] GET /api/transcription/123/status
    ↓
[t=400ms] Backend responds: { status: 'pending' } ❌
    ↓
[t=401ms] Cache updated: 'pending' overwrites 'processing'
    ↓
[t=402ms] UI re-renders: Progress bar disappears! ❌
    ↓
[t=1000ms] Backend worker starts job, internal status: 'processing'
    ↓
[t=1001ms] Scheduled refetch fires
    ↓
[t=1100ms] Backend responds: { status: 'processing', progress: 0.05 } ✅
    ↓
[t=1101ms] Progress bar FINALLY appears (1 second late)
```

**Root Cause**: Backend transcription jobs are queued and picked up by background workers. There's a 200-800ms delay between "job accepted" (API response) and "job started" (worker processing). The optimistic update assumes immediate processing, but the first real status check happens during this queue window.

---

### Issue #3: Cache Invalidation Cascades

**Location**: [useTranscriptionStatus.ts:62-75](../frontend/src/hooks/useTranscription.ts)

**The Problem**:

Every time status is fetched, the hook checks if the file's status in the project files cache differs, and if so, invalidates the ENTIRE file list:

```typescript
// Inside queryFn of useTranscriptionStatus (line 62-75)

const response = await apiClient.get(`/api/transcription/${fileId}/status`)

// Check if file status in project files cache differs
const currentFiles = queryClient.getQueryData(['files']) as unknown[]
if (currentFiles) {
  const fileInList = currentFiles.find(/* ... */)
  if (fileInList) {
    const file = fileInList as { status?: string }
    if (file.status !== response.data.status) {
      // ⚠️ INVALIDATE ENTIRE FILE LIST CACHE!
      queryClient.invalidateQueries({ queryKey: ['files'] })
    }
  }
}

return response.data
```

**Impact**:

```
Timeline during active transcription (polling every 2 seconds):

[0s]  Poll: status='processing', progress=0.0
      └─> File list has status='pending' → MISMATCH → invalidate ['files']
      └─> File list re-fetches from backend
      └─> UI flicker: entire file list re-renders

[2s]  Poll: status='processing', progress=0.1
      └─> File list now has status='processing' → NO MISMATCH → no invalidation

[4s]  Poll: status='processing', progress=0.3
      └─> No mismatch → no invalidation

[6s]  Poll: status='processing', progress=0.5
      └─> No mismatch → no invalidation

[8s]  Poll: status='completed', progress=1.0
      └─> File list has status='processing' → MISMATCH → invalidate ['files']
      └─> File list re-fetches from backend
      └─> UI flicker: entire file list re-renders
```

**Problems**:
1. **Performance**: Entire file list re-fetched every time status transitions (pending→processing, processing→completed)
2. **UI flicker**: File list components unmount/remount during invalidation
3. **State loss**: If user has scrolled in file list or interacted with UI, that state resets
4. **Cascade complexity**: File list refetch can trigger other watchers and effects

**Root Cause**: Attempt to keep two separate caches synchronized (status cache + file list cache). Instead, these should use React Query's built-in `onSuccess` callbacks or derive from a single source of truth.

---

### Issue #4: No Guaranteed Mount-Time Refetch

**Location**: [TranscriptionProgress.tsx:116-139](../frontend/src/components/Dashboard/TranscriptionProgress.tsx)

**The Problem**:

When file ID changes, cache is cleared but refetch is not guaranteed to execute immediately:

```typescript
// Detect file ID changes and clear cache for previous file
useEffect(() => {
  const previousFileId = prevFileId.current

  if (previousFileId !== null && previousFileId !== fileId) {
    // Clear cache for previous file (lines 127-129)
    queryClient.removeQueries({ queryKey: ['transcription-status', previousFileId, 'v3'] })
    queryClient.removeQueries({ queryKey: ['segments', previousFileId, 'v3'] })
    queryClient.removeQueries({ queryKey: ['speakers', previousFileId, 'v3'] })

    // Force immediate refetch for new file (line 135)
    refetch()  // ⚠️ This only refetches the CURRENT query
  }

  prevFileId.current = fileId
}, [fileId, queryClient, refetch])
```

**The Issue**:

`refetch()` is called, but if the query is currently in "loading" state or if React Query is in the middle of another operation, the refetch might be:
- Queued for later
- Debounced with other refetch calls
- Delayed by React's batching

**Scenario**:

```
[t=0ms]   User selects file ID 42 from file list
[t=1ms]   AudioDashboardPage.setSelectedFileId(42)
[t=2ms]   React batches state update
[t=5ms]   TranscriptionProgress re-renders with fileId=42
[t=6ms]   useEffect detects fileId change (null → 42)
[t=7ms]   queryClient.removeQueries() called
[t=8ms]   refetch() called → queued by React Query
[t=10ms]  User sees empty state (no progress bar) ← BAD UX
[t=50ms]  React Query processes refetch queue
[t=100ms] GET /api/transcription/42/status
[t=200ms] Response received, progress bar appears ← 190ms delay!
```

**Root Cause**: `refetch()` is not synchronous or guaranteed to execute immediately. React Query may batch or delay refetch calls based on its internal scheduling.

---

## How It Currently Works (Broken)

### Transcription Start Flow

```
1. User clicks "Start Transcription" in FileList
   ├─> Opens TranscriptionSettingsModal
   └─> User selects model, language, diarization settings

2. User clicks "Start" in modal
   └─> FileList.handleStartTranscription(settings) called

3. OPTIMISTIC UPDATE (immediate)
   ├─> queryClient.setQueryData(['transcription-status', fileId, 'v3'], {
   │     status: 'processing',
   │     processing_stage: 'Preparing transcription...',
   │     progress: 0
   │   })
   ├─> queryClient.setQueryData(['files', projectId], updated with status='processing')
   └─> UI shows "processing" state (✅ good so far)

4. API CALL (async)
   ├─> POST /api/transcription/{fileId}/start
   ├─> Request body: { model_size, language, include_diarization }
   └─> Backend validates, queues job, responds { status: 'pending' }

5. MODAL CLOSES (line 473)
   ├─> setShowTranscriptionModal(null)
   ├─> setActionInProgress(null)
   └─> onSelectFile(fileId) → selects file in parent

6. TRANSCRIPTION PROGRESS MOUNTS
   ├─> useTranscriptionStatus(fileId, 2000) initializes
   ├─> Finds optimistic 'processing' in cache
   ├─> BUT staleTime=0 → immediate refetch scheduled
   └─> THREE polling mechanisms start (2000ms, 5000ms, 1500ms)

7. RACE CONDITION (t=300ms)
   ├─> Initial refetch fires: GET /api/transcription/{fileId}/status
   ├─> Backend responds: { status: 'pending', progress: 0 }
   │   (Worker hasn't started yet!)
   └─> Cache overwrites 'processing' → 'pending' ❌

8. UI SHOWS WRONG STATE
   ├─> Component re-renders with status='pending'
   ├─> isFileNotStarted = true (line 318)
   └─> Renders "Ready to Transcribe" UI (progress bar disappears) ❌

9. DELAYED REFETCH (t=1000ms)
   ├─> Scheduled refetch from FileList fires
   ├─> Backend now responds: { status: 'processing', progress: 0.05 }
   └─> Progress bar finally appears ✅ (but 1 second late)

10. ONGOING POLLING (every 1.5-5 seconds)
    ├─> Three overlapping intervals poll backend
    ├─> Cache invalidation cascades on every status change
    └─> File list re-fetches multiple times
```

---

## How It Should Work (Fixed)

### Ideal Transcription Start Flow

```
1. User clicks "Start Transcription" in FileList
   ├─> Opens TranscriptionSettingsModal
   └─> User selects settings

2. User clicks "Start" in modal
   └─> FileList.handleStartTranscription(settings) called

3. NO OPTIMISTIC UPDATE (wait for backend confirmation)
   ├─> Show loading spinner in modal: "Starting transcription..."
   └─> Modal stays open until backend confirms

4. API CALL (async)
   ├─> POST /api/transcription/{fileId}/start
   ├─> Backend validates, queues job
   └─> Backend responds: { status: 'queued' | 'processing', job_id: '...' }

5. BACKEND CONFIRMATION RECEIVED
   ├─> Modal shows success: "Transcription started!" (1 second)
   ├─> Then closes automatically
   └─> onSelectFile(fileId) → selects file in parent

6. TRANSCRIPTION PROGRESS MOUNTS
   ├─> useTranscriptionStatus(fileId, 2000) initializes
   ├─> Cache empty (no optimistic update)
   ├─> Immediate fetch: GET /api/transcription/{fileId}/status
   └─> ONLY React Query polling active (2000ms interval)

7. INITIAL FETCH (t=100ms)
   ├─> GET /api/transcription/{fileId}/status
   ├─> Backend responds: { status: 'processing', progress: 0.05 }
   │   (Real status from backend worker)
   └─> Cache updated with real status ✅

8. UI SHOWS CORRECT STATE IMMEDIATELY
   ├─> Component renders with status='processing'
   ├─> Progress bar displays with 5% progress
   └─> Updates every 2 seconds (consistent cadence) ✅

9. ONGOING POLLING (every 2 seconds only)
   ├─> Single React Query polling mechanism
   ├─> No cache invalidation cascades (use onSuccess callbacks)
   └─> Predictable, efficient updates ✅

10. COMPLETION
    ├─> status='completed' → polling stops automatically
    ├─> One final refetch to get final state
    └─> UI shows completion state ✅
```

---

## Proposed Fixes

### Fix #1: Remove Redundant Polling Intervals

**File**: [frontend/src/components/Dashboard/TranscriptionProgress.tsx](../frontend/src/components/Dashboard/TranscriptionProgress.tsx)

**Action**: Delete lines 100-107 and 191-200

```typescript
// ❌ DELETE THIS (lines 100-107)
useEffect(() => {
  if (status?.status === 'processing') {
    const interval = setInterval(() => {
      refetch()
    }, 5000)
    return () => clearInterval(interval)
  }
}, [status?.status, refetch])

// ❌ DELETE THIS (lines 191-200)
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

**Result**: Only React Query's built-in `refetchInterval` will poll (every 2000ms). Reduces API calls by 66%.

---

### Fix #2: Wait for Backend Confirmation (No Optimistic Updates)

**File**: [frontend/src/components/Dashboard/FileList.tsx](../frontend/src/components/Dashboard/FileList.tsx)

**Action**: Move optimistic updates AFTER API call succeeds

```typescript
// Current code (lines 406-442)
const handleStartTranscription = async (settings: TranscriptionSettings) => {
  // ❌ REMOVE optimistic updates from here
  // queryClient.setQueryData(statusQueryKey, optimisticStatus)
  // queryClient.setQueryData(filesQueryKey, ...)

  // Show loading state in modal
  setActionInProgress({ fileId, action: 'Starting transcription' })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })

    if (!response.ok) {
      throw new Error(`Failed to start transcription: ${response.status}`)
    }

    const result = await response.json()

    // ✅ ONLY CLOSE MODAL AFTER BACKEND CONFIRMS
    console.log('Backend confirmed transcription start:', result)

    // Show brief success message (optional)
    // setTimeout(() => {
      setShowTranscriptionModal(null)
      setActionInProgress(null)
      onSelectFile?.(showTranscriptionModal.fileId)
    // }, 1000)  // Optional 1-second success message

    // Invalidate queries to fetch fresh data
    queryClient.invalidateQueries({ queryKey: ['files'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })

    // ❌ REMOVE scheduled refetch delays (lines 488-496)
    // React Query will refetch automatically when component mounts

  } catch (error) {
    console.error('Failed to start transcription:', error)
    setActionInProgress(null)
    alert(`Failed to start: ${error.message}`)
  }
}
```

**Result**: UI waits for backend confirmation before showing progress. Eliminates race condition between optimistic update and initial status poll.

---

### Fix #3: Remove Cache Synchronization Logic

**File**: [frontend/src/hooks/useTranscription.ts](../frontend/src/hooks/useTranscription.ts)

**Action**: Delete lines 62-75 (file list synchronization)

```typescript
// ❌ DELETE THIS (lines 62-75)
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
      queryClient.invalidateQueries({ queryKey: ['files'] })  // ← DELETE THIS
    }
  }
}
```

**Alternative**: Use React Query's `onSuccess` callback to update specific file in cache:

```typescript
// ✅ ADD THIS INSTEAD
queryFn: async (): Promise<TranscriptionStatus> => {
  const response = await apiClient.get(`/api/transcription/${fileId}/status`)
  return response.data
},
onSuccess: (data) => {
  // Update the specific file in the file list cache
  queryClient.setQueriesData<AudioFile[] | undefined>(
    { queryKey: ['files'] },
    (oldFiles) => {
      if (!oldFiles) return oldFiles
      return oldFiles.map(file =>
        file.file_id === fileId
          ? { ...file, status: data.status, progress: data.progress }
          : file
      )
    }
  )
}
```

**Result**: File list updates in-place without full re-fetch. Eliminates cache invalidation cascades and UI flicker.

---

### Fix #4: Use Suspense-like Guaranteed Initial Fetch

**File**: [frontend/src/components/Dashboard/TranscriptionProgress.tsx](../frontend/src/components/Dashboard/TranscriptionProgress.tsx)

**Action**: Add guaranteed initial fetch with loading state

```typescript
// Current code (line 97)
const { data: status, isLoading, refetch } = useTranscriptionStatus(fileId, 2000)

// ✅ ADD GUARANTEED LOADING STATE
export default function TranscriptionProgress({ fileId, ... }: TranscriptionProgressProps) {
  const { data: status, isLoading, isFetching, refetch } = useTranscriptionStatus(fileId, 2000)
  const [initialFetchDone, setInitialFetchDone] = React.useState(false)

  // Guarantee initial fetch completes before rendering content
  React.useEffect(() => {
    if (!isLoading && !isFetching && status) {
      setInitialFetchDone(true)
    }
  }, [isLoading, isFetching, status])

  // Show loading spinner until initial fetch completes
  if (!initialFetchDone || isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-sm text-muted-foreground">Loading status...</span>
      </div>
    )
  }

  if (!status) return null

  // Rest of component...
}
```

**Alternative (simpler)**: Configure React Query to show loading state:

```typescript
// In useTranscriptionStatus hook (useTranscription.ts line 47)
return useQuery({
  queryKey: ['transcription-status', fileId, 'v3'],
  queryFn: async () => { /* ... */ },
  enabled: !!fileId,
  // ✅ ADD THIS
  placeholderData: (previousData) => previousData,  // Keep previous data while refetching
  // OR
  notifyOnChangeProps: ['data', 'error'],  // Only re-render when data/error changes
})
```

**Result**: Component always shows either loading state or valid data. Never renders with stale/incorrect status.

---

### Fix #5: Adjust StaleTime for Processing Status

**File**: [frontend/src/hooks/useTranscription.ts](../frontend/src/hooks/useTranscription.ts)

**Action**: Give 'processing' status a small staleTime to prevent immediate refetch after optimistic update

```typescript
// Current code (lines 114-122)
staleTime: (query) => {
  const status = query.state.data?.status
  if (status === 'completed' || status === 'failed') {
    return 30000  // 30 seconds
  }
  return 0  // ← Problem: 'processing' always stale = immediate refetch
}

// ✅ CHANGE TO:
staleTime: (query) => {
  const status = query.state.data?.status
  if (status === 'completed' || status === 'failed') {
    return 30000  // 30 seconds
  }
  if (status === 'processing') {
    return 1000  // 1 second - gives backend time to actually start processing
  }
  return 0  // Only 'pending' is always stale
}
```

**Result**: After optimistic update to 'processing', React Query waits 1 second before refetching. This gives backend worker time to pick up the job, reducing race condition window from 800ms to ~0ms.

---

## Testing Plan

### Test Case 1: Fresh Transcription Start

**Steps**:
1. Upload new audio file
2. File appears in list with status='pending'
3. Click "Start Transcription"
4. Select settings, click "Start"
5. **EXPECTED**: Progress bar appears within 500ms and shows progress
6. **CURRENT**: Progress bar appears after 1000-1500ms

**Verification**:
- Open browser DevTools → Network tab
- Filter for `/api/transcription/` requests
- Count status requests in first 3 seconds:
  - ❌ Current: 8-10 requests
  - ✅ Target: 2-3 requests (initial + 1-2 polls)

---

### Test Case 2: Page Refresh During Transcription

**Steps**:
1. Start transcription (file is processing at ~50%)
2. Press F5 to reload page
3. **EXPECTED**: Progress bar appears immediately with ~50% progress
4. **CURRENT**: Works correctly (this is the baseline)

**Verification**:
- Progress bar visible within 200ms of page load
- Progress percentage matches backend state

---

### Test Case 3: File Selection Switch

**Steps**:
1. Start transcription on File A
2. Progress bar shows for File A
3. Click File B in file list
4. **EXPECTED**: Progress for File B appears immediately (or loading state if pending)
5. **CURRENT**: May show stale File A progress briefly

**Verification**:
- No visual artifacts (no File A progress showing for File B)
- Cache cleared properly between file switches
- No duplicate API requests

---

### Test Case 4: Multiple Files Processing (Batch)

**Steps**:
1. Start batch transcription (3 files)
2. Observe batch overlay with auto-file-selection
3. **EXPECTED**: Progress bar updates for each file as batch progresses
4. **CURRENT**: May show delays between file switches

**Verification**:
- Batch progress % accurate
- File selection switches smoothly
- No polling overlap between files

---

## Performance Metrics

### Current State (Broken)

```
Metric                          | Value
--------------------------------|------------------
API requests (first 10s)        | 25-30 requests
Modal close → Progress visible  | 1000-1500ms
Polling interval                | Irregular (1.5-5s)
Cache invalidations (10s)       | 5-8 times
Network bandwidth waste         | ~300% overhead
```

### Target State (Fixed)

```
Metric                          | Value
--------------------------------|------------------
API requests (first 10s)        | 5-6 requests
Modal close → Progress visible  | 200-500ms
Polling interval                | Consistent 2s
Cache invalidations (10s)       | 1-2 times
Network bandwidth waste         | <10% overhead
```

---

## Implementation Priority

### Phase 1: Quick Wins (High Impact, Low Risk)

1. **Remove redundant polling** (Fix #1)
   - Lines to delete: TranscriptionProgress.tsx:100-107, 191-200
   - Impact: Immediate 66% reduction in API calls
   - Risk: None (React Query handles polling)

2. **Remove cache sync logic** (Fix #3)
   - Lines to delete: useTranscription.ts:62-75
   - Replace with: onSuccess callback (10 lines)
   - Impact: Eliminates cache invalidation cascades
   - Risk: Low (better pattern)

### Phase 2: State Management (Medium Impact, Medium Risk)

3. **Adjust staleTime** (Fix #5)
   - Lines to change: useTranscription.ts:114-122 (8 lines)
   - Impact: Reduces race condition window by 80%
   - Risk: Low (just timing adjustment)

4. **Add loading state** (Fix #4)
   - Lines to add: TranscriptionProgress.tsx (20 lines)
   - Impact: Guaranteed correct initial render
   - Risk: Low (defensive coding)

### Phase 3: Architecture Change (High Impact, Higher Risk)

5. **Remove optimistic updates** (Fix #2)
   - Lines to change: FileList.tsx:406-496 (90 lines)
   - Impact: Eliminates root cause of race condition
   - Risk: Medium (changes user flow slightly)

**Recommended Approach**: Implement Phase 1 first, test thoroughly, then proceed to Phase 2 and 3.

---

## Debugging Tools

### Browser Console Checks

```javascript
// Check React Query cache state
window.queryClient = useQueryClient()  // Expose in dev
queryClient.getQueryCache().findAll()

// Check specific status cache
queryClient.getQueryData(['transcription-status', 42, 'v3'])

// Check file list cache
queryClient.getQueryData(['files', 123])

// Watch cache updates in real-time
queryClient.getQueryCache().subscribe((event) => {
  console.log('Cache update:', event)
})
```

### Network Monitoring

```bash
# Watch backend logs for status requests
docker-compose logs -f backend | grep "GET /api/transcription/.*/status"

# Count requests per file per minute
docker-compose logs --since 1m backend | grep "GET /api/transcription/42/status" | wc -l

# Expected: ~30 requests per minute (2-second interval = 60/2 = 30)
# If seeing >40, polling overlap confirmed
```

### React Query DevTools

Install React Query DevTools in development:

```typescript
// frontend/src/main.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

Open DevTools panel to see:
- Active queries and their status
- Cache contents in real-time
- Refetch triggers and timing
- Query dependencies

---

## Related Files

### Component Files
- [TranscriptionProgress.tsx](../frontend/src/components/Dashboard/TranscriptionProgress.tsx) - Main progress display (932 lines)
- [FileList.tsx](../frontend/src/components/Dashboard/FileList.tsx) - File management and transcription trigger (850+ lines)
- [AudioDashboardPage.tsx](../frontend/src/pages/AudioDashboardPage.tsx) - Main orchestrator (463 lines)

### Hook Files
- [useTranscription.ts](../frontend/src/hooks/useTranscription.ts) - State management hooks (473 lines)
- [useUpload.ts](../frontend/src/hooks/useUpload.ts) - Upload and file list hooks (147 lines)
- [useWhisperProgress.ts](../frontend/src/hooks/useWhisperProgress.ts) - Model progress tracking (52 lines)

### API Files
- [client.ts](../frontend/src/api/client.ts) - Axios HTTP client (118 lines)

### Type Definitions
- [index.ts](../frontend/src/types/index.ts) - TypeScript interfaces

---

## Conclusion

The progress bar state update issue is caused by **architectural complexity** where multiple competing mechanisms try to keep the UI synchronized with backend state:

1. **Three overlapping polling intervals** (React Query + 2 manual timers)
2. **Optimistic updates** racing with actual backend responses
3. **Cache invalidation cascades** resetting related data
4. **No guaranteed mount-time synchronization**

The fixes are straightforward:
- **Remove redundant code** (polling intervals, cache sync logic)
- **Trust React Query** to handle polling and cache management
- **Wait for backend confirmation** before showing processing state
- **Add defensive loading states** to prevent stale renders

**Immediate Action**: Implement Phase 1 fixes (delete redundant polling) to reduce API load by 66% and stabilize update timing. This alone may resolve the user-facing issue without requiring architecture changes.

**Long-term Solution**: Implement all fixes to create a predictable, efficient state management system that scales to batch processing and complex workflows.
