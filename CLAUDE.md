# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Docker-hosted audio interview transcription application with advanced editing capabilities. Users upload audio files, get automatic transcription with speaker recognition, edit text interactively, compare original vs edited versions, use AI for spell/grammar checking, and export to SRT, HTML, and PDF formats.

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

- **`app/api/`**: FastAPI route handlers organized by domain (upload, transcription, edit, export)
- **`app/services/`**: Business logic layer
  - `audio_service.py`: File handling, format conversion
  - `transcription_service.py`: Whisper integration, job queue
  - `speaker_service.py`: Diarization and speaker management
  - `llm_service.py`: AI correction services (local/cloud)
  - `export_service.py`: SRT, HTML, PDF generation
- **`app/models/`**: SQLAlchemy ORM models (projects, segments, edits, speakers)
- **`app/core/`**: Configuration, dependencies, middleware
- **`app/workers/`**: Background task workers (Celery/RQ)

### Frontend Structure (`/frontend`)

- **`src/components/`**: React components
  - `Upload/`: Drag-drop file upload with progress
  - `Player/`: Audio player with waveform and sync
  - `Dashboard/`: Project selector, file list, transcription progress
  - `Transcription/`: Segment list with speaker labels and timestamps
  - `Editor/`: Segment-based text editor (Phase 4)
  - `Comparison/`: Side-by-side original vs edited view (Phase 5)
  - `Export/`: Format selection and preview (Phase 6)
- **`src/hooks/`**: Custom React hooks
  - `useProjects`: Project CRUD operations
  - `useUpload`: File upload with progress tracking
  - `useTranscription`: Transcription status polling, segments, speakers
- **`src/api/`**: Axios client with React Query integration
- **`src/types/`**: TypeScript interfaces matching backend models

### Data Flow

1. **Upload**: Frontend → API → Storage → Database (metadata)
2. **Transcription**: Background job (Whisper) → Speaker diarization → Segments with speaker labels
3. **Editing**: User edits segment → Auto-save → Database (edit history)
4. **AI Correction**: Segment text → LLM API → Suggestions → User review
5. **Export**: Segments + metadata → Generator (SRT/HTML/PDF) → Download

### Key Integration Points

- **Audio-Text Sync**: Audio player current time maps to segment timestamps; clicking segment jumps audio
- **Speaker System**: Diarization assigns speaker IDs; users can rename, merge, or manually reassign
- **Edit Tracking**: Every segment edit stored with timestamp for comparison and revert
- **LLM Abstraction**: Service layer supports multiple providers (Ollama local, OpenRouter cloud) via unified interface

## Development Commands

### Docker Environment

```bash
# Start all services (backend, frontend, ollama)
docker-compose up

# Development mode with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Rebuild after dependency changes
docker-compose up --build

# Stop services
docker-compose down

# View logs
docker-compose logs -f [service_name]

# Shell access
docker-compose exec backend bash
docker-compose exec frontend sh
```

### Backend (Python/FastAPI)

```bash
# Run locally (outside Docker)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Run tests
pytest                              # All tests
pytest tests/test_transcription.py  # Specific module
pytest -k "test_upload"             # Tests matching pattern
pytest --cov=app --cov-report=html  # Coverage report

# Code quality
black app tests                     # Format
ruff check app tests                # Lint
mypy app                            # Type check

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Frontend (React/TypeScript)

```bash
# Run locally (outside Docker)
cd frontend
npm install
npm run dev

# Run tests
npm test                            # All tests
npm test -- Upload                  # Specific component
npm test -- --coverage              # Coverage report

# Build
npm run build                       # Production build
npm run preview                     # Preview production build

# Code quality
npm run lint                        # ESLint
npm run type-check                  # TypeScript check
npm run format                      # Prettier
```

### Integration & E2E Tests

```bash
# E2E tests (Playwright)
cd tests/e2e
npx playwright test                 # All E2E tests
npx playwright test --headed        # With browser UI
npx playwright test --debug         # Debug mode
npx playwright show-report          # View report

# Integration tests
pytest tests/integration/
```

## Configuration

### Environment Variables

- **Backend**: Copy `.env.example` to `.env` and configure:
  - `OPENROUTER_API_KEY`: For cloud LLM services (optional, uses Ollama by default)
  - `WHISPER_MODEL_SIZE`: `tiny|base|small|medium|large` (default: `base`)
  - `MAX_UPLOAD_SIZE`: File size limit (default: `500MB`)

- **Frontend**: `.env` for Vite:
  - `VITE_API_BASE_URL`: Backend URL (default: `http://localhost:8000`)

### LLM Provider Configuration

Default is Ollama with `llama3.2:1b` model. To use OpenRouter:

1. Set `OPENROUTER_API_KEY` in backend `.env`
2. Update `DEFAULT_LLM_PROVIDER=openrouter` in settings UI or env

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

### Speaker Management

Speakers identified by diarization (Speaker 0, 1, 2...). Users rename them:

```python
# Service ensures all segment references update when speaker renamed
speaker_service.rename_speaker(project_id, speaker_id, new_name)
```

### Export Generation

All exports support both original and edited text:

```python
# Export service pattern
export_service.generate_srt(
    project_id,
    use_edited=True,  # False for original transcription
    include_speakers=True
)
```

## Testing Guidelines

### Backend Tests

- **Unit tests**: Mock external services (Whisper, LLM APIs)
- **Integration tests**: Use test database, real file I/O
- **Test files**: Include small sample audio files in `tests/fixtures/`

### Frontend Tests

- **Component tests**: Mock API calls with MSW (Mock Service Worker)
- **Integration tests**: Test component interactions
- **E2E tests**: Full workflows with test audio files

### Critical Test Scenarios

1. Upload various audio formats (mp3, wav, m4a, webm)
2. Transcription accuracy with sample interviews
3. Speaker diarization with 2-4 speakers
4. Audio-text sync accuracy (±100ms acceptable)
5. LLM correction quality
6. Export format validation (SRT timestamps, PDF layout)

## Common Workflows

### Adding a New Export Format

1. Add format to `ExportFormat` enum in `backend/app/models/export.py`
2. Implement generator in `backend/app/services/export_service.py`
3. Add format option in `frontend/src/components/Export/FormatSelector.tsx`
4. Write tests in `tests/test_export.py`

### Integrating New LLM Provider

1. Create provider client in `backend/app/services/llm/providers/`
2. Implement `LLMProvider` interface (methods: `correct_spelling`, `correct_grammar`)
3. Register in `llm_service.py` provider factory
4. Add configuration in settings UI

### Adding New Audio Format Support

1. Add format to allowed list in `backend/app/core/config.py`
2. Ensure ffmpeg handles conversion in `audio_service.py`
3. Update upload validation in `frontend/src/components/Upload/FileUploader.tsx`
4. Test with sample file

## Performance Considerations

- **Large files**: Audio processed in chunks; transcription streamed via WebSocket
- **Long transcriptions**: Frontend uses virtual scrolling for 1000+ segments
- **Database**: Index on `project_id`, `start_time` for fast segment queries
- **Caching**: Whisper models cached in Docker volume; transcriptions cached in DB

## Security Notes

- File uploads validated for type, size, and content (magic bytes)
- Audio files stored outside web root with UUID filenames
- API rate limiting on expensive operations (transcription, LLM)
- CORS configured for frontend origin only
- JWT authentication required for all API endpoints (except health check)

## Deployment

Production deployment uses the same `docker-compose.yml` with overrides in `docker-compose.prod.yml`:

- Nginx reverse proxy for SSL termination
- Persistent volumes for database and audio files
- Environment-specific secrets via `.env.prod`
- Health checks for all services

See `docs/DEPLOYMENT.md` for complete production setup guide.
