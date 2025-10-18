# Setting Up Test Data for Audio → Editor Integration Test

The test requires an existing audio project with completed transcription. Here are quick ways to set it up:

## Option 1: Use Your Existing Data

If you already have the "test" project with "Kaaritorpantie - Rainer 4min.mp3" transcribed:

1. Make sure backend and frontend are running:
   ```bash
   # Terminal 1
   cd backend && uvicorn app.main:app --reload

   # Terminal 2
   cd frontend && npm run dev
   ```

2. Navigate to http://localhost:5173/audio

3. Select the "test" project

4. You should see "Kaaritorpantie - Rainer 4min.mp3" with transcription

5. Run the test:
   ```bash
   ./run-audio-editor-integration-test.sh
   ```

## Option 2: Quick Manual Setup (5-10 minutes)

1. Start services (if not running):
   ```bash
   # Terminal 1
   cd backend && uvicorn app.main:app --reload

   # Terminal 2
   cd frontend && npm run dev
   ```

2. Open http://localhost:5173/audio

3. Create a new audio project:
   - Click "New Project"
   - Name: "E2E Test Project"
   - Click "Create"

4. Upload a test audio file:
   - Use `tests/e2e/assets/Kaartintorpantie-clip.m4a`
   - Or any short audio file you have

5. Start transcription:
   - Click "Start Transcription"
   - Select "tiny" model (fastest)
   - Uncheck diarization (faster)
   - Click "Start"
   - Wait ~1-2 minutes for completion

6. Run the test:
   ```bash
   ./run-audio-editor-integration-test.sh
   ```

## Option 3: Use Existing "test" Project

If you have the "test" project but need to select it:

1. Go to http://localhost:5173/audio

2. In the project selector dropdown, select "test"

3. Check if "Kaaritorpantie - Rainer 4min.mp3" has transcription
   - Look for the "Open in Editor" button
   - If present, transcription is complete!

4. Run the test:
   ```bash
   ./run-audio-editor-integration-test.sh
   ```

## What the Test Expects

The test will:
1. Navigate to `/audio`
2. Look for the first file card
3. Check if "Open in Editor" button exists
4. If found → run the test
5. If not found → skip gracefully (as you just saw)

## Current Status

Based on your test output:
```
[STEP 2] ⚠️ No audio files found - test requires existing transcription
```

This means:
- ✅ Test is working correctly
- ✅ Local dev mode is active (port 5173)
- ⚠️ No audio project is currently selected OR no files in the project
- ⚠️ Need to either select "test" project or create new test data

## Quick Fix

The fastest way is probably to just select the "test" project in your browser:

1. Open http://localhost:5173/audio
2. In the top bar, select "test" from the project dropdown
3. Verify you see "Kaaritorpantie - Rainer 4min.mp3"
4. Run the test again

That should make it pass! 🎯
