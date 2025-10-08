# 🎙️ Audio Transcription

AI-powered audio transcription application with speaker recognition, multi-language support, and intelligent editing capabilities. Perfect for transcribing interviews, podcasts, meetings, and more.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)
![Docker](https://img.shields.io/badge/docker-required-blue.svg)

## ✨ Features

### Core Transcription
- **🌍 Multi-language Support**: 22+ languages including English, Finnish, Swedish, French, German, Spanish, and more
- **🎯 Auto Language Detection**: Automatically detects spoken language
- **👥 Speaker Diarization**: Automatic speaker identification and labeling
- **⚡ Fast Processing**: Powered by OpenAI Whisper (typically 1-3 minutes for 3-minute audio)
- **📝 Multiple Output Formats**: Export as SRT, HTML, or TXT

### AI-Powered Editing
- **✨ Context-Aware Corrections**: Smart grammar and spelling fixes with segment context
- **🔍 Content Analysis**: AI-powered project-wide analysis and summaries  
- **🎨 Customizable Speakers**: Rename speakers and assign custom colors
- **📊 LLM Monitoring**: Track and debug all AI interactions

### User Experience
- **🎵 Built-in Audio Player**: Play, pause, and jump to specific segments
- **✏️ Inline Editing**: Edit transcriptions directly with live preview
- **🌓 Dark/Light Mode**: Comfortable viewing in any environment
- **📖 Interactive Tutorial**: Step-by-step guide for new users
- **💾 Auto-save**: Persistent storage of projects and preferences
- **🗑️ Project Management**: Delete projects with all associated data

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- At least 4GB RAM available
- 5GB disk space for Whisper models

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/audio-transcription.git
   cd audio-transcription
   ```

2. **Configure environment** (optional)
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env if you want to use OpenRouter for AI features
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:5175
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

The first startup will download the Whisper model (~1-2GB), which may take a few minutes.

## 📖 Usage

### Basic Workflow

1. **Create a Project**
   - Click "New Project"
   - Enter project name and optional description
   - Select content type (general, interview, podcast, etc.)

2. **Upload Audio Files**
   - Supported formats: MP3, WAV, M4A, WebM, OGG, FLAC
   - Maximum file size: 500MB
   - Select language or use auto-detect

3. **Transcribe**
   - Click "Transcribe" button
   - Wait for processing (typically 1-3 minutes for 3-minute audio)
   - View real-time progress

4. **Edit & Refine**
   - Edit segments directly by clicking the edit icon
   - Use AI suggestions (✨ button) for grammar corrections
   - Rename speakers and customize colors
   - Play audio segments to verify accuracy

5. **Export**
   - Click "Export" button
   - Choose format: SRT (subtitles), HTML (styled), or TXT (plain text)
   - Download your transcription

### AI Features

**Grammar Correction**
- Click ✨ on any segment for AI-powered corrections
- Maintains speaker context and content type
- Shows changes before applying

**Project Analysis**
- Use "AI Analysis" from Project menu
- Generates summaries, themes, and key points
- Great for understanding long interviews or meetings

## ⚙️ Configuration

### Environment Variables

Create `backend/.env` from `.env.example`:

```env
# Database
DATABASE_URL=sqlite:///./data/transcription.db

# Audio Storage
AUDIO_STORAGE_PATH=./storage

# Whisper Model (tiny, base, small, medium, large)
WHISPER_MODEL_SIZE=base

# OpenRouter (optional, for AI features)
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=anthropic/claude-3-haiku

# Ollama (local AI, optional - supports external services)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:1b

# External Ollama Configuration (optional)
OLLAMA_EXTERNAL=false
OLLAMA_API_KEY=your_api_key_here
OLLAMA_VERIFY_SSL=true
```

### Whisper Models

| Model  | Size | Speed | Accuracy | Use Case |
|--------|------|-------|----------|----------|
| tiny   | ~75MB | Fastest | Basic | Quick drafts |
| base   | ~150MB | Fast | Good | General use (default) |
| small  | ~500MB | Medium | Better | Clearer audio |
| medium | ~1.5GB | Slow | Great | Professional |
| large  | ~3GB | Slowest | Best | Maximum accuracy |

Change model in `backend/.env`:
```env
WHISPER_MODEL_SIZE=small
```

## 📊 Limitations

### Audio Files
- **Maximum file size**: 500MB
- **Supported formats**: MP3, WAV, M4A, WebM, OGG, FLAC
- **Minimum quality**: 16kHz recommended for best results
- **Stereo/Mono**: Both supported

### Transcription
- **Processing time**: Typically 20-40% of audio duration (3-minute audio = ~1-2 minutes)
- **Languages**: 22 languages supported (see Whisper documentation)
- **Speaker diarization**: Works best with 2-10 speakers
- **Background noise**: May affect accuracy - use noise reduction tools if needed

### AI Features
- **Rate limits**: Depends on chosen provider (Ollama local = unlimited, OpenRouter = per API key)
- **Context length**: Limited to segment + surrounding context (~2000 characters)
- **Accuracy**: AI suggestions should be reviewed before accepting

## 🏗️ Architecture

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Transcription**: OpenAI Whisper
- **Speaker Diarization**: PyAnnote Audio
- **AI Integration**: Ollama (local/external) + OpenRouter (cloud)
- **Database**: SQLite (easily upgradable to PostgreSQL)

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Audio Player**: Custom HTML5 Audio implementation

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (production)
- **Storage**: Local filesystem (configurable)

## � Advanced Configuration

### External Ollama Service

For better performance or to share resources, you can configure the application to use an external Ollama service:

**Quick Setup**:
1. Set `OLLAMA_EXTERNAL=true` in your `.env` file
2. Update `OLLAMA_BASE_URL` to your external service URL
3. Configure authentication if required

**📖 Full Guide**: See [External Ollama Configuration](./docs/EXTERNAL_OLLAMA_SETUP.md) for detailed instructions, security considerations, and troubleshooting.

## �🛠️ Development

### Run in Development Mode

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Run Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

### API Documentation

Visit http://localhost:8000/docs for interactive Swagger documentation.

## 📦 Deployment

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Setup

1. Update `backend/.env` with production values
2. Set strong `JWT_SECRET_KEY`
3. Configure proper CORS origins
4. Use PostgreSQL for production database
5. Set up backup strategy for database and audio files

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) for speech recognition
- [PyAnnote Audio](https://github.com/pyannote/pyannote-audio) for speaker diarization
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://react.dev/) for the frontend framework
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📧 Support

For issues and questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Review the interactive tutorial in the app

## 🗺️ Roadmap

- [ ] Real-time transcription streaming
- [ ] Batch file processing
- [ ] Custom vocabulary support
- [ ] Integration with cloud storage (S3, GCS)
- [ ] Multi-user support with authentication
- [ ] REST API for programmatic access
- [ ] Mobile-responsive design improvements
- [ ] Webhook notifications

---

Made with ❤️ using Python, React, and AI
