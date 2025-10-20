# File Delete Cascade Fix - October 20, 2025

## Problem Summary

The file delete endpoint (`DELETE /api/upload/files/{file_id}`) was not properly cleaning up all associated data, leaving orphaned records in the database and orphaned files on disk.

### What Was Missing

1. **Child Split Files**: Deleting a parent file did not delete its split children
2. **Converted Audio Files**: WAV conversion files (`*_converted.wav`) were left on disk
3. **Speaker Records**: Speakers associated with file segments were not deleted
4. **Incomplete Cascade**: Only segments and LLM logs were being cleaned up

### Example of Stale Data

After deleting split files from the UI:
- ✅ Database records were deleted (via UI cascade)
- ❌ 6 converted WAV files remained on disk (103.81 MB)
- ❌ No cleanup of parent-child relationships
- ❌ Speakers could be orphaned if not cleaned properly

## Root Cause

The delete endpoint at [backend/app/api/upload.py:334-369](../../backend/app/api/upload.py#L334-L369) only handled:
- LLM logs for segments
- Segments themselves
- The original audio file
- The database record

It did NOT handle:
- Child split files (recursive deletion)
- Converted WAV files
- Speaker records
- Glob patterns for related files

## The Fix

Enhanced the delete endpoint to properly cascade all deletions:

### 1. Recursive Child Deletion

```python
# Collect all file IDs to delete (this file + any child split files)
file_ids_to_delete = [file_id]

# If this is a parent file, also delete all child split files
child_files = db.query(AudioFile).filter(AudioFile.parent_audio_file_id == file_id).all()
file_ids_to_delete.extend([child.id for child in child_files])
```

### 2. Speaker Cleanup

```python
# Delete speakers associated with segments of this file
speaker_ids_query = db.query(Segment.speaker_id).filter(
    Segment.audio_file_id == fid,
    Segment.speaker_id.isnot(None)
).distinct()
speaker_ids = [sid[0] for sid in speaker_ids_query.all()]

# Delete segments first (foreign key constraint)
db.query(Segment).filter(Segment.audio_file_id == fid).delete(synchronize_session=False)

# Then delete speakers
if speaker_ids:
    db.query(Speaker).filter(Speaker.id.in_(speaker_ids)).delete(synchronize_session=False)
```

### 3. Converted File Cleanup

```python
# Delete converted WAV file if it exists
base_path = os.path.splitext(audio_file_to_delete.file_path)[0]
converted_wav = f"{base_path}_converted.wav"
if os.path.exists(converted_wav):
    os.remove(converted_wav)

# Also check for any other converted files with similar patterns
file_dir = os.path.dirname(audio_file_to_delete.file_path)
file_basename = os.path.basename(audio_file_to_delete.file_path)
uuid_part = os.path.splitext(file_basename)[0]
converted_pattern = os.path.join(file_dir, f"{uuid_part}_converted.*")
for converted_file in glob.glob(converted_pattern):
    os.remove(converted_file)
```

### 4. Complete Deletion Order

For each file (parent and children):
1. Delete LLM logs (foreign key to segments)
2. Collect speaker IDs from segments
3. Delete segments (foreign key to audio_file)
4. Delete speakers (now safe, no FK constraints)
5. Delete physical files (original + converted)
6. Delete database record

## Changes Made

**File**: [backend/app/api/upload.py](../../backend/app/api/upload.py)
**Lines**: 334-431

### Key Improvements

1. **Recursive Deletion**: Automatically deletes all child split files when parent is deleted
2. **Complete Disk Cleanup**: Removes original file + all converted versions
3. **Speaker Management**: Properly removes speakers when their associated file is deleted
4. **Foreign Key Safety**: Deletes in correct order to avoid constraint violations
5. **Comprehensive Logging**: Warns about file deletion failures without stopping the process

## Impact

### Before Fix
```
DELETE file ID 1 (parent with 12 split children):
- ✅ File 1 database record deleted
- ❌ 12 child files remained in database
- ❌ 6 converted WAV files remained on disk (103.81 MB)
- ❌ Speakers potentially orphaned
- ❌ Manual cleanup required
```

### After Fix
```
DELETE file ID 1 (parent with 12 split children):
- ✅ File 1 database record deleted
- ✅ All 12 child file database records deleted
- ✅ All LLM logs deleted
- ✅ All segments deleted
- ✅ All speakers deleted
- ✅ All original audio files deleted
- ✅ All converted WAV files deleted
- ✅ Complete cleanup - no stale data
```

## Response Format

The endpoint now returns:

```json
{
  "message": "Successfully deleted 13 file(s) including all associated data",
  "deleted_files": 13
}
```

This shows the total number of files deleted (parent + children).

## Testing

### Manual Verification

```bash
# 1. Upload a file and split it into chunks
# 2. Check database state
docker exec transcribe-backend-1 python -c "
from app.core.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
print('Files:', db.execute(text('SELECT COUNT(*) FROM audio_files')).scalar())
print('Segments:', db.execute(text('SELECT COUNT(*) FROM segments')).scalar())
print('Speakers:', db.execute(text('SELECT COUNT(*) FROM speakers')).scalar())
db.close()
"

# 3. Check disk state
docker exec transcribe-backend-1 ls -lh /app/data/audio/

# 4. Delete the parent file via API
curl -X DELETE http://localhost:8080/api/upload/files/1

# 5. Verify complete cleanup
# Re-run database and disk checks - should show zero orphaned data
```

### Expected Results

After deletion:
- ✅ No orphaned audio_file records
- ✅ No orphaned segments
- ✅ No orphaned speakers
- ✅ No orphaned LLM logs
- ✅ No orphaned files on disk
- ✅ No converted WAV files remaining

## Database Verification Queries

```sql
-- Check for orphaned segments (should return 0)
SELECT COUNT(*) FROM segments s
LEFT JOIN audio_files af ON s.audio_file_id = af.id
WHERE af.id IS NULL;

-- Check for orphaned speakers (should return 0)
SELECT COUNT(*) FROM speakers sp
LEFT JOIN projects p ON sp.project_id = p.id
WHERE p.id IS NULL;

-- Check for files with missing parent (should return 0)
SELECT COUNT(*) FROM audio_files af1
WHERE af1.parent_audio_file_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM audio_files af2
    WHERE af2.id = af1.parent_audio_file_id
);
```

## Related Files

- [backend/app/api/upload.py](../../backend/app/api/upload.py) - Delete endpoint implementation
- [backend/app/models/audio_file.py](../../backend/app/models/audio_file.py) - AudioFile model with parent-child relationships
- [frontend/src/components/Dashboard/FileList.tsx](../../frontend/src/components/Dashboard/FileList.tsx) - UI that calls delete endpoint

## Best Practices Implemented

1. **Cascade Deletion**: Automatically handle parent-child relationships
2. **Foreign Key Order**: Delete in correct order to respect database constraints
3. **Disk Cleanup**: Remove all physical files, not just database records
4. **Error Handling**: Continue deletion even if some files can't be removed
5. **Atomic Operations**: All deletions in single transaction (commit at end)
6. **Informative Response**: Return count of deleted files for user feedback

## Future Improvements

Consider these enhancements:

1. **Soft Deletes**: Add `deleted_at` timestamp instead of hard deletion
2. **Audit Trail**: Log all deletions to separate audit table
3. **Bulk Delete**: Endpoint to delete multiple files at once
4. **Disk Usage Tracking**: Return bytes freed in response
5. **Background Cleanup**: Scan for and remove orphaned files periodically

---

**Fixed By**: Claude Code
**Date**: October 20, 2025
**Related**: Transcription Status Fix (same session)
**Impact**: Prevents disk space waste and database pollution
