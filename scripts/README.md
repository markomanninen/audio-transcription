# Scripts Directory

This directory contains utility scripts for the Audio Transcription application.

## Log Inspection Tools

- `log_inspector.py` - Advanced Python log inspector with filtering and formatting
- `logs.bat` - Simple Windows batch script for log viewing
- `LOG_INSPECTION.md` - Documentation for log inspection tools

## Monitoring Scripts

- `monitor_transcription_v2.py` - Advanced transcription monitoring script

## Deployment & Testing

- `deploy.ps1` - PowerShell deployment script
- `frontend-test.js` - Frontend testing utilities
- `smoke-test.sh` - Smoke test script

## Status Scripts

- `status.py` - Comprehensive Python status checker with detailed datetime tracking
- `status.sh` - Shell status checker  
- `status.bat` - Windows batch status checker

## Usage

### Log Inspection

```bash
# Advanced log inspection
python scripts/log_inspector.py --filter transcription --tail 50

# Simple Windows log viewing
scripts/logs.bat backend transcription

# NPM shortcut (from project root)
npm run logs:inspect
```

### Status Checking

```bash
# Quick system overview
python scripts/status.py

# Detailed files with timestamps
python scripts/status.py --files

# Recent activity with processing times
python scripts/status.py --recent

# Continuous monitoring
python scripts/status.py --watch

# Monitor specific file in real-time
python scripts/status.py --monitor-file 5

# Check for zombie processes
python scripts/status.py --zombies

# Shell status (Linux/Mac)
./scripts/status.sh

# Windows status
scripts/status.bat
```

**DateTime Information Includes:**

- 📅 Upload timestamps
- 🚀 Transcription start times
- 🏁 Completion timestamps  
- ⏱️ Processing durations
- 🔄 Last update times

### Deployment

```powershell
# Deploy with PowerShell
./scripts/deploy.ps1
```

### Publishing Docker Images

#### Multi-Platform Publishing (Recommended)

Publish Docker images for multiple architectures (amd64 + arm64) with both CPU and GPU variants:

```bash
# Login to Docker Hub first (one-time setup)
docker login --username markomann

# Publish ALL variants (CPU + CUDA + Frontend)
./scripts/publish_all_multiplatform.sh
```

**Result:**

- `markomann/audio-transcription-backend:latest` (CPU, amd64 + arm64)
- `markomann/audio-transcription-backend:latest-cuda` (GPU, amd64)
- `markomann/audio-transcription-frontend:latest` (amd64 + arm64)

**Individual variants:**

```bash
# Backend CPU variant only (multi-platform)
TORCH_VARIANT=cpu ./scripts/publish_backend_multiplatform.sh

# Backend CUDA/GPU variant only (amd64)
TORCH_VARIANT=cuda ./scripts/publish_backend_multiplatform.sh

# Frontend only (multi-platform)
./scripts/publish_frontend_multiplatform.sh
```

See [docs/DOCKER_PUBLISHING.md](../docs/DOCKER_PUBLISHING.md) for comprehensive documentation.

#### Legacy Publishing (Single Platform)

From a Unix-like shell (macOS / Linux / WSL) you can publish single-platform images:

```bash
./scripts/publish_all.sh
# or individually:
./scripts/publish_backend.sh
./scripts/publish_frontend.sh
```

**Notes:**

- These scripts use `docker compose` when available, falling back to `docker-compose`.
- They attempt to detect the image built by compose and tag it for Docker Hub.
- Single platform only (native architecture)
- Use multiplatform scripts for production deployments

### Windows / PowerShell notes

- Use an elevated PowerShell if Docker Desktop requires it. Run `./scripts/deploy.ps1` from the repository root.
- The deploy script checks multiple common backend ports (8000, 8080, 8081) for the health endpoint when waiting for startup.
- If you prefer to run from WSL, the bash publish scripts will work there as well.
