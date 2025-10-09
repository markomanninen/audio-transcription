# Phase 1 Test Validation - Cache Isolation

## Objective
Verify that cache keys are properly isolated per file and no data contamination occurs when switching between files.

## Pre-Test Setup
1. Navigate to http://localhost:3000
2. Open Browser DevTools (F12)
3. Open Console tab
4. Enable "Verbose" logging if available

## Test Scenario 1: Cache Key Uniqueness

### Steps:
1. Create a new project called "Cache Test"
2. Upload 2 audio files (File A and File B)
3. Start transcription on File A
4. Wait for ~10 seconds
5. Switch to File B in the file list
6. Switch back to File A

### Expected Console Output:
```
[useTranscriptionStatus] Fetching status for file 1
[useTranscriptionStatus] File 1 status: processing
[App] File switched from 1 to 2 - clearing cache for file 1
[useTranscriptionStatus] Fetching status for file 2
[useTranscriptionStatus] File 2 status: pending
[App] File switched from 2 to 1 - clearing cache for file 2
[useTranscriptionStatus] Fetching status for file 1
[useTranscriptionStatus] File 1 status: processing
```

### Validation Criteria:
- ✅ Each file fetch shows correct file ID
- ✅ Cache is cleared when switching files
- ✅ File status matches the selected file
- ✅ No File B data appears when viewing File A

---

## Test Scenario 2: Data Attributes Verification

### Steps:
1. With 2 files in project, select File A
2. In DevTools Console, run:
```javascript
document.querySelector('[data-component="transcription-progress"]')
```
3. Inspect the data attributes

### Expected Output:
```javascript
{
  dataset: {
    component: "transcription-progress",
    fileId: "1",
    status: "processing",
    progress: "45",
    testid: "transcription-progress-1"
  }
}
```

### Validation Criteria:
- ✅ `data-file-id` matches selected file
- ✅ `data-status` reflects actual file status
- ✅ `data-progress` matches file progress
- ✅ Each file switch updates these attributes correctly

---

## Test Scenario 3: React Query Cache Inspection

### Steps:
1. Open React Query DevTools (bottom-left corner icon or install extension)
2. Observe cached queries
3. Switch between File A and File B multiple times
4. Watch cache entries appear/disappear

### Expected Behavior:
```
Active Queries:
  ['transcription-status', 1, 'v3'] - fresh
  ['segments', 1, 'v3'] - stale

// After switching to File 2:
Active Queries:
  ['transcription-status', 2, 'v3'] - fresh
  ['segments', 2, 'v3'] - stale

// File 1 queries should be removed from cache
```

### Validation Criteria:
- ✅ Cache keys include file ID and 'v3' version
- ✅ Previous file queries are removed on switch
- ✅ No overlap between File 1 and File 2 cache entries
- ✅ GC time keeps cache small (queries removed after 1-10 seconds)

---

## Test Scenario 4: Rapid File Switching

### Steps:
1. Click File A
2. Immediately click File B (within 1 second)
3. Immediately click File A again
4. Wait 2 seconds
5. Observe the displayed data

### Expected Behavior:
- Data eventually settles on correct file
- No flickering between file data
- Console shows proper cleanup

### Validation Criteria:
- ✅ Final displayed data matches selected file
- ✅ No error messages in console
- ✅ Cache cleanup completes successfully
- ✅ UI is stable and shows correct information

---

## Test Scenario 5: Multiple Files Processing Simultaneously

### Steps:
1. Upload 3 audio files
2. Start transcription on File 1
3. Switch to File 2 and start transcription
4. Rapidly switch between File 1, File 2, File 3
5. Observe each file's status

### Expected Behavior:
- File 1 shows its own progress (e.g., 45%)
- File 2 shows its own progress (e.g., 12%)
- File 3 shows "pending" status
- No cross-contamination of progress values

### Validation Criteria:
- ✅ Each file maintains separate progress state
- ✅ Switching files shows correct progress immediately
- ✅ No File 1 progress appears on File 2 or File 3
- ✅ Console logs show distinct file IDs

---

## Test Scenario 6: Browser Refresh During File Switch

### Steps:
1. Select File A with transcription in progress
2. Note the progress percentage (e.g., 45%)
3. Refresh browser (F5)
4. Verify File A is re-selected
5. Check progress matches backend

### Expected Behavior:
- File A re-selected automatically
- Progress loads fresh from backend
- No stale cache data

### Validation Criteria:
- ✅ Progress accurate after refresh
- ✅ No cached incorrect data
- ✅ Console shows fresh fetch

---

## Common Issues & Solutions

### Issue 1: File A data appears when viewing File B
**Root Cause:** Cache keys not unique enough or not cleared
**Solution:** Verify 'v3' appears in all cache keys, check console logs for cache clearing

### Issue 2: Stale data persists after file switch
**Root Cause:** Cache not being invalidated
**Solution:** Check that `removeQueries` is being called in App.tsx

### Issue 3: Console errors about missing dependencies
**Root Cause:** useEffect dependency array missing variables
**Solution:** Verify all hooks have correct dependencies

---

## Success Criteria Summary

Phase 1 is successful if:
1. ✅ All cache keys include file ID and 'v3' version suffix
2. ✅ Switching files clears previous file cache
3. ✅ Data attributes correctly reflect current file
4. ✅ No data contamination between files
5. ✅ Console logs show proper cache operations
6. ✅ React Query DevTools shows isolated cache entries
7. ✅ Rapid file switching works without errors
8. ✅ Multiple files processing maintain separate states

---

## Notes
- Test in development mode to see console logs
- Use both Chrome and Firefox if possible
- Test with slow network throttling (DevTools > Network > Slow 3G)
- Monitor memory usage (DevTools > Memory > Take Snapshot)
