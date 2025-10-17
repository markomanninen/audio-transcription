# Playwright E2E Test Guide

## Overview

This guide explains how to run and validate the Playwright end-to-end tests for the audio transcription application.

## Quick Start

### Run All Tests (Fast - Uses Transcription Stub)
```bash
./scripts/run_local_e2e.sh
```

### Run Whisper-Specific Tests (Real Model - Must Run Alone)
```bash
# ✅ Correct: Run Whisper tests in isolation
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"

# ❌ Don't run with other tests - causes resource contention
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh
```

## Test Modes

### 1. Stub Mode (Default - Recommended for Most Tests)
- **Purpose**: Fast UI/behavior testing
- **Speed**: 30-60 seconds for full suite
- **Uses**: Mock transcription (instant completion)
- **Best for**: UI tests, cache isolation, status updates
- **Command**: `./scripts/run_local_e2e.sh`

### 2. Real Whisper Mode (Only for Whisper Tests)
- **Purpose**: Validate actual Whisper model download/loading
- **Speed**:
  - **First run**: 1-2 minutes (downloads tiny model 39MB + loads + transcribes)
  - **Cached**: 40-60 seconds (loads cached model + transcribes)
- **Uses**: Real Whisper tiny model (~39MB download)
- **Best for**: Model download progress, real transcription
- **Command**: `USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"`

**⚠️ WARNING**: Running the full test suite with `USE_TRANSCRIPTION_STUB=0` causes:
- Tests to skip (waiting for completions that take minutes)
- Timeouts (multiple tests fighting for single Whisper instance)
- Long execution times (9+ minutes)

**Solution**: Use stub mode for general testing, real Whisper only for `@whisper-real` tagged tests.

## Status

**Current State**:

- ✅ Local E2E test runner (`scripts/run_local_e2e.sh`)
- ✅ Playwright configuration (`tests/e2e/playwright.local.config.ts`)
- ✅ Transcription stub for fast testing
- ✅ Real Whisper tests tagged with `@whisper-real`
- ✅ Comprehensive test coverage:
  - Health checks
  - Cache isolation
  - Status consistency
  - Force restart flows
  - Whisper model loading
  - Transcription completion

## Installation

### 1. Install Playwright Dependencies

```bash
cd tests/e2e
npm install
npx playwright install
```

This will:

- Install `@playwright/test` package
- Download browser binaries (Chromium, Firefox)

### 2. Verify Installation

```bash
npx playwright --version
```

Should output something like: `Version 1.48.2`

## Running Tests

### Recommended: Use the Local E2E Runner

The `run_local_e2e.sh` script handles all the setup automatically:

```bash
# Run all tests with stub (fast)
./scripts/run_local_e2e.sh

# Run only Whisper tests with real model
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"

# Run specific test by name
./scripts/run_local_e2e.sh --grep "Dashboard Ready"

# Run tests in headed mode (show browser)
./scripts/run_local_e2e.sh --headed

# Debug mode
./scripts/run_local_e2e.sh --debug
```

The script automatically:
- Starts backend on a random port
- Starts frontend dev server on a random port
- Runs tests against the isolated environment
- Cleans up processes when done

### Manual Test Running (Advanced)

If you need more control:

#### Option 1: Run All Tests (Stub Mode)

```bash
cd tests/e2e
npm test
```

This runs all tests in headless mode with transcription stub.

#### Option 2: Run with Browser UI (Headed Mode)

```bash
cd tests/e2e
npm run test:headed
```

Watch tests execute in real browser windows.

#### Option 3: Debug Mode

```bash
cd tests/e2e
npm run test:debug
```

Opens Playwright Inspector for step-by-step debugging.

#### Option 4: Run Tests by Tag

```bash
# Only Whisper-specific tests (requires real model)
USE_TRANSCRIPTION_STUB=0 npm test -- --grep "@whisper-real"

# Exclude Whisper tests (fast, stub only)
npm test -- --grep-invert "@whisper-real"
```

#### Option 5: Run Specific Test File

```bash
cd tests/e2e
npx playwright test file-cache-isolation.spec.ts
```

#### Option 6: Run Specific Test Case

```bash
cd tests/e2e
npx playwright test -g "should show correct data attributes"
```

### Test Tags

Tests are organized with tags for targeted execution:

- **`@whisper-real`**: Tests requiring actual Whisper model (slow)
  - Model download progress
  - Real transcription lifecycle

- **No tag**: Fast UI tests using stub
  - Cache isolation
  - Status updates
  - Force restart flows
  - Dashboard behavior

## Test Suites

### 1. Health Check Tests (`health.spec.ts`)

- ✅ Frontend loads successfully
- ✅ Backend API is accessible

**Run**:

```bash
npx playwright test health.spec.ts
```

### 2. File Cache Isolation Tests (`file-cache-isolation.spec.ts`)

#### Test Cases

1. **Data Attributes Test**
   - Verifies `data-component`, `data-file-id`, `data-testid` exist
   - Checks TranscriptionProgress, SegmentList, SpeakerManager, AudioPlayer

2. **File Switch Data Attribute Update**
   - Switches between files
   - Verifies `data-file-id` updates correctly

3. **Console Logging Test**
   - Captures console logs during file switches
   - Verifies cache clearing logs appear (dev mode)

4. **Cache Separation Test**
   - Checks React Query cache isolation
   - Verifies old file queries removed when switching

5. **Stale Data Prevention**
   - Switches files
   - Ensures File A data doesn't appear on File B

6. **Rapid Switching Stress Test**
   - Switches files 10 times rapidly
   - Verifies no errors occur

7. **Cache Key Versioning**
   - Checks API calls use correct endpoints
   - Verifies status API is called properly

**Run**:

```bash
npx playwright test file-cache-isolation.spec.ts
```

## Test Requirements

### Prerequisites

**For Full Test Coverage**:

1. Docker services running:

   ```bash
   docker-compose up
   ```

2. At least one project with 2+ audio files:
   - File 1: In progress or completed transcription
   - File 2: Different status (pending/completed)

3. Frontend accessible at <http://localhost:3000>
4. Backend accessible at <http://localhost:8000>

**Note**: Some tests will skip if requirements aren't met (e.g., multiple files).

## Test Data Setup

### Option 1: Manual Setup (Before Running Tests)

1. Open <http://localhost:3000>
2. Create project "Test Project"
3. Upload 2-3 audio files
4. Start transcription on at least one file
5. Run tests

### Option 2: Automated Seed Data (Future Enhancement)

Create a seed script to populate test data:

```bash
cd backend
python scripts/seed_test_data.py
```

*Note: This script doesn't exist yet - would need to be created*

## Understanding Test Results

### Successful Run

```
Running 10 tests using 2 workers

  ✓ health.spec.ts:4:5 › Application Health › frontend loads successfully (1.2s)
  ✓ health.spec.ts:9:5 › Application Health › backend API is accessible (0.5s)
  ✓ file-cache-isolation.spec.ts:8:5 › File Cache Isolation › should show correct data attributes (2.1s)
  ✓ file-cache-isolation.spec.ts:35:5 › File Cache Isolation › should have data attributes on segment list (1.5s)
  ...

  10 passed (18.5s)
```

### Failed Test Example

```
  1) file-cache-isolation.spec.ts:95:5 › File Cache Isolation › should not show stale data

    Error: expect(received).not.toBe(expected)

    Expected: not "1"
    Received: "1"

    File IDs should be different but both are "1"
```

This would indicate cache isolation is broken.

### Skipped Tests

```
  ○ file-cache-isolation.spec.ts:45:5 › should update when switching files [skipped]

  Reason: Not enough files in project (requires 2+)
```

Tests skip gracefully if prerequisites aren't met.

## Viewing Test Reports

After running tests:

```bash
npm run report
```

Opens HTML report in browser with:

- Test results
- Screenshots (on failure)
- Video recordings (on failure)
- Trace files for debugging

## Debugging Failed Tests

### 1. Run in Debug Mode

```bash
npx playwright test --debug file-cache-isolation.spec.ts
```

### 2. View Trace

If test fails, trace file is saved automatically:

```bash
npx playwright show-trace test-results/file-cache-isolation-*/trace.zip
```

### 3. Check Screenshots

Failed tests automatically capture screenshots:

```
test-results/
  file-cache-isolation-should-not-show-stale-data/
    test-failed-1.png
```

### 4. Enable Video Recording

Edit `playwright.config.ts`:

```typescript
use: {
  video: 'on', // Record video for all tests
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Start Services
        run: docker-compose up -d

      - name: Install Playwright
        run: |
          cd tests/e2e
          npm install
          npx playwright install --with-deps

      - name: Run Tests
        run: |
          cd tests/e2e
          npm test

      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: tests/e2e/playwright-report/
```

## Test Coverage

### Current Coverage

- ✅ Data attributes verification
- ✅ File switching behavior
- ✅ Cache isolation (basic)
- ✅ Error handling (rapid switching)
- ✅ Console logging validation

### Future Enhancements

- [ ] Test with actual file uploads
- [ ] Test transcription progress updates
- [ ] Test segment editing isolation
- [ ] Test speaker manager isolation
- [ ] Test audio player synchronization
- [ ] Performance benchmarks
- [ ] Memory leak detection

## Common Issues

### Issue 1: Tests Skipping When Using Real Whisper

**Symptoms**:
- 12+ tests skipped
- Messages like "No completed files found"
- Tests timing out

**Cause**: Running full test suite with `USE_TRANSCRIPTION_STUB=0` causes tests to wait for real transcriptions (5+ minutes each).

**Solution**:
```bash
# ✅ Correct: Use stub for general tests
./scripts/run_local_e2e.sh

# ✅ Correct: Use real Whisper only for tagged tests
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"

# ❌ Wrong: Don't run all tests without stub
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh
```

### Issue 2: Whisper Test Takes Too Long

**Symptoms**:
- Test runs for 8+ minutes
- Timeout on first run

**Cause**: NOT the download - it's status transition issues or resource contention.

**Actual Times**:
- Tiny model download: **10-30 seconds** (39MB)
- Model load into memory: **10-20 seconds**
- Transcribe 30s audio: **5-15 seconds**
- **Total first run**: 1-2 minutes
- **Total cached run**: 40-60 seconds (seen: 34.5s + 5.6s = 40.1s)

**If test times out**:
1. Check if multiple tests are running simultaneously (don't run full suite without stub)
2. Use the tag: `USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"`
3. Check backend logs for errors during model loading

### Issue 3: Force Restart Test Fails in Real Whisper Mode

**Symptoms**:
- Test expects `completed` but gets `processing`
- Timeout waiting for completion

**Cause**: Real Whisper transcription takes 30-60 seconds; test times out because it's designed for instant stub completion.

**Solution**: This test should only run with stub mode:
```bash
# Run without the force-restart test when using real Whisper
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"

# Or run all tests with stub (fast)
./scripts/run_local_e2e.sh
```

### Issue 4: Tests Skip Due to No Files

**Solution**: The local E2E runner creates files automatically. If using manual setup, upload 2+ files before running tests.

### Issue 5: Docker Services Not Running

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:3000`

**Solution**: Use the local E2E runner which starts services automatically:
```bash
./scripts/run_local_e2e.sh
```

Or manually start Docker:
```bash
docker-compose up
```

### Issue 6: Playwright Browsers Not Installed

**Error**: `browserType.launch: Executable doesn't exist`

**Solution**:

```bash
cd tests/e2e
npm install
npx playwright install
```

### Issue 7: Test Timeout

**Error**: `Test timeout of 30000ms exceeded`

**Solution**: Use the local E2E runner with appropriate test mode:

```typescript
// For slow tests, use test.setTimeout()
test('slow test', async ({ page }) => {
  test.setTimeout(60000) // 60 seconds
  // ...
})
```

Or increase global timeout in config:
```typescript
// playwright.local.config.ts
export default defineConfig({
  timeout: 5 * 60 * 1000, // 5 minutes
})
```

## Manual Validation vs Automated Tests

### Manual Testing (from TEST_PHASE_1_VALIDATION.md)

- ✅ More flexible
- ✅ Can inspect browser state interactively
- ❌ Time-consuming
- ❌ Not repeatable

### Automated Playwright Tests

- ✅ Fast and repeatable
- ✅ Run in CI/CD
- ✅ Consistent results
- ❌ Requires setup
- ❌ May need test data

**Recommendation**: Use both approaches:

1. Manual testing during development
2. Automated tests for regression prevention

## Quick Reference: When to Use Each Mode

### Use Stub Mode (Default) For:
✅ **Daily development testing**
✅ **UI behavior validation**
✅ **Cache isolation tests**
✅ **Status update tests**
✅ **Force restart flows**
✅ **CI/CD pipelines**

**Speed**: 30-60 seconds for full suite

**Command**:
```bash
./scripts/run_local_e2e.sh
```

### Use Real Whisper Mode For:
✅ **Validating model download**
✅ **Testing progress UI during download**
✅ **End-to-end transcription verification**
✅ **Pre-release validation**

**Speed**:
- First run: 1-2 minutes (downloads 39MB model)
- Cached: 40-60 seconds (loads from ~/.cache/whisper/)

**Command**:
```bash
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"
```

### Don't Do This:
❌ **Running full suite without stub**: `USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh`

**Why**: Causes 12+ tests to skip, timeouts, and 9+ minute execution times.

## Next Steps

1. **Install Playwright**:

   ```bash
   cd tests/e2e && npm install && npx playwright install
   ```

2. **Run Basic Tests** (Stub Mode):

   ```bash
   ./scripts/run_local_e2e.sh
   ```

3. **Run Whisper Tests** (1-2 minutes first time, ~40s cached):

   ```bash
   USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"
   ```

   Expected: Downloads 39MB tiny model (10-30s), loads into memory (10-20s), transcribes test audio (~5-15s)

4. **Review Results**:

   ```bash
   cd tests/e2e
   npx playwright show-report
   ```

## Test Execution Summary

| Mode | Command | Duration | Tests Run | Use Case |
|------|---------|----------|-----------|----------|
| **Stub (Fast)** | `./scripts/run_local_e2e.sh` | 30-60s | ~30 tests | Daily development, CI/CD |
| **Whisper Only** | `USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"` | 40s-2m | 2 tests | Model validation |
| **❌ All w/o Stub** | `USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh` | 9+ min | ~18 pass, 12 skip | Don't use |

**Note**: Whisper test times:
- **Cached model** (typical): ~40 seconds (34.5s + 5.6s)
- **First download**: 1-2 minutes (downloads 39MB tiny model)

## Contact

If tests fail unexpectedly:

1. Check this guide's **Common Issues** section
2. Review `IMPLEMENTATION_SUMMARY.md` for implementation details
3. Check test logs in `tests/e2e/test-results/`
4. Run with `--debug` flag for step-by-step execution
