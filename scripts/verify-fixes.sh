#!/bin/bash

# Verification Script for October 20, 2025 Fixes
# This script verifies that all critical fixes are working correctly

echo "=================================================="
echo "Fix Verification Script - October 20, 2025"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Backend API is responding
echo "1. Checking Backend API Health..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Backend API is healthy${NC}"
else
  echo -e "${RED}❌ Backend API returned status $HEALTH_STATUS${NC}"
fi
echo ""

# Check 2: Database integrity
echo "2. Checking Database Integrity..."
docker exec transcribe-backend-1 python -c "
from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Check for orphaned segments
    orphaned_segs = db.execute(text(
        'SELECT COUNT(*) FROM segments s LEFT JOIN audio_files af ON s.audio_file_id = af.id WHERE af.id IS NULL'
    )).scalar()

    # Check for orphaned speakers
    orphaned_spks = db.execute(text(
        'SELECT COUNT(*) FROM speakers sp LEFT JOIN projects p ON sp.project_id = p.id WHERE p.id IS NULL'
    )).scalar()

    # Check for files with missing parent
    orphaned_parents = db.execute(text(
        'SELECT COUNT(*) FROM audio_files af1 WHERE af1.parent_audio_file_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audio_files af2 WHERE af2.id = af1.parent_audio_file_id)'
    )).scalar()

    print(f'Orphaned segments: {orphaned_segs}')
    print(f'Orphaned speakers: {orphaned_spks}')
    print(f'Files with missing parent: {orphaned_parents}')

    if orphaned_segs == 0 and orphaned_spks == 0 and orphaned_parents == 0:
        print('✅ Database integrity: PASS')
    else:
        print('❌ Database integrity: FAIL - orphaned records found')

finally:
    db.close()
" 2>/dev/null
echo ""

# Check 3: Converted WAV file cleanup
echo "3. Checking for Orphaned Converted WAV Files..."
WAV_COUNT=$(docker exec transcribe-backend-1 find /app/data/audio -name "*_converted.wav" 2>/dev/null | wc -l)
if [ "$WAV_COUNT" -eq "0" ]; then
  echo -e "${GREEN}✅ No orphaned converted WAV files${NC}"
else
  echo -e "${YELLOW}⚠️  Found $WAV_COUNT converted WAV files (may be active transcriptions)${NC}"
  docker exec transcribe-backend-1 find /app/data/audio -name "*_converted.wav" -exec ls -lh {} \; 2>/dev/null
fi
echo ""

# Check 4: File count consistency
echo "4. Checking File Count Consistency..."
docker exec transcribe-backend-1 python -c "
import os
from app.core.database import SessionLocal
from app.models.audio_file import AudioFile

db = SessionLocal()
try:
    # Count database records
    db_files = db.query(AudioFile).all()
    db_count = len(db_files)

    # Normalize paths
    db_file_paths = set()
    for f in db_files:
        if f.file_path.startswith('data/'):
            abs_path = '/app/' + f.file_path
        else:
            abs_path = f.file_path
        db_file_paths.add(abs_path)

    # Count disk files (excluding converted WAV)
    storage_path = '/app/data/audio'
    disk_files = []
    for root, dirs, files in os.walk(storage_path):
        for file in files:
            if not file.endswith('_converted.wav'):
                disk_files.append(os.path.join(root, file))

    disk_count = len(disk_files)

    print(f'Database records: {db_count}')
    print(f'Files on disk: {disk_count}')

    if db_count == disk_count:
        print('✅ File count consistency: PASS')
    else:
        print(f'⚠️  File count mismatch (database: {db_count}, disk: {disk_count})')

finally:
    db.close()
" 2>/dev/null
echo ""

# Check 5: Frontend accessibility
echo "5. Checking Frontend Accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
  echo -e "${RED}❌ Frontend returned status $FRONTEND_STATUS${NC}"
fi
echo ""

# Summary
echo "=================================================="
echo "Verification Complete"
echo "=================================================="
echo ""
echo "Next Steps:"
echo "1. Test the batch transcription workflow in the UI"
echo "2. Verify batch overlay appears and disappears correctly"
echo "3. Check that file selection remains stable during polling"
echo "4. Confirm converted WAV files are cleaned up after transcription"
echo ""
echo "For detailed testing instructions, see:"
echo "  docs/development/OCTOBER_20_COMPLETE_FIX_SUMMARY.md"
