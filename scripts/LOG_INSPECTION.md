# Log Inspection Tools

This directory contains several tools to easily inspect Docker container logs for the Audio Transcription application.

## 🐍 Python Log Inspector (Recommended)

The most feature-rich option with filtering, formatting, and real-time monitoring.

### Installation
```bash
# No additional dependencies needed - uses built-in Python libraries
```

### Usage Examples

```bash
# Basic usage - show recent backend logs
python scripts/log_inspector.py

# Show specific container logs
python scripts/log_inspector.py --container frontend
python scripts/log_inspector.py --container ollama

# Filter logs by pattern
python scripts/log_inspector.py --filter transcription
python scripts/log_inspector.py --filter error
python scripts/log_inspector.py --filter "segments|resume"

# Time-based filtering
python scripts/log_inspector.py --since 10m --tail 50
python scripts/log_inspector.py --since 1h

# Real-time monitoring
python scripts/log_inspector.py --live

# Show available options
python scripts/log_inspector.py --show-filters
python scripts/log_inspector.py --list-containers
```

### Available Filters
- `transcription` - Transcription, Whisper, segments, resume/restart activities
- `error` - Errors, exceptions, failures
- `api` - HTTP requests and responses
- `database` - Database queries and operations
- `upload` - File upload activities
- `ai` - AI/LLM related operations
- `performance` - Performance metrics, timing, memory usage
- `segments` - Segment creation and management

## 📦 NPM Scripts

Quick access via npm/yarn commands:

```bash
# Container-specific logs
npm run logs:backend
npm run logs:frontend
npm run logs:ollama
npm run logs:redis

# Filtered logs
npm run logs:errors
npm run logs:transcription
npm run logs:recent

# Real-time monitoring
npm run logs:live

# Use the Python inspector
npm run logs:inspect
```

## 🪟 Windows Batch Script

Simple batch script for Windows users:

```batch
# Basic usage
logs.bat

# Specific container
logs.bat frontend
logs.bat backend

# With filtering
logs.bat backend transcription
logs.bat backend error

# Custom tail count
logs.bat backend transcription 50
```

## 🔧 Advanced Docker Commands

For direct Docker usage:

```bash
# Basic log viewing
docker logs audio-transcription-backend-1 --tail 100

# Time-based logs
docker logs audio-transcription-backend-1 --since=10m

# Follow logs in real-time
docker logs audio-transcription-backend-1 --follow

# Multiple containers at once
docker-compose logs -f

# Filter with grep (Linux/Mac) or findstr (Windows)
docker logs audio-transcription-backend-1 --tail 200 | grep -i "transcription\|error"
docker logs audio-transcription-backend-1 --tail 200 | findstr /i "transcription error"
```

## 🎯 Common Use Cases

### Debugging Transcription Issues
```bash
python scripts/log_inspector.py --filter transcription --since 15m
```

### Monitoring Errors
```bash
python scripts/log_inspector.py --filter error --live
```

### Checking API Performance
```bash
python scripts/log_inspector.py --filter api --tail 50
```

### Database Debugging
```bash
python scripts/log_inspector.py --filter database --since 5m
```

### Upload Issues
```bash
python scripts/log_inspector.py --filter upload --tail 30
```

## 📊 Log Formatting

The Python inspector adds helpful emoji indicators:
- 🔴 Errors and failures
- 🟡 Warnings  
- ✅ Successful operations
- 🎵 Transcription activities
- 📝 Segment creation
- ℹ️ Info messages

## 💡 Tips

1. **Start with the Python inspector** - it's the most user-friendly
2. **Use `--live` mode** for real-time debugging
3. **Combine filters** with custom regex: `--filter "error|failed|exception"`
4. **Time filters are helpful** for recent issues: `--since 10m`
5. **Check `--show-filters`** to see all available predefined patterns

## 🆘 Troubleshooting

If containers aren't found:
```bash
# Check running containers
docker ps

# Check if services are up
docker-compose ps

# Start services if needed
docker-compose up -d
```