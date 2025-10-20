# Segment Time Validation - October 19, 2025

## Issue Update (Latest)

**FIXED**: Users were able to manually type values that exceeded min/max restrictions in time input controllers. While HTML5 min/max attributes worked for browser controls (spinner arrows), they didn't prevent manual keyboard input.

## Original Issue

Users were able to enter invalid segment times in the UI that exceeded valid bounds, causing segments to overlap with neighboring segments. The validation only occurred at the backend level after saving, providing poor user experience.

**Example of Invalid Input**:
```
Segment at position 1:43 - 1:45
User enters: START: 101.94s, END: 106.72s
```

This should not be possible as it would overlap with neighboring segments.

## Latest Solution Implementation (Real-time Validation)

### Real-time Input Validation Function

Added `handleTimeInput` function that validates and constrains input as users type:

```typescript
const handleTimeInput = (value: string, type: 'start' | 'end', segmentId: number) => {
  const bounds = getSegmentTimeBounds(segmentId)
  const segment = segments?.find((s) => s.id === segmentId)
  if (!segment) return

  // Allow empty values during editing
  if (value === '' || value === '-') {
    if (type === 'start') setEditStart(value)
    else setEditEnd(value)
    return
  }

  const numericValue = parseFloat(value)
  
  // If not a valid number, reject the input
  if (isNaN(numericValue)) {
    return // Don't update state with invalid values
  }

  if (type === 'start') {
    const currentEnd = parseFloat(editEnd) || segment.end_time
    const minStart = bounds.minStart
    const maxStart = currentEnd - 0.01 // Must be less than end time
    
    // Constrain the value to valid bounds
    const constrainedValue = Math.max(minStart, Math.min(maxStart, numericValue))
    setEditStart(constrainedValue.toString())
    
    // Show warning if value was constrained
    if (constrainedValue !== numericValue) {
      if (numericValue < minStart) {
        toastError('Invalid start time', `Minimum start time is ${minStart.toFixed(2)}s`)
      } else if (numericValue >= currentEnd) {
        toastError('Invalid start time', `Start time must be less than end time (${currentEnd.toFixed(2)}s)`)
      }
    }
  } else {
    // Similar logic for end time...
  }
}
```

### Input Handler Updates

Updated the onChange handlers to use the new validation:

```typescript
// Before: Basic state update
onChange={(event) => setEditStart(event.target.value)}

// After: Validated input handling  
onChange={(event) => handleTimeInput(event.target.value, 'start', segment.id)}
```

### Key Features

1. **Immediate Validation**: Values are checked as users type
2. **Automatic Constraining**: Invalid values are automatically corrected to nearest valid value
3. **User Feedback**: Toast notifications explain why values were constrained
4. **Flexible Input**: Allows empty values and partial inputs during editing
5. **Error Prevention**: Invalid numeric input is completely rejected

### Validation Rules

#### Start Time Constraints
- **Minimum**: Must be >= previous segment's end time
- **Maximum**: Must be < current segment's end time (with 0.01s buffer)

#### End Time Constraints  
- **Minimum**: Must be > current segment's start time (with 0.01s buffer)
- **Maximum**: Must be <= next segment's start time (or unlimited if last segment)

## Root Cause

1. **Frontend**: No client-side validation or input constraints
2. **Frontend**: No visual feedback about valid time ranges
3. **Backend**: Validation existed but errors were generic

## Solution

Implemented multi-layer validation:

### 1. HTML5 Input Constraints

Added dynamic `min` and `max` attributes to time input fields to provide immediate browser-level validation:

**Start Time Input**:
```tsx
<input
  type="number"
  step="0.1"
  min={bounds.minStart}           // Previous segment's end time (or 0)
  max={currentEnd - 0.1}           // CANNOT EXCEED segment's own end time
  value={editStart}
  title="Must be >= X.XXs and < Y.YYs"
/>
```

**End Time Input**:
```tsx
<input
  type="number"
  step="0.1"
  min={currentStart + 0.1}         // CANNOT BE LESS than segment's own start time
  max={bounds.maxEnd}              // Next segment's start time (if exists)
  value={editEnd}
  title="Must be > X.XXs and <= Y.YYs"
/>
```

### 2. Visual Feedback

Display **dynamic valid time ranges** directly in the input labels that update as user types:

**Start Time Label**:
```tsx
<span className="mb-1 text-muted-foreground uppercase tracking-wide">
  Start (s)
  <span className="ml-1 text-xs opacity-75">
    {startMin.toFixed(2)} - {startMax.toFixed(2)}
  </span>
</span>
```

**End Time Label**:
```tsx
<span className="mb-1 text-muted-foreground uppercase tracking-wide">
  End (s)
  <span className="ml-1 text-xs opacity-75">
    {endMin.toFixed(2)} - {maxEndDisplay}
  </span>
</span>
```

Example display: `Start (s) 10.00 - 19.90` and `End (s) 10.10 - 20.00`

### 3. Client-Side JavaScript Validation

Added comprehensive validation before sending API requests:

```typescript
// Check if end > start
if (newEnd <= newStart) {
  toastError('Invalid time range', 'End time must be greater than start time.')
  return
}

// Check bounds against neighboring segments
const bounds = getSegmentTimeBounds(segmentId)

if (newStart < bounds.minStart) {
  toastError(
    'Invalid start time',
    `Start time (${newStart.toFixed(2)}s) overlaps with previous segment. Minimum allowed: ${bounds.minStart.toFixed(2)}s`
  )
  return
}

if (newEnd > bounds.maxEnd) {
  toastError(
    'Invalid end time',
    `End time (${newEnd.toFixed(2)}s) overlaps with next segment. Maximum allowed: ${bounds.maxEnd.toFixed(2)}s`
  )
  return
}
```

### 4. Backend Validation (Already Existed)

Backend validation remains as final safeguard:

```python
# Validate against neighboring segments
lower_bound = prev_segment.end_time if prev_segment else 0.0
upper_bound = next_segment.start_time if next_segment else audio_file.duration

if new_start < lower_bound:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Segment start time overlaps the previous segment.",
    )

if upper_bound is not None and new_end > upper_bound:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Segment end time overlaps the next segment.",
    )

if new_end <= new_start:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Segment end time must be greater than start time.",
    )
```

## Implementation Details

### Frontend Changes

**File**: `frontend/src/components/Transcription/SegmentList.tsx`

**1. Added helper function to calculate valid bounds** (lines 263-276):

```typescript
// Get valid time bounds for the currently editing segment
const getSegmentTimeBounds = (segmentId: number) => {
  if (!segments) return { minStart: 0, maxEnd: Infinity }

  const currentIndex = segments.findIndex((s) => s.id === segmentId)
  if (currentIndex === -1) return { minStart: 0, maxEnd: Infinity }

  const prevSegment = currentIndex > 0 ? segments[currentIndex - 1] : null
  const nextSegment = currentIndex < segments.length - 1 ? segments[currentIndex + 1] : null

  const minStart = prevSegment ? prevSegment.end_time : 0
  const maxEnd = nextSegment ? nextSegment.start_time : Infinity

  return { minStart, maxEnd }
}
```

**2. Enhanced input fields with dynamic validation attributes** (lines 638-702):

**Dynamic Constraint Calculation**:
```typescript
// Parse current input values for dynamic validation
const currentStart = parseFloat(editStart) || segment.start_time
const currentEnd = parseFloat(editEnd) || segment.end_time

// Start time constraints:
// - Must be >= previous segment's end (bounds.minStart)
// - Must be < current end time (cannot exceed own end)
const startMin = bounds.minStart
const startMax = currentEnd - 0.1 // Leave 0.1s minimum gap

// End time constraints:
// - Must be > current start time (cannot be less than own start)
// - Must be <= next segment's start (bounds.maxEnd)
const endMin = currentStart + 0.1 // Leave 0.1s minimum gap
const endMax = bounds.maxEnd !== Infinity ? bounds.maxEnd : undefined
```

**Features**:
- Start time `min` = previous segment's end, `max` = **own end - 0.1s**
- End time `min` = **own start + 0.1s**, `max` = next segment's start
- Constraints update dynamically as user types
- Visual range display in labels (e.g., "10.00 - 19.90")
- Helpful `title` tooltips explaining constraints

**3. Added client-side validation in save handler** (lines 295-332):

- Validate end > start
- Validate start >= previous segment end
- Validate end <= next segment start
- Show descriptive error messages with specific values

### Backend Changes

**File**: `backend/app/api/transcription.py`

**Updated Pydantic model for consistency** (lines 98-103):

```python
class SegmentUpdateRequest(BaseModel):
    """Request to update a segment's edited text."""
    edited_text: Optional[str] = None
    is_passive: Optional[bool] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
```

Changed from `float | None` to `Optional[float]` for better Pydantic/FastAPI compatibility.

## User Experience Improvements

### Before
1. User enters invalid time (e.g., 101.94s when segment is at 1:43)
2. User clicks Save
3. Request fails at backend
4. Generic error message shown
5. User must guess what values are valid

### After
1. User sees valid range in label: "Start (s) min: 103.00"
2. Browser prevents values below minimum via HTML5 validation
3. If user bypasses browser validation, JavaScript validation catches it
4. Descriptive error message: "Start time (101.94s) overlaps with previous segment. Minimum allowed: 103.00s"
5. User knows exactly what values are acceptable

## Validation Layers

```
┌─────────────────────────────────┐
│   1. HTML5 Input Constraints    │  ← Browser-level prevention
│   (min/max attributes)          │
└────────────┬────────────────────┘
             │ If bypassed
             ▼
┌─────────────────────────────────┐
│   2. Visual Feedback            │  ← User guidance
│   (min/max in labels)           │
└────────────┬────────────────────┘
             │ User attempts save
             ▼
┌─────────────────────────────────┐
│   3. Client-Side Validation     │  ← JavaScript checks
│   (before API call)             │
└────────────┬────────────────────┘
             │ If passes
             ▼
┌─────────────────────────────────┐
│   4. Backend Validation         │  ← Final safeguard
│   (FastAPI endpoint)            │
└─────────────────────────────────┘
```

## Edge Cases Handled

### First Segment
- **Min start**: 0.0s (no previous segment)
- **Max end**: Next segment's start time or Infinity

### Middle Segment
- **Min start**: Previous segment's end time
- **Max end**: Next segment's start time

### Last Segment
- **Min start**: Previous segment's end time
- **Max end**: Audio file duration or Infinity

### Single Segment
- **Min start**: 0.0s
- **Max end**: Audio file duration or Infinity

## Testing

### Manual Testing Checklist

- [x] Visual bounds displayed in input labels
- [x] HTML5 min/max prevents invalid input
- [x] Client-side validation shows descriptive errors
- [x] Overlapping with previous segment prevented
- [x] Overlapping with next segment prevented
- [x] End time must be > start time
- [x] Backend validation still works as fallback
- [ ] E2E test for time validation (if needed)

### Test Scenarios

**Scenario 1: Overlap with previous segment**
```
Segments: [0-10], [10-20], [20-30]
Edit middle segment start to 9.5s
Expected: Error - "Start time (9.50s) overlaps with previous segment. Minimum allowed: 10.00s"
```

**Scenario 2: Overlap with next segment**
```
Segments: [0-10], [10-20], [20-30]
Edit middle segment end to 20.5s
Expected: Error - "End time (20.50s) overlaps with next segment. Maximum allowed: 20.00s"
```

**Scenario 3: End <= Start**
```
Edit segment with start: 15.0s, end: 14.0s
Expected: Error - "End time must be greater than start time."
```

**Scenario 4: Valid edit**
```
Segments: [0-10], [10-20], [20-30]
Edit middle segment: start: 11.0s, end: 19.0s
Expected: Success - segment updated
```

## API Documentation

### Update Segment Endpoint

**Endpoint**: `PATCH /api/transcription/segment/{segment_id}`

**Request Body**:
```json
{
  "edited_text": "string | null",
  "is_passive": "boolean | null",
  "start_time": "number | null",  // Must not overlap neighbors
  "end_time": "number | null"      // Must be > start_time
}
```

**Validation Rules**:
- `start_time >= previous_segment.end_time` (or >= 0 if first segment)
- `end_time <= next_segment.start_time` (or <= audio_duration if last)
- `end_time > start_time`

**Error Responses**:
```json
// 400 Bad Request - Overlap with previous
{
  "detail": "Segment start time overlaps the previous segment."
}

// 400 Bad Request - Overlap with next
{
  "detail": "Segment end time overlaps the next segment."
}

// 400 Bad Request - Invalid range
{
  "detail": "Segment end time must be greater than start time."
}

// 404 Not Found
{
  "detail": "Segment {segment_id} not found"
}
```

## Related Files

**Frontend**:
- `frontend/src/components/Transcription/SegmentList.tsx:263-276` - `getSegmentTimeBounds()` helper
- `frontend/src/components/Transcription/SegmentList.tsx:295-332` - Client-side validation
- `frontend/src/components/Transcription/SegmentList.tsx:638-679` - Input fields with constraints

**Backend**:
- `backend/app/api/transcription.py:920-1016` - Update segment endpoint
- `backend/app/api/transcription.py:98-103` - `SegmentUpdateRequest` model
- `backend/app/api/transcription.py:965-992` - Time validation logic

## Future Enhancements

1. **Real-time validation**: Show errors as user types, not just on save
2. **Visual timeline**: Display segments on a timeline with drag-to-resize
3. **Smart suggestions**: Suggest optimal time splits when editing
4. **Batch time adjustment**: Shift all subsequent segments when one is edited
5. **Undo/redo**: Allow reverting time changes
6. **Audio preview**: Play segment range before saving changes

## References

- HTML5 Input Validation: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number
- Pydantic Optional Fields: https://docs.pydantic.dev/latest/usage/fields/
- FastAPI Request Validation: https://fastapi.tiangolo.com/tutorial/body/
