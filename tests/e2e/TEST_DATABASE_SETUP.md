# E2E Test Database Setup

## Overview

E2E tests now use a **completely separate test database** to prevent polluting the development database with thousands of test projects and files.

## Database Isolation

### Development Database
- **Location**: `backend/data/dev_transcriptions.db`
- **Used by**: Local development server
- **Should contain**: Your actual development projects and files

### Test Database
- **Location**: `backend/data/e2e_test_transcriptions.db`
- **Used by**: E2E tests only
- **Contains**: Temporary test projects created during test runs
- **Auto-cleaned**: Can be deleted anytime without affecting development

### Test Audio Files
- **Location**: `backend/data/e2e_test_audio/`
- **Purpose**: Stores audio files uploaded during tests
- **Isolated from**: Development audio files in `backend/data/audio/`

## Running Tests

### Recommended: Using Test Database (Isolated)

```bash
cd tests/e2e
npm test
```

This command:
1. Backs up your current backend `.env`
2. Configures backend to use test database
3. Optionally restarts backend with test configuration
4. Runs all E2E tests
5. Restores your original backend `.env`
6. Records test results and updates status

### Alternative: Using Dev Database (NOT RECOMMENDED)

```bash
cd tests/e2e
npm run test:dev-db
```

⚠️ **Warning**: This will create test projects in your development database!

## Test Environment Configuration

The test environment (`.env.test`) configures:

```bash
DATABASE_URL=sqlite:///./data/e2e_test_transcriptions.db
AUDIO_STORAGE_PATH=./data/e2e_test_audio
E2E_TRANSCRIPTION_STUB=true  # Skip actual Whisper processing for speed
DEBUG=true
```

## Backend Restart Options

When running `npm test`, you'll be prompted:

```
⚠️  Backend is currently running with DEV database
   You need to restart the backend to use the TEST database.

   Let this script restart it for you? (y/n)
```

- **`y`**: Script will stop current backend, start it with test config, run tests, then restore
- **`n`**: You'll need to manually restart the backend:
  ```bash
  # Stop current backend
  pkill -f "uvicorn app.main:app"

  # Script will configure .env.test, then start:
  cd backend
  python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```

## Cleaning Test Data

To remove all test data:

```bash
rm backend/data/e2e_test_transcriptions.db*
rm -rf backend/data/e2e_test_audio/
```

This is safe and won't affect your development database or files.

## Verifying Isolation

Check which database is currently in use:

```bash
# Development database
ls -lh backend/data/dev_transcriptions.db

# Test database (only exists after running tests)
ls -lh backend/data/e2e_test_transcriptions.db
```

## Troubleshooting

### Issue: Tests still creating projects in dev database

**Solution**: Make sure you're using `npm test` (not `npm run test:dev-db`) and allowed the script to restart the backend.

### Issue: Backend not restarting automatically

**Solution**: Manually restart the backend with test configuration:
1. Check backend `.env` has test database path
2. Stop any running backend: `pkill -f "uvicorn app.main:app"`
3. Start backend: `cd backend && python -m uvicorn app.main:app --reload`

### Issue: Tests timeout or fail

**Solution**:
- Check backend is running: `curl http://localhost:8000/health`
- Check frontend is running: `curl http://localhost:5173`
- Review backend logs: `tail -f /tmp/e2e-backend.log`

## CI/CD Integration

In CI environments, the test database is used automatically:

```yaml
- name: Run E2E tests
  run: |
    cd tests/e2e
    npm test
  env:
    DATABASE_URL: sqlite:///./data/e2e_test_transcriptions.db
    E2E_TRANSCRIPTION_STUB: true
```

## Migration from Old Setup

If you previously ran tests that polluted your dev database:

1. **Backup important projects**: Export any test data you want to keep
2. **Clean dev database** (optional): Delete unwanted test projects via UI
3. **Run new test setup**: `cd tests/e2e && npm test`
4. **Verify isolation**: Check dev database doesn't grow during test runs
