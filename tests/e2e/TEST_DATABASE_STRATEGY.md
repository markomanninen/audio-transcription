# E2E Test Database Strategy

## Current Approach ⚠️

**Status**: Tests currently use the **development database**

**Database**: `./data/transcriptions.db` (SQLite)

**Why**:
- Quick to set up and validate
- No additional configuration needed
- Works with existing Docker setup

**Limitations**:
- Tests modify real development data
- No automatic cleanup
- Could interfere with manual testing
- Not suitable for CI/CD

## Recommended Production Approach

### Option 1: Separate Test Database (Recommended)

Create a separate SQLite database for tests:

**Setup**:
1. Add test database configuration:
```python
# backend/app/core/config.py
class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/transcriptions.db"
    TEST_DATABASE_URL: str = "sqlite:///./data/test_transcriptions.db"
    TESTING: bool = False
```

2. Update Playwright config:
```typescript
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'TESTING=true docker-compose up',
    env: {
      DATABASE_URL: 'sqlite:///./data/test_transcriptions.db',
    },
  },
})
```

3. Add test database initialization:
```bash
# tests/e2e/scripts/init-test-db.sh
#!/bin/bash
rm -f ./data/test_transcriptions.db
docker-compose exec backend alembic upgrade head
```

**Pros**:
- Clean separation from development data
- Can reset database between test runs
- Safe for CI/CD

**Cons**:
- Requires additional setup
- Need to manage two databases

### Option 2: Docker Test Container

Use a separate Docker container for tests:

**Setup**:
```yaml
# docker-compose.test.yml
services:
  backend-test:
    extends:
      file: docker-compose.yml
      service: backend
    environment:
      - DATABASE_URL=sqlite:///./data/test_transcriptions.db
    ports:
      - "8001:8000"

  frontend-test:
    extends:
      file: docker-compose.yml
      service: frontend
    environment:
      - VITE_API_BASE_URL=http://localhost:8001
    ports:
      - "3001:5173"
```

**Run Tests**:
```bash
docker-compose -f docker-compose.test.yml up -d
npx playwright test --config=playwright.test.config.ts
docker-compose -f docker-compose.test.yml down
```

**Pros**:
- Complete isolation
- Can run tests while development server is running
- Easy cleanup

**Cons**:
- More complex setup
- Requires different ports
- Slower startup

### Option 3: In-Memory Database

Use an in-memory SQLite database:

**Setup**:
```python
# backend/app/core/config.py
if TESTING:
    DATABASE_URL = "sqlite:///:memory:"
```

**Pros**:
- Fastest tests
- No cleanup needed
- Perfect isolation

**Cons**:
- Database resets after each server restart
- Not suitable for file storage tests
- Different behavior than production

## Current Test Behavior

### What Tests Do
1. **Health Tests** (`health.spec.ts`)
   - ✅ Safe - Read-only
   - Checks frontend loads
   - Checks backend API responds

2. **Cache Isolation Tests** (`file-cache-isolation.spec.ts`)
   - ⚠️ Potentially modifying - Creates projects
   - Checks data attributes
   - Verifies cache behavior
   - Most tests skip if no data exists

### Data Modifications
Tests that **might** create data:
- Creating test projects
- Uploading files (if implemented in future)
- Starting transcriptions (if implemented in future)

Tests that **won't** modify data:
- Data attribute checks (read-only)
- Console log verification (read-only)
- Cache inspection (read-only)

## Safety Measures in Current Tests

1. **Graceful Skipping**:
```typescript
if (await fileCards.count() < 2) {
  test.skip()  // Don't run if prerequisites aren't met
  return
}
```

2. **Read-Only Verification**:
```typescript
// Just checks attributes, doesn't modify
const fileId = await element.getAttribute('data-file-id')
expect(fileId).toBeTruthy()
```

3. **No Destructive Operations**:
- Tests don't delete data
- Tests don't modify existing transcriptions
- Tests don't upload large files

## Migration Path

### Phase 1: Current (Development Database) ✅
- Run tests against development database
- Manual cleanup if needed
- Document what tests do

### Phase 2: Test Data Fixtures (Next Step)
- Create seed data scripts
- Add project/file fixtures
- Predictable test environment

### Phase 3: Separate Test Database (Future)
- Implement test database configuration
- Add automatic cleanup
- Enable CI/CD integration

### Phase 4: Full Isolation (Production)
- Docker test containers
- Parallel test execution
- Complete CI/CD pipeline

## Running Tests Safely Today

### Before Running Tests

1. **Backup Development Database** (Optional):
```bash
cp ./data/transcriptions.db ./data/transcriptions.db.backup
```

2. **Check What's in Database**:
```bash
sqlite3 ./data/transcriptions.db "SELECT COUNT(*) FROM projects;"
```

### Running Tests

```bash
cd tests/e2e

# Run only read-only health tests (SAFE)
npx playwright test health.spec.ts

# Run cache isolation tests (mostly safe, may create 1 test project)
npx playwright test file-cache-isolation.spec.ts

# Run specific test
npx playwright test -g "should show correct data attributes"
```

### After Running Tests

1. **Check for Test Projects**:
```bash
# List all projects
sqlite3 ./data/transcriptions.db "SELECT id, name FROM projects;"

# Delete test projects if needed
sqlite3 ./data/transcriptions.db "DELETE FROM projects WHERE name LIKE 'Test Project%';"
```

2. **Restore Backup** (if needed):
```bash
cp ./data/transcriptions.db.backup ./data/transcriptions.db
```

## Recommendations

### For Development (Now)
✅ **Current approach is acceptable**:
- Tests are mostly read-only
- Easy to run and validate
- Manual cleanup is simple
- Benefits outweigh risks

### For CI/CD (Future)
❌ **Must implement test database**:
- Separate test database required
- Automatic cleanup essential
- Can't use development data in CI

### For Team Environments
⚠️ **Use caution**:
- Coordinate with team before running tests
- Document any data created
- Consider using test database sooner

## Database Cleanup Scripts

### Manual Cleanup
```sql
-- Remove test projects
DELETE FROM projects WHERE name LIKE 'Test Project%' OR name LIKE 'Cache Test%';

-- Remove orphaned files
DELETE FROM audio_files WHERE project_id NOT IN (SELECT id FROM projects);

-- Remove orphaned segments
DELETE FROM segments WHERE file_id NOT IN (SELECT id FROM audio_files);
```

### Automated Cleanup Script
```bash
#!/bin/bash
# tests/e2e/scripts/cleanup-test-data.sh

sqlite3 ./data/transcriptions.db <<EOF
DELETE FROM projects WHERE name LIKE 'Test Project%';
DELETE FROM projects WHERE name LIKE 'Cache Test%';
DELETE FROM audio_files WHERE project_id NOT IN (SELECT id FROM projects);
DELETE FROM segments WHERE file_id NOT IN (SELECT id FROM audio_files);
EOF

echo "Test data cleaned up"
```

## Summary

- ✅ **Current tests are safe enough for development**
- ✅ **Most tests are read-only**
- ✅ **Easy manual cleanup if needed**
- ⚠️ **Be aware tests use real database**
- ❌ **Not ready for CI/CD without test database**
- 📋 **Future: Implement proper test database isolation**

For now, the benefits of running E2E tests outweigh the minimal risk of creating a test project or two in the development database.
