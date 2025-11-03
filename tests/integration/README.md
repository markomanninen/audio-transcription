# Integration Tests

This directory contains end-to-end integration tests for the transcription application.

## Project Export/Import Tests

### Files

- `test_project_export_import_e2e.py` - Comprehensive E2E test (requires backend dependencies)
- `test_export_import_structure.py` - Lightweight structure validation test (standalone)
- `run_e2e_test.py` - Test runner that sets up the proper environment
- `output/` - Directory where test artifacts are stored

### Running the Tests

#### Quick Structure Test (Recommended for Development)

```bash
# From the project root - runs without backend dependencies
python tests/integration/test_export_import_structure.py
```

#### Full E2E Test (Requires Backend Setup)

```bash
# Method 1: Using the Test Runner (Recommended)
python tests/integration/run_e2e_test.py

# Method 2: Direct Execution
cd backend
python ../tests/integration/test_project_export_import_e2e.py
```

### What the E2E Test Does

1. **Setup**: Creates isolated test environment with temporary database and audio files
2. **Data Creation**: Generates comprehensive test data including:
   - Project with metadata
   - Multiple speakers with colors and names
   - Audio files with realistic mock content
   - Segments with transcribed text
   - Edit history showing manual corrections and AI improvements
3. **Export Test**: Exports the project to ZIP format and validates structure
4. **Validation Test**: Validates the ZIP file format and content integrity
5. **Import Test**: Imports the ZIP into a new project
6. **Verification**: Compares original and imported data to ensure perfect fidelity

### Test Output

All test artifacts are created in `tests/integration/output/`:
- Test database (`test_export_import.db`)
- Mock audio files (`test_audio/`)
- Export ZIP files
- Logs and reports

### Success Criteria

The test passes when:
- ✅ Export generates valid ZIP with all components
- ✅ Validation confirms ZIP structure and content
- ✅ Import successfully creates new project
- ✅ All data integrity checks pass:
  - Project metadata preserved
  - All audio files copied correctly
  - Speaker information maintained
  - Segment texts and timing preserved
  - Edit history maintained
  - File counts match exactly

### Troubleshooting

If tests fail:

1. **Import Errors**: Ensure you're running from the correct directory (backend/ or using the runner)
2. **Database Errors**: Check that SQLite is available and directories are writable
3. **File Path Issues**: Verify that the test output directory is writable
4. **Memory Issues**: The test creates realistic-sized mock data, ensure sufficient memory

### Test Design

The E2E test is designed to:
- Run in complete isolation without affecting the main application
- Use realistic data that exercises all code paths
- Provide detailed reporting of each test phase
- Clean up after itself (all artifacts in output/ directory)
- Be deterministic and repeatable

This ensures the export/import functionality works correctly in real-world scenarios.