# Batch Badge Fix - Final Implementation

**Date**: October 20, 2025
**Issue**: Batch member badge showed "PROCESSING" for wrong files

---

## Problem Statement

When split files were in a batch, the badge logic was incorrect:

**User Report:**
```
1/3 - File A: Status=PENDING, Badge="PROCESSING" ❌ WRONG
2/3 - File B: Status=PENDING, Badge="BATCH" ✓ Correct
3/3 - File C: Status=COMPLETED, No badge ✓ Correct
```

**Expected:**
```
1/3 - File A: Status=PENDING, Badge="BATCH" ✓
2/3 - File B: Status=PENDING, Badge="BATCH" ✓
3/3 - File C: Status=COMPLETED, No badge ✓
```

---

## Root Cause

The badge logic in `FileList.tsx` (lines 697-704) was checking TWO conditions:

```typescript
// OLD CODE (BROKEN):
{file.status === 'processing' ? 'Processing' : isBatchCurrent ? 'Processing' : 'Batch'}
```

This meant:
1. If `file.status === 'processing'` → Show "Processing" ✓ Correct
2. **ELSE IF `isBatchCurrent` → Show "Processing" ❌ WRONG**
3. ELSE → Show "Batch"

The `isBatchCurrent` flag was true for File A (most recent `transcription_started_at`), even though its status was PENDING after a server restart.

---

## Solution

**Simplified badge logic to ONLY check actual file status:**

```typescript
// NEW CODE (FIXED):
{file.status === 'processing' ? 'Processing' : 'Batch'}
```

**File**: `frontend/src/components/Dashboard/FileList.tsx`
**Lines**: 697-702

```typescript
{isBatchMember && (
  <span
    className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${
      file.status === 'processing'
        ? 'bg-indigo-600 text-white'
        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
    }`}
  >
    {file.status === 'processing' ? 'Processing' : 'Batch'}
  </span>
)}
```

---

## Logic Flow

```
Is file a batch member?
├─ No → No badge shown
└─ Yes → Check status
    ├─ status === 'processing' → "Processing" badge (dark indigo)
    └─ Otherwise → "Batch" badge (light indigo)
```

---

## Expected Behavior

### Scenario 1: Files Processing in Parallel
```
File 1: status='processing' → Badge: "Processing" (dark indigo)
File 2: status='processing' → Badge: "Processing" (dark indigo)
File 3: status='pending' → Badge: "Batch" (light indigo)
```

### Scenario 2: After Server Restart (Files Interrupted)
```
File 1: status='pending' → Badge: "Batch" (light indigo)
File 2: status='pending' → Badge: "Batch" (light indigo)
File 3: status='completed' → No badge (not in batch filter)
```

### Scenario 3: Sequential Processing
```
File 1: status='completed' → No badge (batch filter excludes completed)
File 2: status='processing' → Badge: "Processing" (dark indigo)
File 3: status='pending' → Badge: "Batch" (light indigo)
```

---

## Related Fixes

This fix builds on previous batch-related fixes:

1. **Batch Auto-Detection** (lines 93-98): Only includes `processing` or `pending` files, excludes `completed`
2. **Current File Detection** (lines 170-201): Uses `transcription_started_at` to find most recent processing file
3. **Batch Overlay Lifecycle**: Appears when 2+ files processing/pending, disappears after completion

---

## Testing

### Manual Testing Steps

1. **Upload audio file** (e.g., "Kaaritorpantie - Rainer 5min.mp3")
2. **Split into 3 parts** using split button
3. **Verify badges BEFORE starting**:
   - All 3 files: "BATCH" badge (light indigo)
4. **Click "Start All"**
5. **Verify badges DURING transcription**:
   - Processing files: "Processing" badge (dark indigo)
   - Pending files: "Batch" badge (light indigo)
6. **Verify badges AFTER completion**:
   - Completed files: No badge shown

### Automated Testing

Test file created: `tests/e2e/tests/batch-badge-verification.spec.ts`

The test verifies:
- TYPE CHECK 1: Single file, no badge
- TYPE CHECK 2: After split, all show "Batch"
- TYPE CHECK 3: After starting, processing files show "Processing"
- TYPE CHECK 4: After completion, no badges on completed files
- TYPE CHECK 5: Final state verification

---

## User Feedback Addressed

> "YOU BROKE EVERYTHING AGAIN; NOW LIST IS: 1/3 shows PROCESSING even though it's PENDING"

**Root cause**: Badge logic checked `isBatchCurrent` in addition to `file.status`

**Fix**: Removed `isBatchCurrent` check, badge now purely based on actual file status

**Result**: Badges accurately reflect file state at all times

---

## Summary

✅ **Badge logic simplified**: Only checks `file.status`
✅ **No more false "Processing"**: PENDING files correctly show "Batch"
✅ **Parallel transcription supported**: Multiple files can show "Processing" simultaneously
✅ **Server restart recovery**: Interrupted files show "Batch", not "Processing"

**Total lines changed**: 6 lines
**Files modified**: 1 file (`frontend/src/components/Dashboard/FileList.tsx`)

---

**Implementation Complete**: October 20, 2025 05:15 UTC
