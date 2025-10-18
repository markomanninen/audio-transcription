# E2E Testing with Local Development

## Overview

The Playwright E2E tests are configured to use **local development servers by default**, not Docker.

## Quick Start

1. **Start your local dev servers:**

   Terminal 1 - Backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

   Terminal 2 - Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Run the tests:**
   ```bash
   cd tests/e2e
   npx playwright test
   ```

## Configuration

### Default Behavior (Local Dev)
- Frontend: `http://localhost:5173` (Vite dev server)
- Backend: `http://localhost:8000` (FastAPI)
- No Docker required
- No webServer auto-start

### Docker Mode (Optional)
Set `USE_DOCKER=true` to use Docker:
```bash
USE_DOCKER=true npx playwright test
```

This will:
- Use `http://localhost:3000` for frontend
- Use `http://localhost:8080` for backend
- Auto-start Docker Compose if servers aren't running

## Why Local Dev?

✅ **Faster iteration** - No container rebuild needed
✅ **Better debugging** - Direct access to console logs
✅ **Hot reload** - Changes reflect immediately
✅ **Simpler setup** - Just `npm run dev`

## Configuration File

See `playwright.config.ts`:

```typescript
const isDev = !process.env.CI && !process.env.USE_DOCKER
const baseURL = isDev ? 'http://localhost:5173' : 'http://localhost:3000'
```

## Running Specific Tests

### Audio → Editor Integration Test
```bash
# Local dev (default)
./run-audio-editor-integration-test.sh

# Or manually
npx playwright test ai-text-editor.spec.ts -g "should open transcription segments"

# With Docker
USE_DOCKER=true npx playwright test ai-text-editor.spec.ts -g "should open transcription segments"
```

### All AI Editor Tests
```bash
npx playwright test ai-text-editor.spec.ts
```

## Troubleshooting

### Test fails with connection errors
**Problem:** Tests try to connect but servers aren't running
**Solution:** Make sure both frontend and backend are running locally

### Test uses wrong port
**Problem:** Test tries localhost:3000 instead of localhost:5173
**Solution:** Unset `USE_DOCKER` environment variable:
```bash
unset USE_DOCKER
npx playwright test
```

### Want to use Docker anyway
**Solution:** Explicitly set the flag:
```bash
USE_DOCKER=true npx playwright test
```

## CI/CD

In CI environments, Docker mode is used automatically:
- `process.env.CI` is set
- Tests use Docker ports (3000/8080)
- `webServer` auto-starts containers
