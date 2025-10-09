#!/bin/bash

# Script to create test audio files by extracting first 30 seconds
# Usage: ./create-test-audio.sh [input_file] [output_file]

set -e

INPUT_FILE="${1:-../../backend/data/audio/c1a37d1c-9af7-4228-ae4f-c1dca1830618.mp3}"
OUTPUT_FILE="${2:-./test-data/test-audio-30s.mp3}"
DURATION=30

echo "🎵 Creating test audio file..."
echo "  Input: $INPUT_FILE"
echo "  Output: $OUTPUT_FILE"
echo "  Duration: ${DURATION}s"

# Create test-data directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Check if ffmpeg is available in Docker
if docker-compose exec backend which ffmpeg >/dev/null 2>&1; then
    echo "✅ Using ffmpeg from backend container"

    # Copy input file to backend container accessible location
    TEMP_INPUT="/tmp/input_audio$(basename "$INPUT_FILE")"
    TEMP_OUTPUT="/tmp/test_audio_30s.mp3"

    docker cp "$INPUT_FILE" transcribe-backend-1:"$TEMP_INPUT"

    # Extract first 30 seconds using ffmpeg in container
    docker-compose exec backend ffmpeg -i "$TEMP_INPUT" -t $DURATION -c copy "$TEMP_OUTPUT" -y 2>/dev/null

    # Copy result back
    docker cp transcribe-backend-1:"$TEMP_OUTPUT" "$OUTPUT_FILE"

    # Cleanup
    docker-compose exec backend rm -f "$TEMP_INPUT" "$TEMP_OUTPUT"

elif command -v ffmpeg >/dev/null 2>&1; then
    echo "✅ Using system ffmpeg"
    ffmpeg -i "$INPUT_FILE" -t $DURATION -c copy "$OUTPUT_FILE" -y 2>/dev/null
else
    echo "❌ Error: ffmpeg not found"
    echo "   Please install ffmpeg or use Docker backend container"
    exit 1
fi

# Check result
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    echo "✅ Test audio created successfully!"
    echo "   File: $OUTPUT_FILE"
    echo "   Size: $FILE_SIZE"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Upload this file to a test project"
    echo "   2. Run transcription"
    echo "   3. Run E2E tests"
else
    echo "❌ Failed to create test audio file"
    exit 1
fi
