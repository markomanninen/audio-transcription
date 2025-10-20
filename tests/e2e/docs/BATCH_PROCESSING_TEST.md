# Batch Split & Transcribe E2E Test

## Overview

Comprehensive end-to-end test that validates the batch processing workflow for audio splitting and transcription. This test addresses real-world issues with real-time UI updates during batch operations.

## Test Coverage

### Primary Test: Complete Batch Processing Workflow

**File**: `tests/batch-split-transcribe.spec.ts`

**What It Tests**:

1. **Project Setup**
   - Creates a new project
   - Uploads source audio file
   - Verifies file appears in UI

2. **Split Configuration**
   - Opens Split & Batch dialog
   - Configures chunk duration (2 minutes)
   - Sets overlap (5 seconds)
   - Enables auto-transcription
   - Disables diarization for speed

3. **Batch Execution**
   - Executes split operation
   - Captures success toast notification
   - Extracts expected chunk count

4. **Real-Time UI Updates** ⚠️ **CRITICAL VALIDATION**
   - **File List Updates**: Verifies file list updates to show all chunks
   - **Progress Panel**: Monitors TranscriptionProgress panel updates
   - **Status Badges**: Checks processing/completed status indicators
   - **File Selection**: Validates currently processing file is highlighted

5. **Progress Monitoring**
   - Tracks completion count over time
   - Verifies file count stability (no unexpected additions/removals)
   - Captures screenshots at regular intervals

6. **Completion Notifications**
   - Looks for batch completion toast
   - Verifies final state of all files

7. **Cleanup**
   - Deletes test project and all files

### Secondary Test: Error Handling

**What It Tests**:
- UI stability with invalid split parameters
- Error message display
- Graceful degradation

## Known Issues Being Tested

### Issue #1: File List Not Updating During Batch
**Problem**: After starting batch split and transcription, the file list doesn't update in real-time to show newly created chunks.

**Test Validation**: `waitForFileListUpdate()` function repeatedly checks file count until all chunks appear.

**Expected Behavior**: File list should show 1 source file + N chunk files immediately after split completes.

### Issue #2: TranscriptionProgress Panel Not Updating
**Problem**: The transcription status panel doesn't show real-time progress updates during batch processing.

**Test Validation**: Monitors progress panel for visible updates and logs progress text.

**Expected Behavior**: Panel should show current file being processed and progress percentage.

### Issue #3: No Visual Indication of Active File
**Problem**: No clear indication of which file is currently being transcribed in the batch.

**Test Validation**: Uses `data-batch-current="true"` attribute to identify the currently processing chunk. Verifies:
- Indigo ring styling (`ring-indigo-500`)
- "Processing" badge visibility
- Correct file selection state

**Expected Behavior**: Currently processing file should have:
- Indigo ring border
- "Processing" badge (vs "Batch" for other chunks)
- `data-batch-current="true"` attribute

### Issue #4: Missing Completion Notification
**Problem**: No clear notification when entire batch is complete.

**Test Validation**: Waits for completion toast with success message.

**Expected Behavior**: Toast should appear when all chunks are transcribed.

## Running the Test

### Prerequisites

1. **Backend and Frontend Running**:
   ```bash
   # Option 1: Docker (from project root)
   docker-compose up

   # Option 2: Local dev servers
   # Terminal 1 - Backend
   cd backend && uvicorn app.main:app --reload

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

2. **Test Audio File**:
   - File: `tests/e2e/assets/Kaartintorpantie-clip.m4a`
   - Should be present (already in repo)

### Run the Test

```bash
# From project root
cd tests/e2e

# Run just the batch processing tests
npx playwright test batch-split-transcribe.spec.ts

# Run with UI mode (visual debugging)
npx playwright test batch-split-transcribe.spec.ts --ui

# Run in headed mode (see browser)
npx playwright test batch-split-transcribe.spec.ts --headed

# Run specific test
npx playwright test batch-split-transcribe.spec.ts -g "should split audio"
```

### Environment Variables

- `LOCAL_API_URL`: API base URL (default: `http://127.0.0.1:8000`)
- `USE_DOCKER`: Set to use Docker environment
- `CI`: Set in CI environment (affects retries and workers)

## Screenshot Capture

**Location**: `tests/e2e/screenshots/batch-processing/`

**Captured Screenshots**:
1. `01-app-ready` - Initial application state
2. `02-project-created` - After project creation
3. `03-source-file-uploaded` - Source audio visible
4. `04-split-dialog-open` - Split configuration dialog
5. `05-split-configured` - Settings configured
6. `06-split-success-toast` - Success notification
7. `07-file-list-updated` - File list with all chunks
8. `08-progress-panel-visible` - Progress panel showing
9. `09-progress-updating` - Mid-processing state
10. `10-active-file-selected` - Active file highlighted
11. `11-batch-progress-N` - Progress checkpoints
12. `12-completion-notification` - Final success toast
13. `13-final-state` - Complete workflow state

Screenshots include full page captures with timestamps for debugging.

## Data Attributes for Testing

The FileList component includes data attributes specifically for reliable E2E testing:

### File Card Attributes

Each file card (`[data-component="file-card"]`) includes:

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-file-id` | number | Unique file ID |
| `data-status` | `pending`, `processing`, `completed`, `failed` | Current transcription status |
| `data-selected` | `true`, `false` | Whether file is currently selected by user |
| `data-batch-member` | `true`, `false` | Whether file is part of active batch |
| `data-batch-current` | `true`, `false` | Whether file is currently being processed in batch |

### Test Selectors

```typescript
// Find currently processing batch file
page.locator('[data-component="file-card"][data-batch-current="true"]')

// Find all batch members
page.locator('[data-component="file-card"][data-batch-member="true"]')

// Find selected file
page.locator('[data-component="file-card"][data-selected="true"]')

// Find files by status
page.locator('[data-component="file-card"][data-status="processing"]')
page.locator('[data-component="file-card"][data-status="completed"]')
```

### Visual Styling Verification

```typescript
// Check for indigo ring (currently processing)
const classList = await fileCard.getAttribute('class')
const hasIndigoRing = classList?.includes('ring-indigo-500')

// Check for blue ring (selected)
const hasBlueRing = classList?.includes('ring-blue-500')
```

## Test Configuration

**Timeout**: 5 minutes (300,000ms)
- Allows time for actual transcription processing
- Accounts for model loading on first run

**Model**: `tiny`
- Fastest Whisper model for testing
- Reduces test execution time

**Chunk Settings**:
- Duration: 2 minutes (120 seconds)
- Overlap: 5 seconds
- Expected chunks: Depends on source audio length

**Diarization**: Disabled
- Speeds up processing significantly
- Focus is on batch workflow, not diarization accuracy

## Assertions and Validations

### Critical Assertions

1. **File Count**:
   ```typescript
   expect(finalFileCount).toBeGreaterThanOrEqual(expectedChunkCount + 1)
   ```

2. **Transcription Activity**:
   ```typescript
   expect(processingOrCompleted).toBeGreaterThan(0)
   ```

3. **Source File Present**:
   ```typescript
   await expect(sourceFile).toBeVisible()
   ```

### Soft Validations (Logged, Not Asserted)

- Progress panel visibility (component may vary)
- Active file selection (styling may differ)
- Completion notification (timing may vary)

## Debugging

### If Test Fails

1. **Check Screenshots**:
   ```bash
   open tests/e2e/screenshots/batch-processing/
   ```

2. **View Console Output**:
   - Test logs all major steps
   - Look for ⚠️ warnings indicating issues

3. **Run in Headed Mode**:
   ```bash
   npx playwright test batch-split-transcribe.spec.ts --headed --debug
   ```

4. **Check API Responses**:
   - Test uses API calls for upload/delete
   - Verify backend is running and healthy

### Common Issues

**File List Doesn't Update**:
- Check React Query cache invalidation
- Verify WebSocket or polling is working
- Check browser console for errors

**Progress Panel Not Found**:
- Component selector may have changed
- Update `data-component` attribute
- Check if component is conditionally rendered

**Transcription Doesn't Start**:
- Verify Whisper model is loaded
- Check backend logs for errors
- Ensure auto-transcribe checkbox is checked

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: E2E - Batch Processing

on: [push, pull_request]

jobs:
  batch-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker-compose up -d

      - name: Wait for services
        run: ./scripts/wait-for-healthy.sh

      - name: Install dependencies
        run: cd tests/e2e && npm install

      - name: Run batch test
        run: |
          cd tests/e2e
          npx playwright test batch-split-transcribe.spec.ts

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: batch-test-screenshots
          path: tests/e2e/screenshots/batch-processing/
```

## Future Enhancements

### Planned Improvements

1. **WebSocket Monitoring**:
   - Track real-time events from backend
   - Validate event payloads

2. **Performance Metrics**:
   - Measure time from split to first chunk visible
   - Track total batch processing time

3. **Error Injection**:
   - Test network failures during batch
   - Validate retry logic

4. **Multi-File Batches**:
   - Test splitting multiple source files
   - Validate queue management

5. **Progress Accuracy**:
   - Compare reported progress with actual completion
   - Validate percentage calculations

## Related Documentation

- [Testing Strategy](../../../docs/development/TESTING_STRATEGY.md)
- [Full Workflow Tests](./AUDIO_EDITOR_INTEGRATION_TEST.md)
- [Test Results Guide](../TEST_RESULTS_GUIDE.md)

## Contributing

When modifying this test:

1. Keep screenshot naming sequential and descriptive
2. Log all major steps with timestamps
3. Use `console.log` with step prefixes for clarity
4. Add soft validations (warnings) before hard assertions
5. Update this documentation with new test coverage
