# Audio → Text Editor Integration Test

## Overview

This test validates the "Open in Editor" feature that allows users to convert audio transcription segments into a text project and open it in the AI text editor.

## Test Location

**File:** `tests/e2e/tests/ai-text-editor.spec.ts`
**Test Suite:** `AI Text Editor - Audio Transcription Integration`
**Test Name:** `should open transcription segments in text editor`

## What It Tests

### Workflow
1. **Navigate to Audio Dashboard**
   - Loads the audio dashboard page
   - Skips tutorials if present

2. **Find Existing Transcription**
   - Looks for an audio project with completed transcription
   - Selects a file with transcription segments
   - Verifies "Open in Editor" button is visible

3. **Convert to Text Project**
   - Clicks "Open in Editor" button
   - Waits for navigation to `/editor/:projectId`

4. **Verify Editor Content**
   - Confirms textarea is visible and loaded
   - Verifies transcription content is present
   - Checks that content is structured as paragraphs
   - Tests that editor is editable

5. **Confirm Project Creation**
   - Navigates to text projects page
   - Verifies a new text project was created

### Assertions
- ✅ Editor navigation works (URL changes to `/editor/:projectId`)
- ✅ Content is loaded (non-empty text)
- ✅ Content structure is preserved (paragraphs/segments)
- ✅ Editor is functional (can edit text)
- ✅ Text project is created

## Prerequisites

This test requires:
1. **Local development services running:**
   - Frontend: `npm run dev` (http://localhost:5173)
   - Backend: `uvicorn app.main:app --reload` (http://localhost:8000)

2. **Existing audio project with transcription:**
   - At least one audio project
   - At least one file with completed transcription
   - Transcription must have segments

### Using Docker Instead (Optional)
If you prefer to use Docker:
```bash
USE_DOCKER=true npx playwright test ai-text-editor.spec.ts -g "should open transcription segments"
```

## Running the Test

### Option 1: Use the convenience script
```bash
cd tests/e2e
./run-audio-editor-integration-test.sh
```

### Option 2: Run directly with Playwright
```bash
cd tests/e2e
npx playwright test ai-text-editor.spec.ts -g "should open transcription segments"
```

### Option 3: Run with headed browser (watch it execute)
```bash
cd tests/e2e
npx playwright test ai-text-editor.spec.ts -g "should open transcription segments" --headed
```

### Option 4: Debug mode
```bash
cd tests/e2e
npx playwright test ai-text-editor.spec.ts -g "should open transcription segments" --debug
```

## Test Behavior

### If Prerequisites Are Met
The test will:
1. Find the first available audio file with transcription
2. Click "Open in Editor"
3. Verify the editor loads with content
4. Confirm the workflow works end-to-end

### If Prerequisites Are Missing
The test will gracefully skip with a message indicating what's missing:
- `⚠️ No projects available - test requires existing audio project with transcription`
- `⚠️ No audio files found - test requires existing transcription`
- `⚠️ No "Open in Editor" button found - file may not have transcription`

## Setting Up Test Data

### Manual Setup (Local Dev)
1. Start the backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to http://localhost:5173/audio

4. Create an audio project

5. Upload an audio file

6. Start transcription (wait for completion)

7. Run the test

### Using Existing Data
If you already have audio projects with transcriptions in your development database, the test will automatically use them.

## Implementation Details

### Code Fixed
The test validates the fix for the "Open in Editor" feature:

**File:** `frontend/src/pages/AudioDashboardPage.tsx`

**Original Issue:**
```typescript
onOpenEditor={() => {}}  // Empty function - did nothing
```

**Fixed Implementation:**
```typescript
const handleOpenEditor = () => {
  if (!selectedFileId || !segments || !selectedFile) return;

  // Combine all segments into a single text document
  const segmentTexts = segments.map((segment) => {
    const text = segment.edited_text || segment.original_text;
    let speakerName = '';
    if (segment.speaker_id && speakers) {
      const speaker = speakers.find((s) => s.id === segment.speaker_id);
      if (speaker) {
        speakerName = `${speaker.display_name}: `;
      }
    }
    return `${speakerName}${text}`;
  });

  const content = segmentTexts.join('\n\n');
  const projectName = `${selectedFile.original_filename} - Text Edition`;

  createTextProject.mutate(
    {
      name: projectName,
      description: `Text project created from audio transcription: ${selectedFile.original_filename}`,
      content,
    },
    {
      onSuccess: (newProject) => {
        navigate(`/editor/${newProject.id}`);
      },
    }
  );
};
```

### Test Architecture
- Uses Playwright Test framework
- Runs in actual browser (Chromium by default)
- Uses real UI interactions (clicks, navigation)
- Validates actual DOM state and navigation
- Gracefully skips if prerequisites not met

## Troubleshooting

### Test Fails: "No projects available"
**Solution:** Create an audio project with a transcribed file first.

### Test Fails: "Navigation timeout"
**Solution:** Check that:
- Frontend is running on the correct port
- Backend API is responding
- The "Open in Editor" button handler is implemented correctly

### Test Fails: "Editor content is empty"
**Solution:** Verify that:
- The `EditorPage.tsx` uses `useProject()` instead of `useSegments()`
- The `Project` type includes `text_document?: TextDocument`
- The text project was created with content

### Test Skips Every Time
**Solution:**
- Ensure you have at least one completed transcription
- Check browser console for errors
- Verify the "Open in Editor" button appears in the UI

## Related Files

- Test: [tests/e2e/tests/ai-text-editor.spec.ts](./tests/ai-text-editor.spec.ts)
- Script: [tests/e2e/run-audio-editor-integration-test.sh](./run-audio-editor-integration-test.sh)
- Documentation: [tests/e2e/AI_TEXT_EDITOR_TESTS.md](./AI_TEXT_EDITOR_TESTS.md)
- Implementation: [frontend/src/pages/AudioDashboardPage.tsx](../../frontend/src/pages/AudioDashboardPage.tsx)

## Expected Output

```
🧪 Running Audio → Text Editor Integration Test
================================================

Prerequisites:
  - Docker services running (frontend, backend)
  - At least one audio project with completed transcription


Running 1 test using 1 worker

[TEST] Audio → Text Editor Integration
[STEP 1] Navigating to audio dashboard...
[STEP 1] ✅ Audio dashboard loaded
[STEP 2] Looking for audio project with transcription...
[STEP 2] ✅ Found audio file with transcription
[STEP 3] Clicking "Open in Editor" button...
[STEP 3] ✅ Navigated to editor: http://localhost:3000/editor/17
[STEP 4] Verifying transcription content in editor...
[STEP 4] Editor content length: 1247 chars
[STEP 4] ✅ Editor loaded with 79 paragraphs
[STEP 5] Testing editor functionality...
[STEP 5] ✅ Editor is editable
[STEP 6] Navigating back to text projects...
[STEP 6] Found 3 text project(s)
[STEP 6] ✅ Text project created from transcription

[TEST] ✅ Audio → Text Editor Integration PASSED

  1 passed (45.3s)

✅ Test completed!
```

## Maintenance

### When to Update This Test
- If the "Open in Editor" button behavior changes
- If the editor URL structure changes
- If the text project creation API changes
- If the segment formatting logic changes

### Test Longevity
This test is designed to be:
- **Resilient:** Gracefully skips if data is missing
- **Maintainable:** Uses semantic selectors (roles, labels)
- **Informative:** Provides detailed console output
- **Fast:** Runs in ~30-60 seconds with existing data
