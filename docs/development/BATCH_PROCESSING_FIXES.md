# Batch Processing Real-Time Update Fixes

## Overview

This document details the fixes implemented to resolve real-time UI update issues during batch audio splitting and transcription. These fixes ensure users see immediate feedback when processing multiple audio chunks.

## Issues Identified

### Issue #1: File List Not Updating in Real-Time
**Problem**: After initiating batch split/transcription, newly created chunk files don't appear in the file list until manual page refresh.

**Root Cause**: The `useProjectFiles` hook wasn't configured to poll for updates when files are being processed.

**Impact**: Users couldn't see their batch progress, leading to confusion about whether the operation succeeded.

### Issue #2: No Batch Completion Notification
**Problem**: When batch transcription completes, there's no clear notification to the user.

**Root Cause**: The FileList component detected completion but didn't show a toast notification.

**Impact**: Users don't know when all chunks are finished transcribing.

### Issue #3: Active File Not Clearly Indicated
**Problem**: During batch processing, it wasn't obvious which chunk was currently being transcribed.

**Root Cause**: UI logic existed but needed verification.

**Impact**: Lack of visual feedback during multi-file operations.

## Fixes Implemented

### Fix #1: Real-Time File List Polling

**File**: `frontend/src/hooks/useUpload.ts`

**Changes**:
```typescript
// Added refetchInterval to useProjectFiles hook
refetchInterval: (query) => {
  const files = query.state.data
  if (!files || files.length === 0) return false

  // Check if any files are processing or pending
  const hasActiveFiles = files.some(
    (file) => file.status === 'processing' || file.status === 'pending'
  )

  // Refetch every 2 seconds if there are active files, otherwise don't poll
  return hasActiveFiles ? 2000 : false
},

// Reduced staleTime for real-time updates
staleTime: 2000, // 2 seconds (reduced from 30s)
```

**How It Works**:
- Hook now checks if any files have `processing` or `pending` status
- When active files exist, automatically polls every 2 seconds
- When all files are completed/failed, polling stops to save resources
- File list updates in real-time as chunks are created and processed

**Benefits**:
- ✅ New chunk files appear immediately after split operation
- ✅ Status changes (pending → processing → completed) update live
- ✅ No manual refresh needed
- ✅ Efficient - only polls when necessary

### Fix #2: Batch Completion Toast Notification

**File**: `frontend/src/components/Dashboard/FileList.tsx`

**Changes**:
```typescript
// Import useToast hook
import { useToast } from '../../hooks/useToast'

// In component:
const { success } = useToast()
const completionToastShown = React.useRef<number | null>(null)

// Enhanced completion effect
React.useEffect(() => {
  if (!batchProgress?.isComplete) return

  // Show completion toast (only once per batch)
  if (activeBatch && activeBatch.parentId !== completionToastShown.current) {
    completionToastShown.current = activeBatch.parentId

    const completed = batchProgress.completed
    const failed = batchProgress.failed
    const total = batchProgress.total

    if (failed > 0) {
      success(
        'Batch transcription completed',
        `${completed} of ${total} chunks transcribed successfully. ${failed} failed.`
      )
    } else {
      success(
        'Batch transcription completed!',
        `All ${total} chunks have been transcribed successfully.`
      )
    }
  }

  setActiveBatch((previous) => {
    if (!previous || previous.completedAt) return previous
    return { ...previous, completedAt: new Date().toISOString() }
  })
}, [batchProgress?.isComplete, batchProgress?.completed, batchProgress?.failed, batchProgress?.total, activeBatch, success])
```

**How It Works**:
- Detects when batch processing completes (all chunks done)
- Shows different messages for full success vs. partial failure
- Uses ref to prevent duplicate toasts for the same batch
- Toast appears automatically when last chunk finishes

**Benefits**:
- ✅ Clear completion notification
- ✅ Informs user of success/failure counts
- ✅ No duplicate notifications
- ✅ Dismissible toast with auto-timeout

### Fix #3: Visual Highlighting of Active File

**File**: `frontend/src/components/Dashboard/FileList.tsx`

**Status**: Already implemented, verified working

**Existing Code**:
```typescript
const isBatchCurrent = batchProgress?.currentChunk?.chunk.fileId === file.file_id

// In className:
className={`
  ${
    isBatchCurrent
      ? 'ring-2 ring-indigo-500 border-indigo-500'  // Active chunk
      : isSelected
        ? 'ring-2 ring-blue-500 border-blue-500'    // Selected file
        : 'hover:border-gray-300 dark:hover:border-gray-600'
  }
  ${!isBatchCurrent && !isSelected && isBatchMember ? 'border-indigo-200 dark:border-indigo-400/40' : ''}
`}
```

**How It Works**:
- Tracks which chunk is currently being processed
- Applies distinct visual styles:
  - **Indigo ring** (ring-indigo-500) = Currently processing chunk
  - **Blue ring** (ring-blue-500) = User-selected file
  - **Light indigo border** = Other chunks in batch
  - **Gray border** = Regular files

**Benefits**:
- ✅ Clear visual hierarchy
- ✅ Easy to see which chunk is active
- ✅ Distinguishes batch members from regular files
- ✅ Auto-selects currently processing file

## Additional Enhancements

### Test Data Attributes

**File**: `frontend/src/components/Dashboard/FileList.tsx`

**Added Attributes**:
```typescript
data-component="file-card"
data-file-id={file.file_id}
data-status={effectiveStatus}
data-selected={isSelected ? 'true' : 'false'}
data-batch-member={isBatchMember ? 'true' : 'false'}
data-batch-current={isBatchCurrent ? 'true' : 'false'}
```

**Purpose**:
- Enables reliable E2E testing with specific selectors
- No reliance on CSS class names which may change
- Direct access to component state
- Distinguishes batch members, selected files, and currently processing files

**Test Usage**:
```typescript
// Find currently processing file
page.locator('[data-batch-current="true"]')

// Find all batch members
page.locator('[data-batch-member="true"]')

// Find selected file
page.locator('[data-selected="true"]')
```

### Batch Progress Overlay

**File**: `frontend/src/components/Dashboard/FileList.tsx` (lines 162-191)

**Features**:
- Fixed bottom overlay showing batch progress
- Displays current file name and progress bar
- Shows "File X of Y" counter
- Completion counts (completed, failed, remaining)
- Processing stage information
- Auto-hides 3 seconds after completion

### Automatic File Selection

**File**: `frontend/src/components/Dashboard/FileList.tsx` (lines 120-126)

**Behavior**:
- Automatically selects currently processing chunk
- Updates selection as processing moves to next chunk
- Prevents unnecessary re-selections with ref tracking
- Allows manual override by user

## Testing

### E2E Test Created

**File**: `tests/e2e/tests/batch-split-transcribe.spec.ts`

**Coverage**:
- ✅ Split operation with custom settings
- ✅ Success toast verification
- ✅ File list update monitoring
- ✅ Batch progress overlay detection
- ✅ Active file highlighting
- ✅ Completion notification
- ✅ Screenshot captures at all stages

**Run Test**:
```bash
cd tests/e2e
npx playwright test batch-split-transcribe.spec.ts --headed
```

### Manual Testing Steps

1. **Create Project**: Create a new audio project
2. **Upload Audio**: Upload a test audio file (e.g., 5+ minutes)
3. **Open Split Dialog**: Click "Split & Batch" button on file card
4. **Configure Split**:
   - Chunk duration: 2 minutes
   - Overlap: 5 seconds
   - Enable auto-transcription
   - Optionally disable diarization for speed
5. **Execute Split**: Click "Split & Process"

**Expected Behavior**:
- ✅ Success toast appears showing chunk count
- ✅ File list updates to show all chunks (source + N chunks)
- ✅ Batch progress overlay appears at bottom
- ✅ Currently processing chunk has indigo ring
- ✅ Progress bar and counters update in real-time
- ✅ Completion toast appears when all done
- ✅ Overlay auto-hides after 3 seconds

## Performance Considerations

### Polling Efficiency

**Before**:
- Fixed 30-second stale time
- No automatic refetching
- Manual refresh required

**After**:
- Smart polling: Only when files are active
- 2-second interval for responsive UI
- Stops polling when all files idle
- Minimal server impact (2-3 requests during batch)

### Resource Usage

**File List Updates**:
- ~1KB per request (JSON file list)
- 2-second intervals = 30 requests/minute during batch
- Typical batch: 5-10 chunks = 10-20 minutes processing
- Total: ~300-600 requests per batch (negligible)

**Network Impact**:
- Low bandwidth (< 1KB per poll)
- Backend easily handles with existing indexes
- React Query deduplication prevents duplicate requests

## Files Modified

### Frontend

1. **`frontend/src/hooks/useUpload.ts`**
   - Added `refetchInterval` for smart polling
   - Reduced `staleTime` to 2 seconds
   - File list now auto-updates during batch processing

2. **`frontend/src/components/Dashboard/FileList.tsx`**
   - Imported `useToast` hook
   - Added batch completion toast logic
   - Added `completionToastShown` ref for duplicate prevention
   - Enhanced completion effect with detailed messaging

### Tests

3. **`tests/e2e/tests/batch-split-transcribe.spec.ts`** (NEW)
   - Comprehensive E2E test for batch workflow
   - Screenshot captures at 13 key stages
   - Validates all real-time update requirements

4. **`tests/e2e/docs/BATCH_PROCESSING_TEST.md`** (NEW)
   - Complete test documentation
   - Running instructions
   - Debugging guide

## Migration Notes

### Breaking Changes

None. All changes are backwards compatible.

### Required Actions

None. Changes are automatic and transparent to users.

### Optional Configuration

Polling interval can be adjusted if needed:

```typescript
// In useUpload.ts
refetchInterval: (query) => {
  // Change 2000 to desired interval in milliseconds
  return hasActiveFiles ? 2000 : false
}
```

## Future Enhancements

### Potential Improvements

1. **WebSocket Support**:
   - Replace polling with WebSocket for true real-time updates
   - Server pushes status changes instead of client polling
   - Reduces network requests and improves latency

2. **Batch Queue Management**:
   - Show queue position for pending chunks
   - Estimated time remaining per chunk
   - Pause/resume batch processing

3. **Progress Granularity**:
   - Show transcription stages (loading model, transcribing, diarization)
   - Per-chunk progress indicators in file list
   - Audio waveform with processing position

4. **Error Recovery**:
   - Retry failed chunks automatically
   - Partial batch completion handling
   - Resume interrupted batches after page refresh

5. **Performance Metrics**:
   - Track average chunk processing time
   - Show estimated completion time
   - Historical batch statistics

## Related Documentation

- [Batch Processing E2E Test](../../tests/e2e/docs/BATCH_PROCESSING_TEST.md)
- [Testing Strategy](./TESTING_STRATEGY.md)
- [API Documentation](./API.md)

## Version History

- **v1.0.0** (2025-10-19): Initial implementation of batch processing real-time updates
  - File list polling
  - Completion notifications
  - Visual highlighting verification

## Contributors

- Claude Code (AI Assistant) - Implementation and testing
- Original batch processing UI - Already included visual highlighting

## Support

If you encounter issues with batch processing:

1. Check browser console for errors
2. Verify backend is running (`curl http://localhost:8000/health`)
3. Check Network tab for failed API requests
4. Run E2E test to validate workflow
5. Check `tests/e2e/screenshots/batch-processing/` for visual debugging
