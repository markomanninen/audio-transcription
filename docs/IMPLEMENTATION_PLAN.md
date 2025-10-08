# Audio Interview Transcription App - Implementation Plan

## Project Overview

Docker-hosted web application for audio interview transcription with advanced editing capabilities, speaker recognition, AI-powered corrections, and multiple export formats.

## Tech Stack Decisions

### Backend

- **Python + FastAPI**: Fast, modern API framework with async support
- **Whisper (OpenAI)**: For audio transcription
- **PyAnnote Audio**: For speaker diarization
- **SQLite**: Lightweight database for metadata and edits
- **OpenRouter API**: For LLM services (spell/grammar checking)
- **Ollama (llama3.2:1b)**: Default local LLM option

### Frontend

- **React + TypeScript**: Modern UI with strong typing
- **Tailwind CSS**: Rapid styling
- **Web Audio API**: For audio playback and waveform visualization
- **React Query**: State management for API calls

### Infrastructure

- **Docker + Docker Compose**: Container orchestration
- **Nginx**: Reverse proxy
- **Volume mounts**: Persistent storage for audio files and database

## Development Phases

**Status Legend**: ✅ Complete | 🚧 In Progress | ⏳ Pending

### Phase 1: Project Foundation (Tests + Docs) ✅

**Goal**: Set up project structure, Docker environment, and basic CI/CD

**Tasks**:

1. Initialize project structure
   - `/backend` - FastAPI application
   - `/frontend` - React application
   - `/tests` - Integration and unit tests
   - `/docs` - API and user documentation

2. Create Docker infrastructure
   - `Dockerfile.backend` - Python environment with audio libraries
   - `Dockerfile.frontend` - Node.js build environment
   - `docker-compose.yml` - Services orchestration
   - `docker-compose.dev.yml` - Development overrides

3. Set up testing framework
   - Backend: pytest + pytest-asyncio + httpx
   - Frontend: Jest + React Testing Library
   - E2E: Playwright

4. Create documentation structure
   - API documentation (OpenAPI/Swagger)
   - User guide
   - Development guide (CLAUDE.md)

**Deliverables**:

- Running Docker environment
- Test infrastructure
- CLAUDE.md with project conventions
- README.md with setup instructions

**Status**: ✅ Complete
- Docker environment functional
- Testing framework set up (pytest, Vitest, Playwright)
- CLAUDE.md created and maintained
- README.md with setup instructions

---

### Phase 2: Core Backend Services ✅

**Goal**: Implement audio processing and transcription pipeline

**Tasks**:

1. Audio file handling
   - Upload endpoint with validation (format, size)
   - Storage service (local filesystem)
   - Audio format conversion (ffmpeg)

2. Transcription service
   - Whisper integration with multiple model sizes
   - Background job queue (Celery or RQ)
   - Progress tracking via WebSocket

3. Speaker diarization
   - PyAnnote audio integration
   - Speaker segmentation and labeling
   - Merge transcription + speaker labels

4. Database models
   - Projects (interview sessions)
   - Audio files
   - Transcription segments
   - Edit history
   - Speaker profiles

5. API endpoints
   - `POST /api/upload` - Upload audio
   - `POST /api/transcribe/{file_id}` - Start transcription
   - `GET /api/transcription/{file_id}` - Get transcription status/result
   - `GET /api/transcription/{file_id}/segments` - Get editable segments

**Tests**:

- Audio upload validation ✅
- Transcription accuracy (sample audio) ✅
- Speaker diarization accuracy ✅
- API endpoint responses ✅

**Status**: ✅ Complete
- Audio upload with validation working
- Whisper transcription integrated
- PyAnnote speaker diarization working
- All database models and API endpoints implemented

---

### Phase 3: Frontend - Upload & Transcription UI ✅

**Goal**: User can upload files and view transcription progress

**Tasks**:

1. File upload component
   - Drag-and-drop interface
   - Format validation
   - Upload progress bar

2. Transcription dashboard
   - List of uploaded files
   - Transcription status indicators
   - Real-time progress via WebSocket

3. Basic audio player
   - Play/pause controls
   - Timeline scrubbing
   - Current time display

4. Transcription display
   - Segment-based text view
   - Speaker labels
   - Timestamps

**Tests**:

- File upload flow ✅
- Progress tracking ✅
- Audio playback ✅
- Transcription rendering ✅

**Status**: ✅ Complete
- Drag-and-drop file upload working
- Real-time transcription progress with polling
- Audio player with timeline and controls
- Segment display with speaker labels
- Project management (create, select, edit) with localStorage

---

### Phase 4: Advanced Editor Features ✅

**Goal**: Rich editing experience with text-audio synchronization

**Tasks**:

1. Line-level editing
   - Click to edit individual segments
   - Auto-save edits to database
   - Edit history tracking

2. Audio-text synchronization
   - Click segment to jump to audio position
   - Highlight active segment during playback
   - Waveform visualization with segments

3. Speaker management
   - Rename speakers
   - Merge/split speaker segments
   - Speaker color coding

4. Text comparison view
   - Side-by-side: original vs edited
   - Diff highlighting (additions, deletions, changes)
   - Revert to original option

**Tests**:

- Segment editing and persistence ✅
- Audio-text sync accuracy ✅
- Speaker operations ✅
- Original vs edited text comparison ✅

**Status**: ✅ Complete
- Inline segment editing with Save/Cancel
- Audio seek on segment click (play button)
- Active segment highlighting during playback
- Speaker renaming with SpeakerManager component
- Synchronized play/pause/replay controls (main + segment level)
- Original text shown below edited text in italic

---

### Phase 5: AI-Powered Corrections ✅

**Goal**: Spell check, grammar correction, and formatting improvements

**Status**: ✅ Complete

**Tasks**:

1. LLM service integration ✅
   - Base LLMProvider interface (abstract class)
   - Ollama local client (llama3.2:1b) with health checks
   - OpenRouter API client for cloud inference
   - LLMService managing multiple providers

2. Correction features ✅
   - Spell check per segment
   - Grammar correction
   - Punctuation improvement
   - Correction types: grammar, spelling, punctuation, all
   - Batch processing endpoint for multiple segments

3. Review interface ✅
   - CorrectionDialog component with visual diff
   - Accept/reject individual suggestions
   - Confidence scores with progress bar
   - Change detection and display
   - ✨ AI Correct button per segment

4. Settings management ✅
   - LLMSettings component with provider dropdown
   - Health status indicators (green/red dots)
   - Provider selection persisted to localStorage
   - Real-time health monitoring (30s intervals)

**Tests**:

- LLM API integration ✅
- Correction accuracy ✅
- Batch correction ✅
- Error handling ✅
- Provider health checks ✅

---

### Phase 6: Export Functionality ✅

**Goal**: Generate professional outputs in multiple formats

**Tasks**:

1. SRT export
   - Raw transcription with timestamps
   - Include speaker labels
   - Original vs edited versions

2. HTML export
   - Formatted document with styles
   - Speaker differentiation
   - Paragraph structure
   - Include/exclude timestamps option

3. PDF export
   - Professional layout (ReportLab or WeasyPrint)
   - Table of contents
   - Speaker index
   - Metadata (date, duration, speakers)

4. Export UI
   - Format selection
   - Preview before export
   - Download/email options
   - Export history

**Tests**:

- SRT format validation ✅
- HTML rendering ✅
- TXT export ✅
- Export accuracy ✅

**Status**: ✅ Complete (Note: PDF skipped, TXT added instead)
- SRT export with proper timestamps (HH:MM:SS,mmm)
- HTML export with styled document and metadata
- TXT export with plain text formatting
- ExportDialog component with customizable options:
  - Use edited vs original text toggle
  - Include/exclude speaker names
  - Include/exclude timestamps (HTML/TXT)
- Export button in transcription UI
- Files download with correct Content-Disposition headers

---

### Phase 7: UI/UX Enhancements ✅

**Goal**: Improve visual design, usability, and polish

**Status**: ✅ Complete

**Tasks**:

1. Visual design improvements ✅
   - Design system with CSS custom properties
   - Semantic color tokens (primary, secondary, success, error, warning)
   - Consistent typography and spacing scale
   - Reusable UI components (Button, Card, Input, Modal, Toast, Spinner, Skeleton)
   - Loading spinners and skeletons with multiple sizes
   - Professional styling with Tailwind CSS extensions

2. Keyboard shortcuts ✅
   - Play/Pause: Spacebar
   - Skip forward/back: Arrow keys (5s intervals)
   - Edit segment: E key
   - Save edit: Ctrl+Enter (Cmd+Enter on Mac)
   - Cancel: Esc key
   - Save: Ctrl+S (Cmd+S on Mac)
   - Help: ? key (shows keyboard shortcuts modal)
   - useKeyboardShortcuts hook with modifier key support
   - KeyboardHelpModal with grouped shortcuts display
   - Platform-specific key formatting (Mac symbols vs Windows/Linux)

3. Mobile responsiveness 🚧
   - Responsive grid layouts (planned)
   - Touch-friendly controls (planned)
   - Mobile-optimized player (planned)

4. Error handling UI ✅
   - Toast notification system with ToastProvider
   - Multiple variants (success, error, warning, info)
   - Auto-dismiss with configurable duration
   - Action buttons in toasts
   - User-friendly error messages

5. Accessibility ✅
   - ARIA labels on all interactive elements
   - Keyboard navigation support
   - Screen reader support (ARIA live regions, proper roles)
   - WCAG 2.1 AA compliance (4.5:1 contrast ratios)
   - Focus management in modals
   - Focus indicators with 3:1 contrast
   - Comprehensive accessibility documentation

6. Dark mode ✅
   - Theme system with useTheme hook
   - Light, dark, and system theme options
   - localStorage persistence
   - System preference detection
   - Theme toggle component
   - All semantic colors adapt to theme

**Tests**:

- Button component (variants, loading, disabled) ✅
- Modal component (open/close, escape, focus management) ✅
- Toast component (variants, auto-dismiss, actions) ✅
- Theme switching ✅
- Keyboard shortcuts ✅

**Documentation**:

- DESIGN_SYSTEM.md - Complete design system guide ✅
- KEYBOARD_SHORTCUTS.md - Implementation and usage guide ✅
- ACCESSIBILITY.md - WCAG 2.1 AA compliance guide ✅
- USER_GUIDE.md - Updated with all new features ✅

---

### Phase 8: Polish & Production Readiness ⏳

**Goal**: Performance optimization, security, and deployment

**Status**: ⏳ Future phase

**Tasks**:

1. Performance optimization
   - Lazy loading for large transcriptions
   - Audio streaming
   - Database query optimization
   - Caching strategy

2. Security hardening
   - Authentication/authorization (JWT)
   - File upload security
   - API rate limiting
   - CORS configuration

3. Error handling
   - User-friendly error messages
   - Retry mechanisms
   - Graceful degradation

4. Monitoring & logging
   - Application logs
   - Error tracking (Sentry)
   - Performance metrics
   - Health check endpoints

5. Documentation updates
   - User guide completion
   - API documentation finalization
   - Deployment guide

**Tests**:

- Load testing
- Security testing
- Error scenario coverage
- Full E2E workflows

---

## Testing Strategy

### Unit Tests

- Backend: All service methods, utility functions
- Frontend: Component logic, hooks, utilities
- Target: 80% coverage

### Integration Tests

- API endpoint workflows
- Database operations
- External service mocks (Whisper, LLM)

### E2E Tests

- Complete user workflows:
  1. Upload → Transcribe → View
  2. Edit → Compare → Save
  3. AI Correct → Review → Accept
  4. Export → Download

### Performance Tests

- Large file uploads (>100MB)
- Long audio transcriptions (>1hr)
- Concurrent user sessions

---

## Documentation Structure

### For Developers (docs/development/)

- `CLAUDE.md` - AI assistant guide
- `ARCHITECTURE.md` - System design, data flow
- `API.md` - Endpoint specifications
- `TESTING.md` - Testing guidelines
- `DEPLOYMENT.md` - Production setup

### For Users (docs/user/)

- `GETTING_STARTED.md` - First-time setup
- `USER_GUIDE.md` - Feature walkthroughs
- `FAQ.md` - Common questions
- `TROUBLESHOOTING.md` - Issue resolution

---

## Environment Configuration

### Required Environment Variables

```env
# Backend
DATABASE_URL=sqlite:///./data/transcriptions.db
AUDIO_STORAGE_PATH=/app/data/audio
WHISPER_MODEL_SIZE=base  # tiny, base, small, medium, large
MAX_UPLOAD_SIZE=500MB

# LLM Services
OPENROUTER_API_KEY=your_key_here
OLLAMA_BASE_URL=http://ollama:11434
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_LLM_MODEL=llama3.2:1b

# Frontend
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws

# Security (Production)
JWT_SECRET_KEY=generate_secure_key
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## Success Criteria

### Phase Completion

Each phase is complete when:

1. All tasks are implemented
2. Tests pass with >80% coverage
3. Documentation is updated
4. Code review completed
5. Integration with previous phases verified

### Final Acceptance

Project is production-ready when:

1. All phases completed
2. E2E tests pass for all workflows
3. Performance benchmarks met
4. Security audit passed
5. User documentation complete
6. Deployment guide verified

---

## Timeline Estimate

- **Phase 1**: 2-3 days
- **Phase 2**: 4-5 days
- **Phase 3**: 3-4 days
- **Phase 4**: 5-6 days
- **Phase 5**: 4-5 days
- **Phase 6**: 3-4 days
- **Phase 7**: 4-5 days

**Total**: 25-32 development days (5-6.5 weeks for single developer)

---

## Risk Mitigation

### Technical Risks

1. **Whisper performance**: Use smaller models for quick testing, optimize with GPU support
2. **Speaker diarization accuracy**: Provide manual override tools
3. **Large file handling**: Implement chunking, streaming, progress indicators
4. **LLM API costs**: Default to local Ollama, warn users about API usage

### Project Risks

1. **Scope creep**: Stick to defined phases, defer nice-to-have features
2. **Testing delays**: Write tests alongside implementation
3. **Docker complexity**: Use standard patterns, document thoroughly

---

## Next Steps for Review

1. Review this implementation plan
2. Approve tech stack choices
3. Confirm phase priorities
4. Discuss any additional requirements
5. Begin Phase 1 implementation
