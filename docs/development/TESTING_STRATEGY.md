# Testing Strategy

This document outlines the comprehensive testing strategy for the Audio Transcription application.

## Testing Pyramid

```
         /\
        /E2E\         End-to-End Tests (Playwright)
       /------\       - Full workflow tests
      /  API   \      - Integration tests
     /----------\     - Component integration
    /   Unit     \    - API client tests
   /--------------\   - Hook tests
  /    Backend     \  - Service tests
 /------------------\ - Model tests
```

## Current Test Coverage

### ✅ Backend Tests (High Coverage ~30%)

**Location**: `/backend/tests/`

**Test Files**:
- `test_transcription.py` - Core transcription functionality
- `test_segment_editing.py` - Segment CRUD operations (15 tests)
- `test_export.py` - Export format generation
- `test_ai_corrections.py` - LLM integration
- `test_force_restart.py` - Restart functionality
- `test_upload.py` - File validation

**Coverage Areas**:
- ✅ Audio file upload and validation
- ✅ Transcription with resume capability
- ✅ Speaker diarization
- ✅ Segment editing (insert, update, delete, join)
- ✅ AI corrections (Ollama/OpenRouter)
- ✅ Export formats (SRT, HTML, TXT)
- ✅ Force restart functionality

### ⚠️ Frontend Unit Tests (Low Coverage)

**Location**: `/frontend/src/`

**Existing Tests**:
- `src/api/__tests__/aiEditor.test.ts` - AI Editor API client
- `src/hooks/__tests__/useAIEditor.test.tsx` - AI Editor hook
- `src/components/__tests__/AudioPlayer.test.tsx` - Audio player component
- `src/components/__tests__/FileUploader.test.tsx` - File uploader component
- `src/components/ui/__tests__/Button.test.tsx` - Button component
- `src/components/ui/__tests__/Toast.test.tsx` - Toast component
- `src/components/ui/__tests__/Modal.test.tsx` - Modal component
- `src/utils/__tests__/segments.test.ts` - Segment utilities

**Missing Coverage**:
- ❌ API clients: `aiAnalysis.ts`, `aiCorrections.ts`, `client.ts`
- ❌ Hooks: `useTranscription`, `useUpload`, `useProjects`, `useAICorrections`, `useAIAnalysis`, `useSystemHealth`, etc.
- ❌ Components: `SegmentList`, `SpeakerManager`, `Dashboard`, `EditorPage`, etc.
- ❌ Utils: Transcription utilities, format converters

### ✅ E2E Tests (Comprehensive)

**Location**: `/tests/e2e/tests/`

**Test Files** (17 spec files):
1. `health.spec.ts` - Application health checks
2. `dashboard-ready.spec.ts` - Dashboard initialization
3. `ui-project-creation.spec.ts` - Project creation UI
4. `full-workflow.spec.ts` - Complete workflow
5. `file-cache-isolation.spec.ts` - Cache isolation
6. `file-status-consistency.spec.ts` - Status consistency
7. `force-restart-complete-flow.spec.ts` - Force restart
8. `transcription-completion-status.spec.ts` - Transcription status
9. `transcription-restart.spec.ts` - Restart functionality
10. `local-whisper-progress.spec.ts` - Progress tracking
11. `consecutive-project-creation.spec.ts` - Sequential operations
12. `fresh-app-stability.spec.ts` - App stability
13. `loading-splash.spec.ts` - Loading states
14. `tutorial-links.spec.ts` - Tutorial navigation
15. `ai-text-editor.spec.ts` - AI text editor features
16. `check-console.spec.ts` - Console error detection
17. `debug-page.spec.ts` - Debug utilities

**Coverage Areas**:
- ✅ Application health and initialization
- ✅ Project creation and management
- ✅ File upload and transcription
- ✅ Cache isolation and data consistency
- ✅ Force restart and recovery
- ✅ AI text editor integration
- ✅ UI navigation and user flows
- ⚠️ Missing: Export functionality E2E tests
- ⚠️ Missing: Segment editing E2E tests
- ⚠️ Missing: Speaker management E2E tests
- ⚠️ Missing: AI corrections E2E tests

## Test Execution Commands

### Backend Tests
```bash
# All backend tests
cd backend && python -m pytest

# Specific test files
python -m pytest tests/test_segment_editing.py
python -m pytest tests/test_export.py
python -m pytest tests/test_ai_corrections.py
python -m pytest tests/test_transcription.py

# With coverage
python -m pytest --cov=app --cov-report=html
```

### Frontend Unit Tests
```bash
cd frontend

# Run all unit tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### E2E Tests
```bash
cd tests/e2e

# Run all E2E tests
npx playwright test

# Run specific test
npx playwright test health.spec.ts

# With UI
npx playwright test --ui

# Headed mode (see browser)
npx playwright test --headed
```

## Priority 1: Missing Frontend API Client Tests

Create comprehensive tests for all API client modules:

### Required Test Files

1. **`/frontend/src/api/__tests__/client.test.ts`** ⭐ HIGH PRIORITY
   - Test API base configuration
   - Test request/response interceptors
   - Test error handling
   - Test authentication headers

2. **`/frontend/src/api/__tests__/aiAnalysis.test.ts`**
   - `analyzeTranscription()` - Full transcription analysis
   - `analyzeSegment()` - Individual segment analysis
   - Error handling for API failures

3. **`/frontend/src/api/__tests__/aiCorrections.test.ts`**
   - `correctSegment()` - Segment correction
   - `checkSpelling()` - Spell checking
   - `improveGrammar()` - Grammar improvements
   - Provider selection (Ollama/OpenRouter)

### Test Template (Vitest + MSW)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import { someApiFunction } from '../someApi';

// Mock the API client
vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('API Module Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('functionName', () => {
    it('should call correct endpoint with proper data', async () => {
      const mockResponse = { data: { id: 1, name: 'test' } };
      mockPost.mockResolvedValue(mockResponse);

      const result = await someApiFunction({ param: 'value' });

      expect(mockPost).toHaveBeenCalledWith('/api/endpoint', { param: 'value' });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network Error');
      mockPost.mockRejectedValue(error);

      await expect(someApiFunction({ param: 'value' })).rejects.toThrow('Network Error');
    });

    it('should handle validation errors', async () => {
      const error = { response: { status: 400, data: { detail: 'Invalid data' } } };
      mockPost.mockRejectedValue(error);

      await expect(someApiFunction({ param: '' })).rejects.toThrow();
    });
  });
});
```

## Priority 2: Missing Frontend Hook Tests

Create tests for React custom hooks using React Testing Library:

### Required Test Files

1. **`/frontend/src/hooks/__tests__/useTranscription.test.tsx`** ⭐ CRITICAL
   - Test transcription status polling
   - Test segment fetching
   - Test speaker management
   - Test cache invalidation on file switch
   - Test v3 cache versioning

2. **`/frontend/src/hooks/__tests__/useUpload.test.tsx`**
   - Test file upload with progress
   - Test file validation
   - Test error handling
   - Test multiple file uploads

3. **`/frontend/src/hooks/__tests__/useProjects.test.tsx`**
   - Test project creation
   - Test project listing
   - Test project deletion
   - Test localStorage persistence

4. **`/frontend/src/hooks/__tests__/useAICorrections.test.tsx`**
   - Test segment correction
   - Test provider selection
   - Test error handling
   - Test optimistic updates

5. **`/frontend/src/hooks/__tests__/useSystemHealth.test.tsx`**
   - Test health check polling
   - Test service status detection
   - Test error states

### Hook Test Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCustomHook } from '../useCustomHook';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useCustomHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch data successfully', async () => {
    const { result } = renderHook(() => useCustomHook(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('should handle errors', async () => {
    // Mock API error
    const { result } = renderHook(() => useCustomHook(-1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

## Priority 3: Missing E2E Workflow Tests

Add comprehensive E2E tests for missing workflows:

### Required E2E Test Files

1. **`tests/e2e/tests/export-workflow.spec.ts`** ⭐ HIGH PRIORITY
   - Test SRT export
   - Test HTML export
   - Test TXT export
   - Test export options (edited text, speakers, timestamps)

2. **`tests/e2e/tests/segment-editing.spec.ts`**
   - Test inline segment editing
   - Test segment insertion (above/below)
   - Test segment deletion
   - Test segment joining
   - Test original text preservation

3. **`tests/e2e/tests/speaker-management.spec.ts`**
   - Test speaker renaming
   - Test speaker reassignment
   - Test speaker color updates

4. **`tests/e2e/tests/ai-corrections.spec.ts`**
   - Test segment correction with Ollama
   - Test diff view
   - Test accept/reject suggestions
   - Test bulk corrections

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to page, create test data
    await page.goto('http://localhost:3000');
  });

  test('should perform action successfully', async ({ page }) => {
    // Arrange
    await page.getByTestId('create-project').click();
    await page.getByLabel('Project Name').fill('Test Project');

    // Act
    await page.getByRole('button', { name: 'Create' }).click();

    // Assert
    await expect(page.getByText('Project created')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Test error scenarios
    await page.getByTestId('invalid-action').click();
    await expect(page.getByText('Error:')).toBeVisible();
  });
});
```

## Test Data Management

### Backend Test Data
- **Fixtures**: `backend/tests/conftest.py`
- **Sample Audio**: `tests/fixtures/test-audio-30s.mp3`
- **Mock Services**: Whisper, LLM APIs mocked in unit tests

### Frontend Test Data
- **MSW Handlers**: Mock API responses for unit tests
- **Test Factories**: Create test data objects programmatically
- **Fixtures**: Reusable test data in `__tests__/fixtures/`

### E2E Test Data
- **Seed Data**: Populated via backend API calls in `beforeEach`
- **Cleanup**: Remove test data in `afterEach`
- **Isolation**: Each test uses unique project/file names

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - name: Install dependencies
        run: cd backend && pip install -r requirements.txt
      - name: Run pytest
        run: cd backend && pytest --cov=app

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests
        run: cd frontend && npm test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install Playwright
        run: cd tests/e2e && npm ci && npx playwright install
      - name: Start services
        run: docker-compose up -d
      - name: Run E2E tests
        run: cd tests/e2e && npx playwright test
```

## Test Coverage Goals

### Current State
- **Backend**: ~30% (Good)
- **Frontend**: ~10% (Poor)
- **E2E**: ~70% of critical workflows (Good)

### Target State (6 months)
- **Backend**: 80%+ coverage
- **Frontend**: 70%+ coverage
- **E2E**: 90%+ of critical workflows

### Metrics to Track
- Line coverage percentage
- Branch coverage percentage
- Number of tests passing/failing
- Test execution time
- Flaky test rate (< 1%)

## Best Practices

### Unit Tests
- ✅ Test one thing per test
- ✅ Use descriptive test names
- ✅ Follow AAA pattern (Arrange, Act, Assert)
- ✅ Mock external dependencies
- ✅ Test edge cases and error scenarios
- ❌ Don't test implementation details
- ❌ Don't create test interdependencies

### E2E Tests
- ✅ Test user workflows, not implementations
- ✅ Use data-testid attributes for selectors
- ✅ Wait for conditions, don't use hard timeouts
- ✅ Clean up test data after each test
- ✅ Test happy paths and error scenarios
- ❌ Don't test every edge case (use unit tests)
- ❌ Don't rely on execution order

### Maintenance
- Run tests locally before committing
- Fix failing tests immediately (don't skip)
- Update tests when features change
- Remove obsolete tests
- Monitor test execution time
- Address flaky tests promptly

## Next Steps

1. **Week 1-2**: Implement Priority 1 (API client tests)
2. **Week 3-4**: Implement Priority 2 (Hook tests)
3. **Week 5-6**: Implement Priority 3 (Missing E2E tests)
4. **Week 7**: Set up CI/CD pipeline
5. **Week 8**: Achieve 70% frontend coverage
6. **Ongoing**: Maintain and improve coverage

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
