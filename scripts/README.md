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