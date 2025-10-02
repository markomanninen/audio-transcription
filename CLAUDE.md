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
5. Segment editing preserves original text
6. Speaker renaming updates across UI
7. Export format validation (SRT timestamps, HTML structure, TXT formatting)
8. Playback controls synchronization

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

## Phase 5: AI-Powered Corrections - Implementation Patterns

### Backend LLM Service Architecture

**Provider Pattern** (`backend/app/services/llm/`):
- Abstract base class `LLMProvider` with `correct_text()` and `health_check()` methods
- Concrete providers: `OllamaProvider`, `OpenRouterProvider`
- `LLMService` manages provider registry and routing

Example:
```python
# backend/app/services/llm/base.py
class LLMProvider(ABC):
    @abstractmethod
    async def correct_text(text: str, context: str = "", correction_type: str = "grammar") -> Dict[str, Any]:
        pass

    @abstractmethod
    async def health_check() -> bool:
        pass

# backend/app/services/llm/ollama_provider.py
class OllamaProvider(LLMProvider):
    async def correct_text(self, text: str, context: str = "", correction_type: str = "grammar"):
        prompt = self._build_prompt(text, context, correction_type)
        # Call Ollama API at http://ollama:11434/api/generate
        result = await client.post(f"{self.base_url}/api/generate", json={
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3}
        })
        return {
            "corrected_text": parsed_response,
            "original_text": text,
            "changes": detected_changes,
            "confidence": 0.85
        }
```

**API Endpoints** (`backend/app/api/ai_corrections.py`):
- `POST /api/ai/correct-segment` - Single segment correction
- `POST /api/ai/correct-batch` - Batch correction
- `GET /api/ai/providers` - List available providers
- `GET /api/ai/health` - Check provider health

Example:
```python
@router.post("/api/ai/correct-segment", response_model=CorrectionResponse)
async def correct_segment(request: SegmentCorrectionRequest, db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == request.segment_id).first()
    text_to_correct = segment.edited_text or segment.original_text

    llm_service = LLMService()
    result = await llm_service.correct_text(
        text=text_to_correct,
        provider=request.provider,
        correction_type=request.correction_type
    )
    return CorrectionResponse(**result, segment_id=segment.id)
```

### Frontend AI Components

**CorrectionDialog** (`frontend/src/components/AI/CorrectionDialog.tsx`):
- Shows original vs corrected text side-by-side
- Visual diff with red (original) and green (corrected) backgrounds
- Lists detected changes
- Confidence score with progress bar
- Accept/Reject buttons

**LLMSettings** (`frontend/src/components/Settings/LLMSettings.tsx`):
- Provider dropdown with health indicators
- Green dot = healthy, red dot = unavailable
- Auto-refresh health status every 30s
- Persisted to localStorage

**React Query Hooks** (`frontend/src/hooks/useAICorrections.ts`):
```typescript
export const useCorrectSegment = () => {
  return useMutation({
    mutationFn: (request: CorrectionRequest) => correctSegment(request),
    // Don't auto-invalidate - let user review first
  })
}

export const useProviderHealth = () => {
  return useQuery({
    queryKey: ['ai-health'],
    queryFn: checkProviderHealth,
    refetchInterval: 30000  // Check every 30s
  })
}
```

**Integration in SegmentList**:
- ✨ AI Correct button per segment (purple accent)
- Calls `handleAICorrect(segment)` → opens CorrectionDialog
- Uses selected provider from App context
- On accept, updates segment.edited_text via existing API

### Testing LLM Features

Mock LLM service in tests:
```python
@pytest.fixture
def mock_llm_service():
    with patch('app.api.ai_corrections.LLMService') as mock:
        service_instance = MagicMock()
        mock.return_value = service_instance
        service_instance.correct_text = AsyncMock(return_value={
            "original_text": "sentance",
            "corrected_text": "sentence",
            "changes": ['"sentance" → "sentence"'],
            "confidence": 0.95
        })
        yield service_instance
```

## Performance Considerations

- **Large files**: Audio processed in chunks; transcription streamed via WebSocket
- **Long transcriptions**: Frontend uses virtual scrolling for 1000+ segments
- **Database**: Index on `project_id`, `start_time` for fast segment queries
- **Caching**: Whisper models cached in Docker volume; transcriptions cached in DB
- **LLM**: Local Ollama for privacy/speed, OpenRouter for quality (cloud)

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
