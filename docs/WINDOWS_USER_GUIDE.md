# Windows User Guide - Audio Transcription Application

Quick start guide for running the audio transcription application on Windows.

## Prerequisites

1. **Install Docker Desktop for Windows**
   - Download from: <https://www.docker.com/products/docker-desktop/>
   - Run the installer
   - Restart your computer when prompted
   - Launch Docker Desktop and wait for it to start

2. **Verify Docker is Running**
   - Open PowerShell or Command Prompt
   - Run: `docker --version`
   - You should see something like: `Docker version 24.x.x`

## Quick Start

### Step 1: Download the Configuration File

Create a new folder for the application, for example: `C:\AudioTranscription`

Download the `docker-compose.user.yml` file from the repository:

**<https://raw.githubusercontent.com/markomanninen/audio-transcription/main/docker-compose.user.yml>**

Save it in your folder as `docker-compose.yml` (rename it from `docker-compose.user.yml` to `docker-compose.yml`).

**Or manually create a file named `docker-compose.yml`** in your folder with this content:

```yaml
version: '3.8'

services:
  backend:
    image: markomann/audio-transcription-backend:latest
    ports:
      - "8000:8000"
    volumes:
      - audio-data:/app/data
      - whisper-cache:/root/.cache/whisper
    environment:
      - DEBUG=False
      - DATABASE_URL=sqlite:///./data/transcriptions.db
      - REDIS_URL=redis://redis:6379/0
      - OLLAMA_BASE_URL=http://ollama:11434
      - WHISPER_MODEL_SIZE=base
      - MAX_UPLOAD_SIZE=524288000
    depends_on:
      - redis
      - ollama
    restart: unless-stopped
    networks:
      - transcribe-network

  frontend:
    image: markomann/audio-transcription-frontend:latest
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - transcribe-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - transcribe-network

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped
    networks:
      - transcribe-network

volumes:
  audio-data:
    driver: local
  whisper-cache:
    driver: local
  redis-data:
    driver: local
  ollama-data:
    driver: local

networks:
  transcribe-network:
    driver: bridge
```

### Step 2: Start the Application

**Using PowerShell:**

```powershell
# Navigate to your folder
cd C:\AudioTranscription

# Start the application
docker compose up -d

# Check if containers are running
docker compose ps
```

**Using Command Prompt:**

```cmd
# Navigate to your folder
cd C:\AudioTranscription

# Start the application
docker compose up -d

# Check if containers are running
docker compose ps
```

### Step 3: Download AI Model (First Time Only)

The first time you use the application, download the AI model:

```powershell
docker compose exec ollama ollama pull llama3.2:1b
```

This will download ~1.3GB. Wait for it to complete.

### Step 4: Access the Application

Open your web browser and go to:

**<http://localhost:3000>**

You should see the audio transcription interface!

## Using the Application

1. **Upload Audio File**
   - Click "Upload Audio" or drag and drop an audio file
   - Supported formats: MP3, WAV, M4A, MP4, WebM, OGG, FLAC
   - Maximum file size: 500MB

2. **Start Transcription**
   - Click "Start Transcription"
   - Wait for the process to complete (progress will be shown)

3. **Edit Transcription**
   - Click on any text segment to edit
   - Edit speaker names by clicking on them
   - Use AI correction for grammar/spelling fixes

4. **Export Results**
   - Click "Export" button
   - Choose format: SRT (subtitles), HTML (document), or TXT (plain text)
   - Download your transcription

## Stopping the Application

When you're done, stop the application:

```powershell
docker compose down
```

Your transcriptions and data are saved and will be available when you start again.

## Troubleshooting

### "Docker is not running"

- Open Docker Desktop from the Start menu
- Wait for the Docker icon in the system tray to show "Docker Desktop is running"

### "Port 3000 is already in use"

Another application is using port 3000. Either:

**Option 1**: Stop that application

**Option 2**: Use a different port by editing `docker-compose.yml`:

```yaml
frontend:
  ports:
    - "3001:80"  # Change 3000 to 3001 (or any available port)
```

Then access the app at `http://localhost:3001`

### "Cannot connect to Docker daemon"

Docker Desktop is not running. Start it from the Start menu.

### Transcription is Very Slow

**For faster transcription (if you have an NVIDIA GPU):**

1. Install NVIDIA Docker support: <https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html>

2. Use the GPU-enabled image by changing `docker-compose.yml`:

```yaml
backend:
  image: markomann/audio-transcription-backend:latest-cuda
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

3. Restart: `docker compose down` then `docker compose up -d`

### Application Won't Start

Check the logs:

```powershell
docker compose logs backend
docker compose logs frontend
```

Look for error messages and check the troubleshooting section above.

## Updating the Application

To get the latest version:

```powershell
# Stop the application
docker compose down

# Pull new images
docker compose pull

# Start with new version
docker compose up -d
```

## Uninstalling

To completely remove the application and all data:

```powershell
# Stop and remove containers
docker compose down

# Remove images
docker rmi markomann/audio-transcription-backend:latest
docker rmi markomann/audio-transcription-frontend:latest
docker rmi redis:7-alpine
docker rmi ollama/ollama:latest

# Remove data (WARNING: This deletes all transcriptions!)
docker volume rm audiotranscription_audio-data
docker volume rm audiotranscription_ollama-data
```

## Advanced Options

### Change Whisper Model Size

For better accuracy (slower) or faster processing (less accurate), edit `docker-compose.yml`:

```yaml
backend:
  environment:
    - WHISPER_MODEL_SIZE=tiny   # Fastest, least accurate
    - WHISPER_MODEL_SIZE=base   # Default, balanced
    - WHISPER_MODEL_SIZE=small  # Better accuracy, slower
    - WHISPER_MODEL_SIZE=medium # Best accuracy, slowest
```

### Use External Ollama

If you already have Ollama running elsewhere:

```yaml
backend:
  environment:
    - OLLAMA_BASE_URL=http://your-ollama-server:11434
```

Then remove the `ollama` service from `docker-compose.yml`.

### Enable Debug Mode

For troubleshooting:

```yaml
backend:
  environment:
    - DEBUG=True
```

Check logs: `docker compose logs -f backend`

## System Requirements

**Minimum:**

- Windows 10/11 (64-bit)
- 8GB RAM
- 10GB free disk space
- Internet connection (for initial setup)

**Recommended:**

- Windows 11 (64-bit)
- 16GB RAM
- 20GB free disk space
- SSD storage
- NVIDIA GPU (optional, for faster transcription)

## Support

For issues or questions:

- Check the logs: `docker compose logs`
- GitHub Issues: <https://github.com/markomanninen/audio-transcription/issues>
- Make sure Docker Desktop is running and up to date

## Privacy Notice

All processing happens locally on your computer. Audio files and transcriptions never leave your machine unless you choose to export them.
