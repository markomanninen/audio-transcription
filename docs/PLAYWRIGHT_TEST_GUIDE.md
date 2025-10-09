# Playwright E2E Test Guide - Cache Isolation

## Overview

This guide explains how to run and validate the Playwright end-to-end tests for the frontend panel cache isolation fixes.

## Status

**Current State**:
- ✅ Playwright configuration exists (`tests/e2e/playwright.config.ts`)
- ✅ Basic health check test exists (`tests/e2e/tests/health.spec.ts`)
- ✅ **NEW**: Comprehensive cache isolation tests created (`tests/e2e/tests/file-cache-isolation.spec.ts`)
- ⚠️ Playwright dependencies need to be installed

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

### Option 1: Run All Tests

```bash
cd tests/e2e
npm test
```

This runs all tests in headless mode (no browser UI).

### Option 2: Run with Browser UI (Headed Mode)

```bash
cd tests/e2e
npm run test:headed
```

Watch tests execute in real browser windows.

### Option 3: Debug Mode

```bash
cd tests/e2e
npm run test:debug
```

Opens Playwright Inspector for step-by-step debugging.

### Option 4: Run Specific Test File

```bash
cd tests/e2e
npx playwright test file-cache-isolation.spec.ts
```

### Option 5: Run Specific Test Case

```bash
cd tests/e2e
npx playwright test -g "should show correct data attributes"
```

## Test Suites

### 1. Health Check Tests (`health.spec.ts`)
- ✅ Frontend loads successfully
- ✅ Backend API is accessible

**Run**:
```bash
npx playwright test health.spec.ts
```

### 2. File Cache Isolation Tests (`file-cache-isolation.spec.ts`)

#### Test Cases:

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

3. Frontend accessible at http://localhost:3000
4. Backend accessible at http://localhost:8000

**Note**: Some tests will skip if requirements aren't met (e.g., multiple files).

## Test Data Setup

### Option 1: Manual Setup (Before Running Tests)

1. Open http://localhost:3000
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

### Issue 1: Tests Skip Due to No Files

**Solution**: Manually upload 2+ files before running tests, or create seed data script.

### Issue 2: Docker Services Not Running

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:3000`

**Solution**:
```bash
docker-compose up
```

### Issue 3: Playwright Browsers Not Installed

**Error**: `browserType.launch: Executable doesn't exist`

**Solution**:
```bash
npx playwright install
```

### Issue 4: Test Timeout

**Error**: `Test timeout of 30000ms exceeded`

**Solution**: Increase timeout in test or config:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000) // 60 seconds
  // ...
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

## Next Steps

1. **Install Playwright**:
   ```bash
   cd tests/e2e && npm install && npx playwright install
   ```

2. **Run Basic Tests**:
   ```bash
   npm test
   ```

3. **Set Up Test Data**:
   - Create project with 2+ files
   - Start transcription on one file

4. **Run Full Test Suite**:
   ```bash
   npx playwright test file-cache-isolation.spec.ts
   ```

5. **Review Results**:
   ```bash
   npm run report
   ```

## Contact

If tests fail unexpectedly:
1. Check `IMPLEMENTATION_SUMMARY.md` for implementation details
2. Review `TEST_PHASE_1_VALIDATION.md` for manual validation steps
3. Check Docker logs: `docker-compose logs frontend backend`
