# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: File Organization Rules

**NEVER POLLUTE THE PROJECT ROOT DIRECTORY. Follow these strict rules:**

### Where Files MUST Go

1. **Documentation Files**
   - Project docs → `/docs/` directory
   - Test-specific docs → `/tests/e2e/docs/` or `/tests/docs/`
   - API docs → `/docs/api/`
   - NEVER create `.md` files in root except: `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `LICENSE.md`

2. **Test Files**
   - E2E tests → `/tests/e2e/tests/`
   - Backend tests → `/backend/tests/`
   - Frontend tests → `/frontend/src/__tests__/`
   - Test helpers → `/tests/e2e/helpers/`
   - NEVER create test files (`.spec.ts`, `.test.js`, etc.) in project root

3. **Debug/Development Files**
   - Debug data → `/backend/debug/` or `/frontend/debug/`
   - Response captures → `/backend/debug/`
   - Development PIDs → `/tmp/` or `.dev_runner_pids.json` (gitignored)
   - NEVER commit debug `.json` files to root

4. **Scripts**
   - All executable scripts → `/scripts/` directory
   - Test runner scripts → `/tests/e2e/` or `/scripts/test/`
   - NEVER create `.sh` files in root except `docker-compose` helpers

5. **Configuration Files** (ONLY these are allowed in root)
   - `package.json`, `package-lock.json`
   - `docker-compose.yml`, `docker-compose.*.yml`
   - `.env.example`, `.gitignore`, `.dockerignore`
   - `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`

### Cleanup Protocol

**After creating any files, ALWAYS:**
1. Verify file location follows above rules
2. Move misplaced files to correct directories
3. Update any references/imports to new paths
4. Add temporary/debug files to `.gitignore`
5. Remove files before completing task

### Example Violations (FORBIDDEN)

```text
❌ /AI_EDITOR_TEST_RESULTS.md          → ✅ /tests/e2e/docs/AI_EDITOR_TEST_RESULTS.md
❌ /ai_editor_responses.json           → ✅ /backend/debug/ai_editor_responses.json
❌ /demo-ai-editor.sh                  → ✅ /scripts/demo-ai-editor.sh
❌ /DOCKER_AI_SETUP.md                 → ✅ /docs/DOCKER_AI_SETUP.md
❌ /test-something.spec.ts             → ✅ /tests/e2e/tests/test-something.spec.ts
❌ /.coverage (running pytest in root) → ✅ /backend/.coverage (run tests in backend/)
```

### Critical: Running Tests in Correct Directory

**NEVER run pytest or npm test from project root!**

- Backend tests: `cd backend && pytest` (creates `backend/.coverage`)
- Frontend tests: `cd frontend && npm test` (creates `frontend/coverage/`)
- E2E tests: `cd tests/e2e && npm test` (creates `tests/e2e/test-results/`)

**If you create files in wrong locations, the user will be justifiably angry. Follow these rules religiously.**

## Project Overview

Docker-hosted audio interview transcription application with advanced editing capabilities. Users upload audio files, get automatic transcription with speaker recognition, edit text interactively, compare original vs edited versions, use AI for spell/grammar checking, and export to SRT, HTML, and PDF formats.

## Current System State (October 9, 2025)

### Implementation Status
- ✅ **Phase 1-4**: Complete - Upload, transcription, editing, speaker management
- ✅ **Phase 5**: AI corrections with Ollama/OpenRouter integration
- ✅ **Phase 6**: Export functionality (SRT, HTML, TXT)
- ✅ **Critical Fixes**: Cache isolation, transcription status logic
- ✅ **Testing**: Comprehensive Playwright E2E test suite (6/12 tests passing)
- ✅ **Documentation**: Ready for GitHub publication

### Current Branch & Repository
- **Repository**: `markomanninen/audio-transcription`
- **Current Branch**: `feature-windows`
- **Default Branch**: `main`
- **Status**: Feature-complete, ready for merge to main

### Active Services
- **Backend**: FastAPI (Python) on port 8000
- **Frontend**: React/TypeScript (Vite) on port 3000
- **Redis**: Background task queue on port 6379 (internal)
- **Ollama**: Local LLM service on port 11434 (internal)
- **Database**: SQLite with audio file storage

## Architecture

### System Design

```text
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Frontend  │─────▶│  FastAPI Backend │─────▶│   Whisper   │
│  (React TS) │      │     (Python)     │      │ Transcriber │
└─────────────┘      └──────────────────┘      └─────────────┘
                             │
                             ├──────────────────┐
                             ▼                  ▼
                      ┌─────────────┐    ┌────────────┐
                      │   PyAnnote  │    │    LLM     │
                      │   Speaker   │    │  Services  │
                      │ Diarization │    │  (Ollama/  │
                      └─────────────┘    │ OpenRouter)│
                                         └────────────┘
```

### Backend Structure (`/backend`)

- **`app/api/`**: FastAPI route handlers organized by domain (upload, transcription, edit, export, ai_corrections)
- **`app/services/`**: Business logic layer
  - `audio_service.py`: File handling, format conversion
  - `transcription_service.py`: Whisper integration, job queue, resume capability
  - `speaker_service.py`: Diarization and speaker management  
  - `llm_service.py`: AI correction services (Ollama/OpenRouter)
  - `export_service.py`: SRT, HTML, TXT generation
- **`app/models/`**: SQLAlchemy ORM models (projects, segments, edits, speakers)
- **`app/core/`**: Configuration, dependencies, middleware
- **`tests/`**: Comprehensive test suite with fixtures and mocks

### Frontend Structure (`/frontend`)

- **`src/components/`**: React components
  - `Upload/`: Drag-drop file upload with progress tracking
  - `Player/`: Audio player with waveform and segment sync
  - `Dashboard/`: Project selector, file list, transcription progress
  - `Transcription/`: Segment list with speaker labels and timestamps
  - `Editor/`: Segment-based text editor with inline editing
  - `AI/`: AI correction dialog and provider management
  - `Export/`: Format selection and preview (SRT, HTML, TXT)
- **`src/hooks/`**: Custom React hooks
  - `useProjects`: Project CRUD operations
  - `useUpload`: File upload with progress tracking
  - `useTranscription`: Transcription status polling, segments, speakers
  - `useAICorrections`: LLM integration for text corrections
- **`src/api/`**: Axios client with React Query integration (v3 cache versioning)
- **`src/types/`**: TypeScript interfaces matching backend models
- **`tests/`**: Vitest unit tests and Playwright E2E tests

### Data Flow

1. **Upload**: Frontend → API → Storage → Database (metadata)
2. **Transcription**: Background job (Whisper) → Speaker diarization → Segments with speaker labels
3. **Editing**: User edits segment → Auto-save → Database (edit history with original preserved)
4. **AI Correction**: Segment text → LLM API (Ollama/OpenRouter) → Suggestions → User review
5. **Export**: Segments + metadata → Generator (SRT/HTML/TXT) → Download
6. **Cache Management**: React Query v3 versioned keys prevent cache contamination

### Key Integration Points

- **Audio-Text Sync**: Audio player current time maps to segment timestamps; clicking segment jumps audio
- **Speaker System**: Diarization assigns speaker IDs; users can rename, merge, or manually reassign
- **Edit Tracking**: Every segment edit stored with timestamp; original text immutable for comparison
- **LLM Abstraction**: Service layer supports multiple providers (Ollama local, OpenRouter cloud) via unified interface
- **Resume Capability**: Transcription can be interrupted and resumed; progress tracking prevents duplicate work
- **Cache Isolation**: React Query cache uses versioned keys to prevent cross-file data contamination

## Development, Testing & Production Conventions

### Environment Management

**Development Environment:**
```bash
# Quick start (recommended)
docker-compose up

# Development with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Windows PowerShell deployment script
.\scripts\deploy.ps1        # Quick restart (code changes)
.\scripts\deploy.ps1 build  # Full rebuild (dependencies)
.\scripts\deploy.ps1 status # Health check
```

**Environment Files:**
- `.env.example` - Template with safe defaults
- `.env` - Local development (gitignored)
- `.env.prod` - Production secrets (gitignored)

**Port Conventions:**
- `3000` - Frontend (Vite dev server)
- `8000` - Backend API (FastAPI)
- `6379` - Redis (internal Docker network only)
- `11434` - Ollama LLM (internal Docker network only)

### Testing Strategy

**Test Structure:**
```
tests/
├── backend/                    # Backend unit/integration tests
│   ├── test_transcription.py   # Core transcription functionality
│   ├── test_ai_corrections.py  # LLM integration tests
│   ├── test_export.py          # Export format validation
│   └── test_*.py              # Feature-specific tests
├── integration/                # Cross-service integration tests
└── e2e/                       # Playwright end-to-end tests
```

**Test Commands:**
```bash
# Backend tests (pytest)
cd backend && pytest                     # All tests
cd backend && pytest --cov=app          # With coverage
cd backend && pytest -k "transcription" # Specific tests

# Frontend tests (vitest)
cd frontend && npm test                  # Unit tests
cd frontend && npm run test:coverage    # With coverage
cd frontend && npm run test:e2e         # Playwright E2E

# Comprehensive test suite
cd tests && python test_comprehensive_suite.py
```

**Test Data:**
- `tests/fixtures/` - Sample audio files (30s clips for fast testing)
- `test-audio-30s.mp3` - Primary test file (682KB, real speech)
- Mock services for external dependencies (Whisper, LLM APIs)

### Production Deployment

**Docker Compose Production:**
```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Environment-specific overrides
# - SSL termination via nginx
# - Persistent volumes for data/models
# - Production environment variables
# - Health checks and restart policies
```

**Package Scripts (Root Level):**
```bash
npm run docker-dev       # Start development environment
npm run docker-build     # Build all containers
npm run docker-deploy    # Full production deployment
npm run logs:backend     # Service-specific logs
npm run logs:errors      # Error filtering
npm run logs:inspect     # Advanced log analysis
```

**Deployment Verification:**
```bash
# Health checks
curl http://localhost:8000/health        # Backend API
curl http://localhost:3000               # Frontend
.\scripts\deploy.ps1 status             # Full system status
```

### Code Quality & Standards

**Backend (Python/FastAPI):**
```bash
cd backend
black app tests                         # Code formatting
ruff check app tests                     # Linting
mypy app                                # Type checking
pytest --cov=app --cov-report=html     # Test coverage
```

**Frontend (React/TypeScript):**
```bash
cd frontend
npm run format                          # Prettier formatting
npm run lint                           # ESLint
npm run type-check                     # TypeScript validation
npm run test:coverage                  # Test coverage
```

**Git Workflow:**
- Feature branches from `main`
- Comprehensive testing before merge
- Documentation updates with features
- Environment secrets in `.env` (never committed)

### Performance & Monitoring

**Resource Limits:**
- Max upload size: 500MB
- Whisper model: `medium` (balanced speed/accuracy)
- LLM timeout: 30 seconds
- Audio formats: mp3, wav, m4a, mp4, webm, ogg, flac

**Monitoring:**
```bash
# Container logs
docker-compose logs -f backend          # Real-time backend logs
docker logs transcribe-backend-1 --tail 100  # Recent logs

# Service health
npm run logs:errors                     # Error detection
python scripts/log_inspector.py         # Advanced log analysis
```

**Cache Management:**
- Whisper models cached in Docker volumes
- React Query cache isolation (v3 versioned keys)
- Redis for background task state
- Database indexes on `project_id`, `start_time`

### Local Development (Outside Docker)

**Backend (Python/FastAPI):**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Configure environment
cp .env.example .env
# Edit .env with local settings (DATABASE_URL, OLLAMA_BASE_URL, etc.)
```

**Frontend (React/TypeScript):**
```bash
cd frontend
npm install
npm run dev

# Configure environment  
# VITE_API_BASE_URL=http://localhost:8000 (in .env or env vars)
```

### Rapid Development Commands

**Windows PowerShell Scripts:**
```powershell
# Quick deployment (code changes only)
.\scripts\deploy.ps1

# Full rebuild (dependency changes)  
.\scripts\deploy.ps1 build

# System status and health check
.\scripts\deploy.ps1 status
```

**NPM Root Scripts:**
```bash
npm run docker-dev       # Start development stack
npm run docker-restart   # Restart services (code changes)
npm run docker-build     # Rebuild containers
npm run logs:backend     # Backend logs
npm run logs:errors      # Error filtering  
npm run logs:transcription # Transcription-specific logs
```

## Configuration

### Environment Variables

**Backend Configuration (`.env`):**
```bash
# Application
DEBUG=True
DATABASE_URL=sqlite:///./data/transcriptions.db

# Audio Processing  
WHISPER_MODEL_SIZE=medium              # tiny|base|small|medium|large
MAX_UPLOAD_SIZE=524288000              # 500MB in bytes
AUDIO_STORAGE_PATH=./data/audio

# LLM Services
OLLAMA_BASE_URL=http://ollama:11434    # Docker internal
OLLAMA_MODEL=llama3.2:1b               # Default model
DEFAULT_LLM_PROVIDER=ollama            # ollama|openrouter
OPENROUTER_API_KEY=                    # Optional cloud LLM

# Background Tasks
REDIS_URL=redis://redis:6379/0

# Security
JWT_SECRET_KEY=development-secret-change-in-production
```

**Frontend Configuration (`.env`):**
```bash
VITE_API_BASE_URL=http://localhost:8000
```

### LLM Provider Configuration

**Ollama (Default - Local):**
- Runs in Docker container with `llama3.2:1b` model
- Internal network access only (`http://ollama:11434`)
- No external API keys required
- Models cached in persistent Docker volume

**OpenRouter (Optional - Cloud):**
1. Set `OPENROUTER_API_KEY` in backend `.env`
2. Update `DEFAULT_LLM_PROVIDER=openrouter` 
3. Configure via settings UI or environment

**External Ollama (Advanced):**
```bash
OLLAMA_EXTERNAL=true
OLLAMA_BASE_URL=http://external-host:11434
OLLAMA_API_KEY=optional-api-key
OLLAMA_VERIFY_SSL=true
```

## Important Patterns

### Audio Processing Pipeline

Transcription jobs are async background tasks using FastAPI BackgroundTasks. Status tracked via polling:

```python
# Backend pattern (app/api/transcription.py)
@router.post("/{file_id}/start")
async def start_transcription(file_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(transcription_service.transcribe_audio, file_id)
    return {"status": "processing"}

# Frontend pattern (useTranscription.ts)
const { data: status } = useTranscriptionStatus(fileId, 2000); // Polls every 2s
```

### Project Management

Projects are persisted in localStorage for convenience:

```typescript
// App.tsx pattern
const [projectId, setProjectId] = useState<number | null>(() => {
  const saved = localStorage.getItem('selectedProjectId')
  return saved ? parseInt(saved) : null
})

useEffect(() => {
  if (projectId) {
    localStorage.setItem('selectedProjectId', projectId.toString())
  }
  // Clear selected file when project changes
  setSelectedFileId(null)
}, [projectId])
```

### Segment Editing

Edits auto-save but maintain history. Original text is immutable:

```typescript
// Segment model (types/index.ts)
interface Segment {
  id: number;
  original_text: string;    // Never changes
  edited_text?: string;     // Latest user edit
  speaker_id?: number;
  start_time: number;
  end_time: number;
  sequence: number;
}
```

### Segment Editing (Phase 4)

Users can edit transcription text inline. Original text is immutable:

```python
# API endpoint: PATCH /api/transcription/segment/{segment_id}
@router.patch("/segment/{segment_id}")
async def update_segment(segment_id: int, request: SegmentUpdateRequest):
    segment.edited_text = request.edited_text  # Original text preserved
    return segment
```

Frontend editing pattern:

```typescript
// SegmentList.tsx
const updateSegment = useUpdateSegment()
const handleSaveEdit = async (segmentId: number) => {
  await updateSegment.mutateAsync({ segmentId, editedText: editText.trim() })
}
```

### Speaker Management (Phase 4)

Speakers can be renamed via UI. API updates display name:

```python
# API endpoint: PUT /api/transcription/speaker/{speaker_id}
@router.put("/speaker/{speaker_id}")
async def update_speaker(speaker_id: int, request: dict):
    speaker.display_name = request["display_name"]
    return speaker
```

Frontend component: `SpeakerManager.tsx` with inline editing

### Audio Playback Controls (Phase 4)

Synchronized playback between main player and segments:

```typescript
// App.tsx manages state
const [isAudioPlaying, setIsAudioPlaying] = useState(false)
const [shouldPlayAudio, setShouldPlayAudio] = useState(false)
const [shouldPauseAudio, setShouldPauseAudio] = useState(false)

// AudioPlayer receives props and notifies parent
<AudioPlayer
  shouldPlay={shouldPlayAudio}
  shouldPause={shouldPauseAudio}
  onPlayingChange={setIsAudioPlaying}
/>

// SegmentList shows contextual controls
- Play (▶): Resumes if active, seeks if not
- Pause (⏸): Only visible when active and playing
- Replay (↻): Restarts segment from beginning
```

### Export Generation (Phase 6)

Three export formats with customizable options:

```python
# Backend: app/services/export_service.py
class ExportService:
    def generate_srt(file_id, db, use_edited=True, include_speakers=True)
    def generate_html(file_id, db, use_edited=True, include_speakers=True, include_timestamps=True)
    def generate_txt(file_id, db, use_edited=True, include_speakers=True, include_timestamps=False)
```

API endpoints:

```python
# GET /api/export/{file_id}/srt?use_edited=true&include_speakers=true
# GET /api/export/{file_id}/html?use_edited=true&include_speakers=true&include_timestamps=true
# GET /api/export/{file_id}/txt?use_edited=true&include_speakers=true&include_timestamps=false
```

Frontend component:

```typescript
// ExportDialog.tsx - Modal with options
<ExportDialog
  fileId={selectedFileId}
  filename={selectedFile.original_filename}
  onClose={() => setShowExportDialog(false)}
/>

// Options:
- Use edited text (checkbox)
- Include speaker names (checkbox)
- Include timestamps (checkbox, HTML/TXT only)

// Downloads file with proper Content-Disposition header
```

Export formats:
- **SRT**: Standard subtitles (HH:MM:SS,mmm format)
- **HTML**: Styled document with metadata and formatted segments
- **TXT**: Plain text with optional timestamps

## Testing Guidelines

### Test Structure & Coverage

**Backend Tests (`/backend/tests/`):**
- `test_transcription.py` - Core transcription functionality with resume capability
- `test_ai_corrections.py` - LLM integration and provider abstraction
- `test_export.py` - Format generation (SRT, HTML, TXT)
- `test_force_restart.py` - Transcription restart and recovery
- `test_segment_editing.py` - Segment CRUD with edit history
- `test_upload.py` - File validation and storage
- `conftest.py` - Shared fixtures and test database setup

**Frontend Tests (`/frontend/src/`):**
- Unit tests with Vitest and Testing Library
- Mock Service Worker (MSW) for API mocking
- Playwright E2E tests for critical workflows

**Integration Tests (`/tests/`):**
- Cross-service integration testing
- Real audio file processing with test fixtures
- Comprehensive test suite runner

### Test Execution

**Backend Testing:**
```bash
cd backend
pytest                                    # All tests
pytest --cov=app --cov-report=html       # With coverage report  
pytest -k "transcription" -v             # Specific functionality
pytest tests/test_ai_corrections.py      # Single test file
```

**Frontend Testing:**
```bash
cd frontend  
npm test                                  # Unit tests with Vitest
npm run test:watch                       # Watch mode
npm run test:coverage                    # Coverage report
npm run test:e2e                        # Playwright E2E tests
npm run test:e2e:ui                     # E2E with UI
```

**Comprehensive Testing:**
```bash
cd tests
python test_comprehensive_suite.py       # Full test suite
python test_comprehensive_suite.py --only-unit  # Unit tests only
```

### Test Data & Fixtures

**Audio Test Files:**
- `test-audio-30s.mp3` (682KB) - Primary test file with real speech
- Located in `tests/fixtures/` for backend tests
- Playwright tests use uploaded test files

**Mock Configuration:**
- LLM services mocked for unit tests
- Test database isolation with SQLite `:memory:`
- API endpoints mocked with MSW in frontend tests

### Critical Test Scenarios

1. **Upload Validation**: Multiple audio formats (mp3, wav, m4a, webm)
2. **Transcription Pipeline**: Whisper integration with speaker diarization
3. **Resume Functionality**: Interruption and restart of transcription jobs
4. **Cache Isolation**: React Query v3 cache versioning prevents contamination
5. **Segment Editing**: Original text preservation with edit history
6. **AI Corrections**: LLM provider abstraction (Ollama/OpenRouter)
7. **Export Formats**: SRT timestamps, HTML structure, TXT formatting
8. **Audio Sync**: Player-segment synchronization (±100ms tolerance)

### Test Environment Setup

**Prerequisites:**
```bash
# Backend test dependencies
cd backend && pip install -r requirements.txt

# Frontend test dependencies  
cd frontend && npm install

# E2E test setup
npx playwright install
```

**Database Testing:**
- Uses separate test database (SQLite in-memory)
- Automatic fixture cleanup between tests
- Real file I/O for integration tests

## Implementation Status & Known Issues

### Completed Features ✅

**Core Functionality:**
- Multi-format audio upload with validation
- Whisper-based transcription with resume capability  
- PyAnnote speaker diarization and management
- Inline segment editing with original text preservation
- AI-powered corrections via Ollama/OpenRouter
- Export to SRT, HTML, and TXT formats
- Real-time audio-text synchronization

**Technical Implementation:**
- Docker containerization with development/production configs
- FastAPI backend with async processing
- React Query v3 with cache isolation (versioned keys)
- Comprehensive test suite (Playwright E2E + pytest)
- PowerShell deployment automation for Windows

### Current Test Status

**Playwright E2E Tests (6/12 passing):**
- ✅ Frontend loads successfully
- ✅ Backend API accessible  
- ✅ Data attributes for testing
- ⏭️ File upload tests (require test data)
- ⏭️ Transcription workflow tests (require test data)
- ⏭️ Export functionality tests (require test data)

**Backend Tests:**
- ✅ Full pytest suite passing
- ✅ Coverage reports available
- ✅ Integration tests with real audio processing

### Known Limitations

**Performance:**
- Max file size: 500MB
- Whisper model: `medium` (balance of speed/accuracy)
- LLM timeout: 30 seconds
- Large transcriptions: Virtual scrolling for 1000+ segments

**Audio Support:**
- Formats: mp3, wav, m4a, mp4, webm, ogg, flac
- Speaker diarization: Works best with 2-4 distinct speakers
- Language: Optimized for English (Whisper supports others)

**Browser Compatibility:**
- Modern browsers with Web Audio API support
- File API for drag-drop uploads
- ES6+ JavaScript features

## Common Development Workflows

### Adding a New Export Format

1. Add format to `ExportFormat` enum in `backend/app/models/export.py`
2. Implement generator in `backend/app/services/export_service.py`
3. Add format option in `frontend/src/components/Export/FormatSelector.tsx`
4. Write tests in `backend/tests/test_export.py`
5. Update documentation and type definitions

### Integrating New LLM Provider

1. Create provider client in `backend/app/services/llm/providers/`
2. Implement `LLMProvider` interface with required methods:
   - `correct_text()` - Main correction functionality
   - `health_check()` - Service availability check
3. Register in `llm_service.py` provider factory
4. Add configuration in settings UI component
5. Write comprehensive tests with mocked responses

### Adding New Audio Format Support

1. Add format to `ALLOWED_AUDIO_FORMATS` in `backend/app/core/config.py`
2. Ensure ffmpeg handles conversion in `audio_service.py`
3. Update upload validation in `frontend/src/components/Upload/FileUploader.tsx`
4. Add format to type definitions
5. Test with sample files and update documentation

### Debugging Common Issues

**Transcription Status Issues:**
```bash
# Check backend logs for transcription progress
npm run logs:transcription

# Inspect database state
sqlite3 backend/data/transcriptions.db
.tables
SELECT status, progress FROM transcription_jobs;
```

**Cache Contamination:**
- Check React Query DevTools for cache keys
- Verify v3 cache versioning in API calls
- Clear browser storage if needed

**LLM Provider Issues:**
```bash  
# Check Ollama service health
curl http://localhost:8000/api/ai/health

# Verify model availability
docker-compose exec ollama ollama list
```

### Performance Optimization

**Large File Handling:**
- Use appropriate Whisper model size (`tiny` for testing, `medium` for production)
- Monitor memory usage during transcription
- Implement chunked processing for very large files

**Frontend Performance:**
- Virtual scrolling for large transcriptions
- React Query caching with proper invalidation
- Lazy loading of audio waveforms

### Production Deployment Checklist

1. ✅ Environment variables configured (`.env.prod`)
2. ✅ SSL certificates and reverse proxy setup
3. ✅ Database backups configured
4. ✅ Volume mounts for persistent data
5. ✅ Health checks for all services
6. ✅ Log aggregation and monitoring
7. ✅ Resource limits and scaling policies

## Important Patterns & Implementation Details

### Audio Processing Pipeline

Transcription jobs use FastAPI BackgroundTasks with resume capability:

```python
# Backend pattern (app/api/transcription.py)
@router.post("/{file_id}/start")
async def start_transcription(file_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(transcription_service.transcribe_audio, file_id)
    return {"status": "processing"}

# Resume functionality (app/services/transcription_service.py)
async def transcribe_audio(file_id: int):
    # Check for existing segments and resume from last processed point
    existing_segments = get_existing_segments(file_id)
    if existing_segments:
        start_time = max(seg.end_time for seg in existing_segments)
    else:
        start_time = 0.0
    # Continue processing from start_time...
```

Frontend polling with React Query:

```typescript
// Frontend pattern (useTranscription.ts)
const { data: status } = useQuery({
  queryKey: ['transcription-status', fileId, 'v3'], // v3 cache versioning
  queryFn: () => getTranscriptionStatus(fileId),
  refetchInterval: (data) => {
    return data?.status === 'processing' ? 2000 : false // Poll every 2s while processing
  }
});
```

### Project Management

Projects persisted in localStorage with React Query cache integration:

```typescript
// App.tsx pattern
const [projectId, setProjectId] = useState<number | null>(() => {
  const saved = localStorage.getItem('selectedProjectId')
  return saved ? parseInt(saved) : null
})

useEffect(() => {
  if (projectId) {
    localStorage.setItem('selectedProjectId', projectId.toString())
  }
  // Clear selected file when project changes (prevents cache contamination)
  setSelectedFileId(null)
}, [projectId])

// Clear related caches when switching projects
const queryClient = useQueryClient()
useEffect(() => {
  if (projectId) {
    queryClient.removeQueries({ queryKey: ['files'], exact: false })
    queryClient.removeQueries({ queryKey: ['transcription'], exact: false })
  }
}, [projectId, queryClient])
```

### Segment Editing with History

Edits auto-save while preserving original text:

```typescript
// Segment model (types/index.ts)
interface Segment {
  id: number;
  original_text: string;    // Immutable - never changes
  edited_text?: string;     // Latest user edit - can be null
  speaker_id?: number;
  start_time: number;
  end_time: number;
  sequence: number;
}

// Frontend editing pattern (SegmentList.tsx)
const updateSegment = useUpdateSegment()

const handleSaveEdit = async (segmentId: number) => {
  const trimmedText = editText.trim()
  
  // Only save if text actually changed
  if (trimmedText !== (segment.edited_text || segment.original_text)) {
    await updateSegment.mutateAsync({ 
      segmentId, 
      editedText: trimmedText || null // null if empty (revert to original)
    })
  }
}
```

Backend API preserves history:

```python
# API endpoint: PATCH /api/transcription/segment/{segment_id}
@router.patch("/segment/{segment_id}")
async def update_segment(segment_id: int, request: SegmentUpdateRequest):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    
    # Only update edited_text, original_text remains immutable
    segment.edited_text = request.edited_text
    segment.updated_at = datetime.utcnow()
    
    db.commit()
    return segment
```

### Speaker Management

Speakers renamed via inline editing with immediate UI updates:

```python
# API endpoint: PUT /api/transcription/speaker/{speaker_id}
@router.put("/speaker/{speaker_id}")
async def update_speaker(speaker_id: int, request: dict):
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    speaker.display_name = request["display_name"]
    db.commit()
    return speaker
```

Frontend component with optimistic updates:

```typescript
// SpeakerManager.tsx
const updateSpeaker = useUpdateSpeaker()

const handleSpeakerRename = async (speakerId: number, newName: string) => {
  // Optimistic update
  queryClient.setQueryData(['speakers', fileId, 'v3'], (old: Speaker[]) =>
    old.map(s => s.id === speakerId ? { ...s, display_name: newName } : s)
  )
  
  try {
    await updateSpeaker.mutateAsync({ speakerId, displayName: newName })
  } catch (error) {
    // Revert on error
    queryClient.invalidateQueries(['speakers', fileId, 'v3'])
  }
}
```

### Audio Playback Synchronization

Centralized playback state management:

```typescript
// App.tsx manages global audio state
const [isAudioPlaying, setIsAudioPlaying] = useState(false)
const [shouldPlayAudio, setShouldPlayAudio] = useState(false)
const [shouldPauseAudio, setShouldPauseAudio] = useState(false)
const [audioCurrentTime, setAudioCurrentTime] = useState(0)

// AudioPlayer component receives props and notifies parent
<AudioPlayer
  shouldPlay={shouldPlayAudio}
  shouldPause={shouldPauseAudio}
  onPlayingChange={setIsAudioPlaying}
  onTimeUpdate={setAudioCurrentTime}
  onShouldPlayHandled={() => setShouldPlayAudio(false)}
  onShouldPauseHandled={() => setShouldPauseAudio(false)}
/>

// SegmentList shows contextual controls based on current playback
const isSegmentActive = audioCurrentTime >= segment.start_time && 
                       audioCurrentTime <= segment.end_time

// Play button: Resume if active segment, seek if not
const handlePlay = () => {
  if (isSegmentActive && !isAudioPlaying) {
    setShouldPlayAudio(true) // Resume current position
  } else {
    setAudioSeekTime(segment.start_time) // Seek to segment start
    setShouldPlayAudio(true)
  }
}
```

### AI Corrections Integration

LLM provider abstraction with health monitoring:

```python
# Backend: app/services/llm/base.py
class LLMProvider(ABC):
    @abstractmethod
    async def correct_text(self, text: str, correction_type: str = "grammar") -> Dict[str, Any]:
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        pass

# Ollama implementation
class OllamaProvider(LLMProvider):
    async def correct_text(self, text: str, correction_type: str = "grammar"):
        prompt = self._build_correction_prompt(text, correction_type)
        
        response = await self.client.post(f"{self.base_url}/api/generate", json={
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "max_tokens": 500}
        })
        
        return {
            "original_text": text,
            "corrected_text": self._parse_response(response.json()),
            "changes": self._detect_changes(text, corrected_text),
            "confidence": 0.85,
            "provider": "ollama"
        }
```

Frontend AI integration with visual diff:

```typescript
// CorrectionDialog.tsx - Shows side-by-side comparison
const CorrectionDialog = ({ segment, onAccept, onReject }) => {
  const correctSegment = useCorrectSegment()
  
  const handleCorrect = async () => {
    const result = await correctSegment.mutateAsync({
      segmentId: segment.id,
      provider: selectedProvider,
      correctionType: 'grammar'
    })
    setCorrectionResult(result)
  }
  
  return (
    <div className="correction-dialog">
      <div className="text-comparison">
        <div className="original-text">
          {/* Highlighted differences in red */}
          <DiffText text={correctionResult.original_text} type="removed" />
        </div>
        <div className="corrected-text">
          {/* Highlighted differences in green */}
          <DiffText text={correctionResult.corrected_text} type="added" />
        </div>
      </div>
      
      <div className="changes-list">
        {correctionResult.changes.map(change => (
          <div key={change} className="change-item">{change}</div>
        ))}
      </div>
      
      <div className="confidence">
        Confidence: {(correctionResult.confidence * 100).toFixed(0)}%
      </div>
    </div>
  )
}
```

### Export Generation

Three export formats with customizable options:

```python
# Backend: app/services/export_service.py
class ExportService:
    def generate_srt(self, file_id: int, db: Session, use_edited=True, include_speakers=True):
        segments = self._get_segments(file_id, db, use_edited)
        
        srt_content = []
        for i, segment in enumerate(segments, 1):
            # SRT format: sequence number, timestamp, text
            start_time = self._format_srt_time(segment.start_time)
            end_time = self._format_srt_time(segment.end_time)
            
            text = segment.edited_text if (use_edited and segment.edited_text) else segment.original_text
            if include_speakers and segment.speaker:
                text = f"{segment.speaker.display_name}: {text}"
            
            srt_content.append(f"{i}\n{start_time} --> {end_time}\n{text}\n")
        
        return "\n".join(srt_content)
    
    def generate_html(self, file_id: int, db: Session, use_edited=True, include_speakers=True, include_timestamps=True):
        # Styled HTML with metadata and formatted segments
        pass
    
    def generate_txt(self, file_id: int, db: Session, use_edited=True, include_speakers=True, include_timestamps=False):
        # Plain text with optional timestamps
        pass
```

Frontend export dialog with real-time preview:

```typescript
// ExportDialog.tsx
const ExportDialog = ({ fileId, filename, onClose }) => {
  const [options, setOptions] = useState({
    format: 'srt' as ExportFormat,
    useEdited: true,
    includeSpeakers: true,
    includeTimestamps: true
  })
  
  const exportQuery = useQuery({
    queryKey: ['export-preview', fileId, options, 'v3'],
    queryFn: () => getExportPreview(fileId, options),
    enabled: !!fileId
  })
  
  const handleDownload = () => {
    const blob = new Blob([exportQuery.data], { 
      type: getContentType(options.format) 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.${options.format}`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  return (
    <Dialog>
      <div className="export-options">
        <FormatSelector value={options.format} onChange={handleFormatChange} />
        <OptionsCheckboxes options={options} onChange={setOptions} />
      </div>
      
      <div className="export-preview">
        <pre>{exportQuery.data}</pre>
      </div>
      
      <div className="export-actions">
        <Button onClick={handleDownload}>Download</Button>
      </div>
    </Dialog>
  )
}
```

## Performance Considerations

- **Large files**: Audio processed in chunks with resume capability
- **Long transcriptions**: Virtual scrolling for 1000+ segments in frontend
- **Database**: Indexes on `project_id`, `start_time`, `file_id` for fast queries
- **Caching**: 
  - Whisper models cached in Docker volumes
  - React Query with v3 cache versioning prevents contamination
  - Database query result caching for repeated segment access
- **LLM**: Local Ollama for privacy/speed, OpenRouter for cloud quality
- **Memory**: Background transcription with cleanup of intermediate results

## Security Notes

- File uploads validated for type, size, and content (magic number verification)
- Audio files stored outside web root with UUID filenames
- API rate limiting on expensive operations (transcription, LLM requests)
- CORS configured for frontend origin only
- JWT authentication for API endpoints (except health checks)
- Environment secrets never committed to repository
- SQLite database with proper file permissions

## Deployment

Production deployment uses `docker-compose.yml` with `docker-compose.prod.yml` overrides:

- Nginx reverse proxy for SSL termination and static file serving
- Persistent Docker volumes for database, audio files, and model cache
- Environment-specific secrets via `.env.prod`
- Health checks and restart policies for all services
- Resource limits and monitoring integration

Quick deployment commands:
```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Health verification
curl -f http://localhost:8000/health
curl -f http://localhost:3000

# Log monitoring
npm run logs:errors
npm run logs:inspect
```
