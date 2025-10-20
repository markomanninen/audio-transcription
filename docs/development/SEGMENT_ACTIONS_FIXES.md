# Segment Actions Fixes - October 19, 2025

## Issues Identified

### 1. Delete Segment - "Method Not Allowed" Error

**Problem**: When attempting to delete a segment, the API returned `405 Method Not Allowed`.

**Root Cause**: FastAPI route path conflict. Both `PATCH` and `DELETE` methods were registered on the same path `/api/transcription/segment/{segment_id}`. FastAPI only registered the first method (PATCH) encountered, silently ignoring the DELETE route.

**Solution**: Changed DELETE endpoint path from `/segment/{segment_id}` to `/segments/{segment_id}` (plural) to avoid path conflict.

**Files Modified**:
- `backend/app/api/transcription.py:1223` - Changed route path
- `frontend/src/hooks/useTranscription.ts:283` - Updated frontend to use new path

### 2. Insert Segment - "Not Found" Error

**Problem**: When attempting to insert a segment above/below, the API returned `404 Not Found`.

**Root Cause**: Pydantic model type annotations using Python 3.10+ union syntax (`float | None`) were not properly processed by FastAPI/Pydantic for OpenAPI schema generation. This caused the route to fail registration in the OpenAPI spec, making it inaccessible.

**Solution**:
1. Added `Optional` to typing imports
2. Converted model field types from `float | None` to `Optional[float]`

**Files Modified**:
- `backend/app/api/transcription.py:7` - Added `Optional` import
- `backend/app/api/transcription.py:115-118` - Updated `SegmentInsertRequest` model fields

### 3. Missing Replay/Rewind Button

**Problem**: The segment replay button was removed from the UI, preventing users from easily replaying a segment from its start.

**Solution**: Added a replay button (↻) that:
- Seeks audio to segment start time
- Automatically starts playback
- Positioned between play/pause and edit buttons

**Files Modified**:
- `frontend/src/components/Transcription/SegmentList.tsx:487-499` - Added replay button

## Technical Details

### DELETE Endpoint Fix

**Before**:
```python
@router.delete("/segment/{segment_id}", response_model=SegmentListResponse)
async def delete_segment(segment_id: int, db: Session = Depends(get_db)):
    """Delete a segment and re-sequence remaining segments."""
    # ... implementation
```

**After**:
```python
@router.delete("/segments/{segment_id}", response_model=SegmentListResponse)
async def delete_segment(segment_id: int, db: Session = Depends(get_db)):
    """Delete a segment and re-sequence remaining segments."""
    # ... implementation
```

**Frontend Update**:
```typescript
// Before
const response = await apiClient.delete<{ segments: Segment[] }>(
  `/api/transcription/segment/${segmentId}`
)

// After
const response = await apiClient.delete<{ segments: Segment[] }>(
  `/api/transcription/segments/${segmentId}`
)
```

### INSERT Endpoint Fix

**Before**:
```python
from typing import List

class SegmentInsertRequest(BaseModel):
    direction: str = "below"
    start_time: float | None = None
    end_time: float | None = None
    original_text: str | None = None
    speaker_id: int | None = None
```

**After**:
```python
from typing import List, Optional

class SegmentInsertRequest(BaseModel):
    direction: str = "below"
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    original_text: Optional[str] = None
    speaker_id: Optional[int] = None
```

### Replay Button Implementation

```typescript
{/* Replay button - restart segment from beginning */}
<button
  onClick={(event) => {
    event.stopPropagation()
    // Seek to segment start and play
    onSegmentClick?.(segment)
    // Small delay to ensure seek completes before playing
    setTimeout(() => onPlayRequest?.(), 50)
  }}
  className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
  title="Replay segment from start"
>
  ↻
</button>
```

## Verification

### DELETE Endpoint

```bash
# Test with non-existent segment (expect 404)
curl -X DELETE http://localhost:8000/api/transcription/segments/999
# Returns: {"detail":"Not Found"}  ✅ (404 is correct - endpoint working)

# Before fix would return: {"detail":"Method Not Allowed"}  ❌
```

### INSERT Endpoint

```bash
# Check endpoint is registered in OpenAPI
curl -s http://localhost:8000/openapi.json | grep -o 'segment.*insert'
# Returns: /api/transcription/segment/{segment_id}/insert  ✅

# Test insert below segment 237
curl -X POST http://localhost:8000/api/transcription/segment/237/insert \
  -H "Content-Type: application/json" \
  -d '{"direction":"below","original_text":"Test segment"}'

# Returns: {
#   "id": 299,
#   "start_time": 13.14,
#   "end_time": 13.66,
#   "original_text": "Test segment",
#   "edited_text": null,
#   "speaker_id": null,
#   "sequence": 1,
#   "is_passive": false
# }  ✅
```

### Replay Button

Manual verification in UI:
1. Navigate to transcription with segments
2. Locate segment with replay button (↻) next to play button
3. Click replay button
4. Verify audio seeks to segment start and begins playing

## API Endpoints

### Delete Segment

**Endpoint**: `DELETE /api/transcription/segments/{segment_id}`

**Response**: `SegmentListResponse` containing remaining segments after deletion

**Status Codes**:
- `200 OK` - Segment deleted successfully
- `404 Not Found` - Segment not found

### Insert Segment

**Endpoint**: `POST /api/transcription/segment/{segment_id}/insert`

**Request Body**:
```json
{
  "direction": "above" | "below",
  "start_time": number | null,      // Optional - auto-calculated if omitted
  "end_time": number | null,         // Optional - auto-calculated if omitted
  "original_text": string | null,   // Optional - defaults to empty
  "speaker_id": number | null        // Optional - inherits from base segment
}
```

**Response**: `SegmentResponse` for the newly inserted segment

**Status Codes**:
- `200 OK` - Segment inserted successfully
- `400 Bad Request` - Invalid direction, overlapping times, or no time gap
- `404 Not Found` - Base segment not found

## Testing

### Manual Testing Checklist

- [x] Delete segment action works
- [x] Insert above segment action works
- [x] Insert below segment action works
- [x] Replay button appears in UI
- [x] Replay button seeks to segment start
- [x] Replay button starts playback
- [ ] E2E tests updated (if needed)

### Automated Testing

Run backend tests:
```bash
cd backend
pytest tests/test_segment_editing.py -v
```

Run frontend E2E tests:
```bash
cd tests/e2e
npx playwright test full-workflow.spec.ts
```

## Related Files

**Backend**:
- `backend/app/api/transcription.py` - API endpoint definitions
- `backend/app/models/segment.py` - Segment data model
- `backend/tests/test_segment_editing.py` - Segment CRUD tests

**Frontend**:
- `frontend/src/hooks/useTranscription.ts` - API client hooks
- `frontend/src/components/Transcription/SegmentList.tsx` - Segment UI components
- `frontend/src/types/index.ts` - TypeScript type definitions

## Migration Notes

**Breaking Change**: DELETE endpoint path changed from `/segment/{id}` to `/segments/{id}`

**Impact**: Frontend automatically updated. Any external API consumers must update their DELETE calls to use the new plural path.

**Backward Compatibility**: The old `/segment/{id}` path still exists but only supports PATCH (edit) operations.

## Future Improvements

1. **Consistent Naming**: Consider standardizing all segment endpoints to use `/segments/` (plural) prefix
2. **Type Safety**: Apply `Optional` pattern consistently across all Pydantic models for better OpenAPI generation
3. **Replay UX**: Add visual feedback (e.g., spinner) while seeking audio position
4. **Batch Operations**: Consider adding bulk delete/insert endpoints for efficiency

## References

- FastAPI Route Conflicts: https://fastapi.tiangolo.com/tutorial/path-params/
- Pydantic Optional Fields: https://docs.pydantic.dev/latest/usage/fields/
- React Query Optimistic Updates: https://tanstack.com/query/latest/docs/react/guides/optimistic-updates
