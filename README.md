# Audio Interview Transcription App

Docker-hosted web application for audio interview transcription with advanced editing capabilities, speaker recognition, AI-powered corrections, and multiple export formats.

## Features

- **Audio Upload**: Drag-and-drop interface supporting multiple formats (MP3, WAV, M4A, WebM, OGG, FLAC)
- **Auto-Transcription**: Powered by OpenAI Whisper with configurable model sizes
- **Speaker Recognition**: Automatic speaker diarization using PyAnnote Audio
- **Interactive Editor**:
  - Line-by-line editing with auto-save
  - Audio-text synchronization
  - Speaker management (rename, merge, reassign)
  - Original vs edited text comparison
- **AI Corrections**: Spell check and grammar correction via LLM
  - Local: Ollama (llama3.2:1b) - default
  - Cloud: OpenRouter API
- **Multiple Export Formats**:
  - SRT (subtitles with timestamps)
  - HTML (formatted document)
  - PDF (professional layout)

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Whisper, PyAnnote Audio
- **Frontend**: React 18, TypeScript, Tailwind CSS, React Query, WaveSurfer.js
- **Infrastructure**: Docker Compose, Redis, Ollama, Nginx

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available
- 10GB free disk space (for models and audio storage)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd transcribe
   ```

2. **Configure environment variables**
   ```bash
   # Backend
   cp backend/.env.example backend/.env

   # Frontend
   cp frontend/.env.example frontend/.env

   # Edit backend/.env if you want to use OpenRouter (optional)
   # Add your OPENROUTER_API_KEY if desired
   ```

3. **Start services**
   ```bash
   # Production mode
   docker-compose up --build

   # Development mode (with hot reload)
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

4. **Pull Ollama model** (in a new terminal)
   ```bash
   docker-compose exec ollama ollama pull llama3.2:1b
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### First Transcription

1. Open http://localhost:3000
2. Upload an audio file (drag-and-drop or click to browse)
3. Wait for transcription to complete (progress shown in real-time)
4. Edit transcription text as needed
5. Use AI corrections for spell/grammar improvements
6. Export in your preferred format (SRT, HTML, or PDF)

## Development

### Project Structure

```
transcribe/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # Route handlers
│   │   ├── services/    # Business logic
│   │   ├── models/      # Database models
│   │   ├── core/        # Config & dependencies
│   │   └── workers/     # Background tasks
│   ├── tests/           # Backend tests
│   └── requirements.txt
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── api/         # API client
│   │   └── types/       # TypeScript types
│   └── package.json
├── tests/
│   ├── integration/     # Integration tests
│   └── e2e/            # E2E tests (Playwright)
├── docs/               # Documentation
└── docker-compose.yml
```

### Running Tests

**Backend (Python/pytest)**
```bash
# All tests
docker-compose exec backend pytest

# Specific test file
docker-compose exec backend pytest tests/test_main.py

# With coverage
docker-compose exec backend pytest --cov=app --cov-report=html
```

**Frontend (Jest)**
```bash
# All tests
cd frontend && npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

**E2E Tests (Playwright)**
```bash
cd tests/e2e
npm install
npx playwright test
npx playwright test --headed  # With browser UI
npx playwright show-report    # View report
```

### Development Workflow

1. **Make code changes** (hot reload enabled in dev mode)
2. **Write tests** alongside implementation
3. **Run tests** to verify functionality
4. **Check code quality**:
   ```bash
   # Backend
   cd backend
   black app tests          # Format
   ruff check app tests     # Lint
   mypy app                 # Type check

   # Frontend
   cd frontend
   npm run lint             # ESLint
   npm run type-check       # TypeScript
   npm run format           # Prettier
   ```

### Useful Commands

```bash
# View logs
docker-compose logs -f [service_name]

# Shell access
docker-compose exec backend bash
docker-compose exec frontend sh

# Restart services
docker-compose restart [service_name]

# Stop services
docker-compose down

# Clean up (removes volumes)
docker-compose down -v
```

## Configuration

### Backend Environment Variables

Edit `backend/.env`:

```env
# Whisper Model Size
WHISPER_MODEL_SIZE=base  # tiny, base, small, medium, large
# Smaller = faster but less accurate, larger = slower but more accurate

# LLM Provider
DEFAULT_LLM_PROVIDER=ollama  # or "openrouter"
DEFAULT_LLM_MODEL=llama3.2:1b

# For OpenRouter (optional)
OPENROUTER_API_KEY=your_key_here

# Upload limits
MAX_UPLOAD_SIZE=524288000  # 500MB in bytes
```

### Frontend Environment Variables

Edit `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## Troubleshooting

### Port conflicts
If ports 3000, 8000, 6379, or 11434 are in use:
- Stop conflicting services, or
- Edit `docker-compose.yml` to use different ports

### Transcription is slow
- Use smaller Whisper model: `WHISPER_MODEL_SIZE=tiny` or `base`
- Ensure Docker has sufficient RAM (4GB minimum)
- For production, consider GPU support (requires CUDA setup)

### Ollama model not found
```bash
# Pull the model
docker-compose exec ollama ollama pull llama3.2:1b

# Verify it's available
docker-compose exec ollama ollama list
```

### Frontend can't reach backend
- Check backend is running: http://localhost:8000/health
- Verify CORS settings in `backend/app/main.py`
- Check `VITE_API_BASE_URL` in `frontend/.env`

## Documentation

- [Implementation Plan](IMPLEMENTATION_PLAN.md) - Detailed development roadmap
- [CLAUDE.md](CLAUDE.md) - AI assistant development guide
- [API Documentation](docs/development/API.md) - Endpoint specifications
- [Interactive API Docs](http://localhost:8000/docs) - Swagger UI (when running)

## Current Status

**Phase 1: Project Foundation** ✅ Complete
- Project structure initialized
- Docker infrastructure configured
- Testing frameworks set up
- Documentation created

**Phase 2: Core Backend Services** ✅ Complete
- Database models (Project, AudioFile, Segment, Speaker, Edit)
- Audio file upload with validation
- Whisper transcription integration
- Speaker diarization with PyAnnote
- Background transcription tasks
- RESTful API endpoints
- Comprehensive test suite (>15 tests)

**Phase 3: Frontend - Upload & Transcription UI** ✅ Complete
- File upload component with drag-and-drop
- Project dashboard with file management
- Real-time transcription progress tracking
- Audio player with seek controls
- Segment-based transcription display
- Speaker color coding and labels
- Audio-text synchronization (click segment to jump)
- React Query API integration
- Component tests with Vitest

**Features:**
- Create projects and upload audio files
- Start transcription with speaker diarization
- Monitor progress in real-time (auto-polling)
- Play audio and click segments to navigate
- View transcription with speaker attribution
- Responsive layout (mobile-friendly)

See [API Documentation](docs/development/API.md) for details.

**Next Steps**: See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for Phase 4 (Advanced Editor Features)

## Contributing

1. Create a feature branch
2. Make changes with tests
3. Run all tests and linters
4. Submit pull request

## License

[Specify your license]

## Support

For issues or questions, please open a GitHub issue.
