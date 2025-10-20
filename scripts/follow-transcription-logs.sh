#!/bin/bash

# Script to follow transcription logs only (no SQLAlchemy noise)
echo "🎵 Following transcription logs..."
echo "Press Ctrl+C to stop"
echo "=========================="

docker logs transcribe-backend-1 -f 2>&1 | grep -E "🎵|TRANSCRIPTION|Progress:|🚀|🔄|Starting Whisper|completed|segments" --line-buffered | while read line; do
    echo "$line"
done