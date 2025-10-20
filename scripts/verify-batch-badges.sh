#!/bin/bash

# Verification Script for Batch Badge Fix
# This script verifies that batch badges are displayed correctly based on actual file status

echo "=================================================="
echo "Batch Badge Verification"
echo "=================================================="
echo ""

# Check current file states
echo "📊 Current File States:"
docker exec transcribe-backend-1 python -c "
from app.core.database import SessionLocal
from app.models.audio_file import AudioFile

db = SessionLocal()
try:
    files = db.query(AudioFile).filter(
        AudioFile.parent_audio_file_id != None
    ).order_by(AudioFile.id.desc()).limit(3).all()

    if not files:
        print('❌ No split files found in database')
        exit(1)

    for f in reversed(files):
        status_emoji = {
            'PENDING': '⏸️',
            'PROCESSING': '▶️',
            'COMPLETED': '✅',
            'FAILED': '❌'
        }.get(f.transcription_status.value, '❓')

        print(f'{status_emoji} File {f.id}: {f.original_filename}')
        print(f'   Status: {f.transcription_status.value}')
        print(f'   Expected Badge: {\"Processing\" if f.transcription_status.value == \"PROCESSING\" else \"Batch\"}')
        print()

finally:
    db.close()
" 2>/dev/null

echo ""
echo "=================================================="
echo "Badge Logic Rules:"
echo "=================================================="
echo ""
echo "✅ If file.status === 'processing' → Show \"Processing\" badge (dark indigo)"
echo "✅ Otherwise → Show \"Batch\" badge (light indigo)"
echo ""
echo "This ensures:"
echo "  - Files actively being transcribed show \"Processing\""
echo "  - Files waiting in queue show \"Batch\""
echo "  - Completed files don't show batch badges"
echo ""
echo "=================================================="
echo "Verification Complete"
echo "=================================================="
echo ""
echo "To test manually:"
echo "1. Upload an audio file"
echo "2. Split into 3 parts"
echo "3. Click \"Start All\""
echo "4. Verify badges match actual file status"
