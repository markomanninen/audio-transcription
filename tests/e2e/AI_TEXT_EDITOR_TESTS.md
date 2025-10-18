# AI Text Editor E2E Tests

This directory contains comprehensive end-to-end tests for the AI Text Editor feature, which includes:

- Text-only project creation
- React Router-based editor navigation
- Advanced text editing with version history
- AI-powered features (semantic reconstruction, style generation, NLP analysis)
- Side-by-side diff viewer with accept/reject workflow
- Export templates with Jinja2 templating

## Test Files

### 1. `ai-text-editor-workflow-test.js`
**Type:** Manual/Interactive test script using raw Playwright

**Purpose:** Comprehensive workflow test that walks through the entire AI text editor feature set with visual feedback and screenshots.

**Features Tested:**
- ✅ App initialization and tutorial handling
- ✅ Text project creation with project type selection
- ✅ Editor navigation (button and direct URL)
- ✅ Basic text editing and persistence
- ✅ Version history with save/rollback functionality
- ✅ AI semantic reconstruction
- ✅ AI style generation with target style selection
- ✅ NLP analysis
- ✅ Diff view with side-by-side comparison
- ✅ AI suggestion accept/reject workflow
- ✅ Export templates management (create, edit, delete)
- ✅ Template-based export functionality
- ✅ Dashboard navigation and project verification

**How to Run:**
```bash
# From project root
cd tests/e2e

# Run in development mode (local services)
node ai-text-editor-workflow-test.js

# Run in Docker mode
TEST_DOCKER=true node ai-text-editor-workflow-test.js
# OR
USE_DOCKER=true node ai-text-editor-workflow-test.js
```

**Output:**
- Test runs with visible browser (headless: false)
- Console output with step-by-step progress
- Screenshots saved to `tests/e2e/test-screenshots/ai-editor/`
- Named screenshots for each major step (01-app-loaded.png, 02-create-project-modal.png, etc.)

### 2. `tests/ai-text-editor.spec.ts`
**Type:** Playwright Test Suite (TypeScript)

**Purpose:** Automated test suite that integrates with Playwright Test runner for CI/CD pipelines.

**Test Suites:**

#### **Project Creation** (2 tests)
- Create a new text project
- Distinguish text projects from audio projects

#### **Navigation** (3 tests)
- Navigate to editor via button
- Navigate to editor via direct URL
- Navigate back to dashboard from editor

#### **Text Editing** (2 tests)
- Enter and edit text
- Preserve text after navigation

#### **Version History** (3 tests)
- Save versions
- Display version history
- Rollback to previous version

#### **AI Features** (3 tests)
- Semantic reconstruction
- Style generation
- NLP analysis

#### **Diff View** (3 tests)
- Display side-by-side diff
- Accept suggestions
- Reject suggestions

#### **Export Templates** (4 tests)
- Navigate to export templates page
- Create new export template
- Edit existing template
- Delete template

#### **Export Functionality** (1 test)
- Export using a template

#### **Audio Transcription Integration** (1 test)
- Open transcription segments in text editor
  - Tests the "Open in Editor" feature from audio dashboard
  - Verifies transcription content loads in editor
  - Confirms text project creation from audio segments
  - Validates speaker labels are preserved

**How to Run:**
```bash
# From project root
cd tests/e2e

# Run all AI editor tests
npx playwright test ai-text-editor.spec.ts

# Run specific test suite
npx playwright test ai-text-editor.spec.ts -g "Project Creation"

# Run audio → editor integration test (requires existing transcription)
npx playwright test ai-text-editor.spec.ts -g "should open transcription segments"
# OR use the convenience script:
./run-audio-editor-integration-test.sh

# Run with headed browser
npx playwright test ai-text-editor.spec.ts --headed

# Run in debug mode
npx playwright test ai-text-editor.spec.ts --debug

# Run with specific browser
npx playwright test ai-text-editor.spec.ts --project=chromium
npx playwright test ai-text-editor.spec.ts --project=firefox
npx playwright test ai-text-editor.spec.ts --project=webkit

# Generate HTML report
npx playwright test ai-text-editor.spec.ts --reporter=html
npx playwright show-report
```

## Prerequisites

### Default: Local Development Mode

By default, tests use **local development servers** (not Docker):

**Backend:**
```bash
cd backend
uvicorn app.main:app --reload
# Runs on http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

### Optional: Docker Mode

To use Docker instead, set `USE_DOCKER=true`:
```bash
USE_DOCKER=true npx playwright test ai-text-editor.spec.ts
```

Or use Docker Compose:
```bash
docker-compose up -d
# Frontend: http://localhost:3000
# Backend: http://localhost:8080
```

### 3. Dependencies Installed

```bash
# Install E2E test dependencies
cd tests/e2e
npm install
```

### 4. Ollama Service (Optional)

For AI features to work fully, ensure Ollama is running:

```bash
# Check if Ollama is accessible
curl http://localhost:11434/api/tags

# If using Docker
docker-compose up -d ollama
```

## Test Configuration

### Port Configuration

Tests automatically detect port configuration using `scripts/port-utils.js`:

**Default Development:**
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

**Docker:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8080

Override with environment variables:
```bash
FRONTEND_PORT=3000 BACKEND_PORT=8080 node ai-text-editor-workflow-test.js
```

### Playwright Configuration

Edit `playwright.config.ts` for test settings:
- Timeout values
- Retry logic
- Screenshot/video capture
- Browser settings

## Troubleshooting

### Tests Fail with "Text area not found"

**Cause:** Editor page not loading properly or wrong route
**Solution:**
- Verify React Router is set up correctly
- Check browser console for errors
- Ensure `/editor/:projectId` route exists in App.tsx

### AI Features Don't Work

**Cause:** Ollama service not running or not accessible
**Solution:**
- Start Ollama: `ollama serve` or `docker-compose up ollama`
- Check backend logs for connection errors
- Verify OLLAMA_BASE_URL in backend .env file

### Export Tests Fail

**Cause:** Export templates not configured or backend endpoint missing
**Solution:**
- Verify `/api/export-templates/*` endpoints exist
- Check if Jinja2 is installed in backend requirements
- Create at least one default template in the database

### Screenshots Not Saved

**Cause:** Directory doesn't exist or no write permissions
**Solution:**
```bash
mkdir -p tests/e2e/test-screenshots/ai-editor
chmod 755 tests/e2e/test-screenshots
```

### Version History Not Working

**Cause:** Database migrations not applied or API endpoint missing
**Solution:**
- Check if `TextDocument` model exists
- Verify version history API endpoints
- Run database migrations: `cd backend && alembic upgrade head`

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests - AI Text Editor

on:
  push:
    branches: [main, feature/ai-text-editor]
  pull_request:
    branches: [main]

jobs:
  e2e-ai-editor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd tests/e2e
          npm install

      - name: Start services
        run: docker-compose up -d

      - name: Wait for services
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:8080/health; do sleep 2; done'
          timeout 60 bash -c 'until curl -f http://localhost:3000; do sleep 2; done'

      - name: Run AI Text Editor Tests
        run: |
          cd tests/e2e
          npx playwright test ai-text-editor.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: ai-editor-test-results
          path: |
            tests/e2e/test-results/
            tests/e2e/playwright-report/

      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: ai-editor-screenshots
          path: tests/e2e/test-screenshots/ai-editor/
```

## Test Coverage

| Feature | Manual Test | Playwright Suite | Coverage |
|---------|-------------|------------------|----------|
| Project Creation | ✅ | ✅ | 100% |
| Editor Navigation | ✅ | ✅ | 100% |
| Text Editing | ✅ | ✅ | 100% |
| Version History | ✅ | ✅ | 100% |
| Semantic Reconstruction | ✅ | ✅ | 100% |
| Style Generation | ✅ | ✅ | 100% |
| NLP Analysis | ✅ | ✅ | 100% |
| Diff View | ✅ | ✅ | 100% |
| Accept/Reject Suggestions | ✅ | ✅ | 100% |
| Export Templates | ✅ | ✅ | 100% |
| Template Export | ✅ | ✅ | 100% |
| Audio → Editor Integration | ✅ | ✅ | 100% |

## Adding New Tests

To add tests for new AI editor features:

1. **For manual test:**
   - Add new section in `ai-text-editor-workflow-test.js`
   - Follow the pattern: console log → action → screenshot → verification
   - Use semantic selectors (getByRole, getByText)

2. **For Playwright suite:**
   - Create new `test.describe` block in `ai-text-editor.spec.ts`
   - Write individual `test()` cases
   - Use expect assertions for verification
   - Add appropriate timeout handling for AI operations

## Best Practices

1. **Use Semantic Selectors:** Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for State:** Use `waitForLoadState('networkidle')` after navigation
3. **Handle AI Delays:** AI operations may take 5-10 seconds, use appropriate timeouts
4. **Screenshot Strategy:** Capture screenshots at key points for debugging
5. **Skip Gracefully:** Use `test.skip()` for features not yet implemented
6. **Cleanup:** Consider adding cleanup logic to remove test projects

## Related Documentation

- [Main E2E Test README](./README.md)
- [Manual Workflow Test](./manual-workflow-test.js)
- [Playwright Test Guide](../../docs/development/PLAYWRIGHT_TEST_GUIDE.md)
- [AI Editor Implementation](../../docs/AI_EDITOR_IMPLEMENTATION.md)

## Support

For issues with these tests:
1. Check backend and frontend logs
2. Verify all services are running
3. Review screenshots in `test-screenshots/ai-editor/`
4. Check Playwright trace if enabled
5. Open issue with test output and screenshots
