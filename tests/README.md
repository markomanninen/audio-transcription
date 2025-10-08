# Enhanced Transcription System - Test Suite

This directory contains comprehensive tests for the enhanced transcription system with restart/resume functionality and detailed progress tracking.

## 📁 Directory Structure

```
tests/
├── README.md                                    # This file
├── test_comprehensive_suite.py                  # Main test runner
├── backend/                                     # Backend-specific tests
│   ├── test_simple_e2e.py                      # End-to-end transcription tests
│   └── test_enhanced_transcription_unit.py     # Unit tests for transcription service
└── integration/                                 # API integration tests
    └── test_enhanced_api_integration.py         # API endpoint integration tests
```

## 🚀 Quick Start

### Run All Tests
```bash
# From the project root directory
cd tests
python test_comprehensive_suite.py
```

### Run Specific Test Suites
```bash
# Only unit tests
python test_comprehensive_suite.py --only-unit

# Only integration tests
python test_comprehensive_suite.py --only-integration

# Only end-to-end tests
python test_comprehensive_suite.py --only-e2e

# Skip certain test suites
python test_comprehensive_suite.py --skip-unit --skip-integration
```

### Test Against Different Backend URLs
```bash
# Test against production
python test_comprehensive_suite.py --url http://prod.example.com

# Test against staging
python test_comprehensive_suite.py --url http://staging.example.com:8080
```

## 📋 Test Suites Overview

### 1. Unit Tests (`backend/test_enhanced_transcription_unit.py`)
- **Purpose**: Test individual methods and functions in isolation
- **Coverage**: Enhanced status methods, resume logic, checkpoint system
- **Duration**: ~30-60 seconds
- **Dependencies**: pytest, SQLite (in-memory)

**What it tests:**
- Enhanced status field validation
- Can resume logic for different scenarios
- Stuck transcription detection
- Action determination (auto vs specific)
- Checkpoint save/restore functionality
- Recovery attempts tracking
- Stage transitions
- Force restart functionality
- Resume token system

### 2. Integration Tests (`integration/test_enhanced_api_integration.py`)
- **Purpose**: Test API endpoints and their interactions
- **Coverage**: All REST API endpoints with enhanced functionality
- **Duration**: ~2-5 minutes
- **Dependencies**: requests, running backend server

**What it tests:**
- Health endpoint
- File upload endpoint
- Enhanced status endpoint with all new fields
- Action endpoints (auto, start, resume)
- Progress monitoring during transcription
- Force restart endpoint
- Segments endpoint
- Download endpoint
- Error handling with invalid requests
- API response consistency

### 3. End-to-End Tests (`backend/test_simple_e2e.py`)
- **Purpose**: Test complete transcription workflow with mock backend
- **Coverage**: Full transcription lifecycle with restart/resume
- **Duration**: ~5-10 seconds
- **Dependencies**: None (uses mock backend)

**What it tests:**
- Backend health verification
- Audio file upload and processing
- Enhanced status tracking throughout transcription
- Auto action determination
- Transcription progress monitoring with detailed stages
- Completion verification
- Resume functionality after completion
- Restart functionality with segment cleanup
- Error recovery tracking
- Comprehensive system verification

### 4. Comprehensive Test Runner (`test_comprehensive_suite.py`)
- **Purpose**: Orchestrate all test suites with detailed reporting
- **Coverage**: Full system validation with dependency checking
- **Duration**: ~5-15 minutes total
- **Dependencies**: All above test dependencies

**What it does:**
- Checks all required dependencies
- Verifies backend health before testing
- Runs all test suites in logical order
- Provides detailed progress tracking
- Generates comprehensive final summary
- Supports selective test execution
- Handles timeouts and error recovery

## 🔧 Requirements

### Required Dependencies
```bash
pip install requests pytest
```

### Optional Dependencies (for better audio handling)
```bash
pip install numpy
# FFmpeg (for audio file generation) - install separately
```

### Backend Requirements
- Backend server must be running and healthy
- Database must be accessible
- Whisper model should be available (for full E2E tests)

## 🏥 Health Checks

The test suite performs comprehensive health checks before running:

1. **Dependency Check**: Verifies all required Python packages
2. **Backend Health**: Confirms backend is responding to `/health` endpoint
3. **Database Connectivity**: Validates database access through API
4. **Whisper Availability**: Checks if Whisper model can be loaded (E2E only)

## 📊 Progress Tracking

All tests include detailed progress tracking:

- **Real-time Progress**: Shows current test number and percentage
- **Elapsed Time**: Tracks time spent on each test suite
- **Detailed Status**: Shows transcription stages, progress, and segments
- **Final Summary**: Comprehensive results with success rates

## ✅ Expected Results

### Successful Test Run
When all tests pass, you should see:
- ✅ All dependencies available
- ✅ Backend is healthy
- ✅ Unit tests: All mocked functionality works
- ✅ Integration tests: All API endpoints respond correctly
- ✅ E2E tests: Complete transcription workflow works
- 🎉 **ALL TESTS PASSED!**

### What Tests Validate

1. **Enhanced Transcription Features**:
   - Restart/resume functionality works correctly
   - Progress tracking is accurate
   - Stage transitions are properly recorded
   - Error recovery mechanisms function

2. **API Reliability**:
   - All endpoints return expected responses
   - Error handling works for invalid requests
   - Progress monitoring provides real-time updates
   - Force restart cleans up state properly

3. **System Robustness**:
   - Transcription can handle interruptions
   - Resume works from various states
   - Checkpoint system preserves state
   - Recovery tracking is accurate

## 🐛 Troubleshooting

### Common Issues

**Backend Not Available**
```
❌ Backend failed to respond after 30s
🔧 Make sure the backend is running:
   - cd backend && python -m uvicorn app.main:app --reload
   - Or use Docker: docker-compose up backend
```

**Missing Dependencies**
```
💥 Missing dependencies: pytest, requests
🔧 Install with: pip install pytest requests
```

**Tests Timeout**
- Unit tests: 5 minute timeout
- Integration tests: 10 minute timeout  
- E2E tests: 15 minute timeout

If tests consistently timeout, check:
- Backend performance
- Database connectivity
- Whisper model loading time

### Verbose Output
```bash
python test_comprehensive_suite.py --verbose
```

This enables detailed logging for debugging test failures.

## 🎯 Test Scenarios Covered

### Normal Flow
1. Upload audio file
2. Start transcription
3. Monitor progress through all stages
4. Verify completion
5. Test resume (should indicate already complete)

### Restart Flow
1. Start transcription
2. Force restart during processing
3. Verify segments are cleared
4. Restart transcription
5. Complete successfully

### Error Recovery Flow
1. Simulate various error conditions
2. Test resume functionality
3. Verify error tracking
4. Confirm recovery mechanisms

### API Consistency
1. Multiple status requests return consistent data
2. Progress values are monotonically increasing
3. Error responses have proper status codes
4. All required fields are always present

## 📈 Success Metrics

A successful test run validates:
- **100% API Compatibility**: All endpoints work as expected
- **Restart/Resume Reliability**: Core functionality is robust
- **Progress Accuracy**: Real-time tracking is precise
- **Error Resilience**: System handles failures gracefully
- **State Consistency**: Database state is properly maintained

The test suite provides confidence that the enhanced transcription system is production-ready and can be trusted for critical transcription workflows.

## 🔗 Related Documentation

- [Main README](../README.md) - Project overview
- [API Documentation](../docs/development/API.md) - API reference
- [Backend Documentation](../backend/README.md) - Backend setup
- [Frontend Documentation](../frontend/README.md) - Frontend setup