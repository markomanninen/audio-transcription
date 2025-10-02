# Frontend Development Guide

## Tech Stack

- **React 18** with TypeScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Query** - Server state management
- **Axios** - HTTP client

## Project Structure

```
frontend/src/
├── api/
│   └── client.ts           # Axios instance with interceptors
├── components/
│   ├── Upload/
│   │   └── FileUploader.tsx    # Drag-drop file upload
│   ├── Dashboard/
│   │   ├── FileList.tsx        # Project files list
│   │   └── TranscriptionProgress.tsx  # Status tracking
│   ├── Player/
│   │   └── AudioPlayer.tsx     # Audio playback controls
│   └── Transcription/
│       └── SegmentList.tsx     # Segment display
├── hooks/
│   ├── useProjects.ts      # Project CRUD
│   ├── useUpload.ts        # File upload & list
│   └── useTranscription.ts # Transcription API
├── types/
│   └── index.ts            # TypeScript interfaces
├── App.tsx                 # Main application
└── main.tsx                # Entry point
```

## Key Components

### FileUploader
Drag-and-drop file upload with validation.

**Props:**
- `projectId: number` - Target project
- `onUploadComplete?: (fileId: number) => void` - Success callback

**Features:**
- Drag & drop support
- File type validation
- Upload progress indicator
- Error handling

### FileList
Displays all audio files in a project.

**Props:**
- `projectId: number` - Project to display
- `selectedFileId?: number` - Currently selected file
- `onSelectFile?: (fileId: number) => void` - Selection callback

**Features:**
- File status badges (pending, processing, completed, failed)
- File size and duration display
- Transcribe button for pending files
- Click to select/view file

### TranscriptionProgress
Real-time transcription status with auto-polling.

**Props:**
- `fileId: number` - File to monitor

**Features:**
- Auto-refresh every 2s during processing
- Progress bar with percentage
- Status indicators
- Error message display

### AudioPlayer
HTML5 audio player with custom controls.

**Props:**
- `audioUrl: string` - Audio source URL
- `currentTime?: number` - External time control
- `onTimeUpdate?: (time: number) => void` - Time change callback
- `onSeek?: (time: number) => void` - Seek callback

**Features:**
- Play/pause control
- Seek slider with progress indicator
- Time display (current/total)
- External time synchronization

### SegmentList
Displays transcription segments with speaker info.

**Props:**
- `fileId: number` - Source audio file
- `currentTime?: number` - Current playback time
- `onSegmentClick?: (segment: Segment) => void` - Segment click handler

**Features:**
- Speaker color coding
- Timestamp display
- Active segment highlighting (synced with audio)
- Shows edited vs original text
- Click to jump to segment time

## Custom Hooks

### useCreateProject()
```typescript
const createProject = useCreateProject()

createProject.mutate(
  { name: "My Project", description: "Optional" },
  { onSuccess: (project) => console.log(project.id) }
)
```

### useUploadFile(projectId)
```typescript
const upload = useUploadFile(projectId)

upload.mutate(file, {
  onSuccess: (audioFile) => console.log(audioFile.file_id)
})
```

### useProjectFiles(projectId)
```typescript
const { data: files, isLoading } = useProjectFiles(projectId)
```

### useStartTranscription()
```typescript
const start = useStartTranscription()

start.mutate({
  fileId: 1,
  includeDiarization: true
})
```

### useTranscriptionStatus(fileId, pollInterval)
```typescript
// Auto-polls every 2s while processing
const { data: status } = useTranscriptionStatus(fileId, 2000)

console.log(status.progress) // 0.0 to 1.0
console.log(status.status)   // pending, processing, completed, failed
```

### useSegments(fileId)
```typescript
const { data: segments } = useSegments(fileId)

segments.forEach(s => {
  console.log(s.start_time, s.end_time, s.original_text)
})
```

### useSpeakers(fileId)
```typescript
const { data: speakers } = useSpeakers(fileId)

speakers.forEach(s => {
  console.log(s.display_name, s.color)
})
```

## State Management

Application state is managed through:

1. **React Query** - Server state (API data)
   - Automatic caching
   - Background refetching
   - Optimistic updates
   - Request deduplication

2. **Local State (useState)** - UI state
   - `projectId` - Current project
   - `selectedFileId` - Current file
   - `audioCurrentTime` - Playback position

## Styling

Uses Tailwind CSS utility classes:

```tsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">
    Title
  </h2>
</div>
```

**Color Palette:**
- Primary: Blue (`bg-blue-600`, `text-blue-800`)
- Success: Green (`bg-green-100`, `text-green-800`)
- Error: Red (`bg-red-100`, `text-red-800`)
- Processing: Blue (`bg-blue-100`, `text-blue-800`)
- Neutral: Gray shades

## Testing

### Component Tests (Vitest)
```bash
npm test                 # Run all tests
npm test -- --watch      # Watch mode
npm test -- --coverage   # Coverage report
```

**Example:**
```typescript
import { render, screen } from '@testing-library/react'
import FileUploader from '../Upload/FileUploader'

it('renders upload area', () => {
  render(<FileUploader projectId={1} />, { wrapper: QueryProvider })
  expect(screen.getByText(/Drop audio file here/i)).toBeInTheDocument()
})
```

### E2E Tests (Playwright)
```bash
cd tests/e2e
npx playwright test
```

## Development Workflow

1. **Start dev server:**
   ```bash
   npm run dev
   # Opens http://localhost:5173
   ```

2. **Type checking:**
   ```bash
   npm run type-check
   ```

3. **Linting:**
   ```bash
   npm run lint
   npm run format
   ```

4. **Build:**
   ```bash
   npm run build
   npm run preview  # Preview production build
   ```

## Common Patterns

### API Error Handling
```typescript
const upload = useUploadFile(projectId)

if (upload.isError) {
  return <div>Error: {upload.error?.message}</div>
}
```

### Loading States
```typescript
const { data, isLoading } = useSegments(fileId)

if (isLoading) {
  return <Spinner />
}
```

### Conditional Rendering
```typescript
{selectedFileId ? (
  <TranscriptionView fileId={selectedFileId} />
) : (
  <EmptyState message="Select a file to view" />
)}
```

### Audio-Text Sync
```typescript
// In parent component
const [currentTime, setCurrentTime] = useState(0)

// Audio player updates time
<AudioPlayer onTimeUpdate={setCurrentTime} />

// Segment list highlights active segment
<SegmentList currentTime={currentTime} />

// Click segment to seek audio
<SegmentList
  onSegmentClick={(seg) => setCurrentTime(seg.start_time)}
/>
```

## Environment Variables

Create `.env` file:
```
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL
```

## Performance Optimization

1. **React Query caching** - Automatic background refetch
2. **Component memoization** - Use `useMemo` for expensive calculations
3. **Lazy loading** - Code splitting with `React.lazy()`
4. **Virtual scrolling** - For large segment lists (future)

## Troubleshooting

### CORS Errors
Ensure backend allows frontend origin in `backend/app/main.py`:
```python
allow_origins=["http://localhost:5173"]
```

### API Connection Failed
Check `VITE_API_BASE_URL` matches backend port.

### Audio Not Playing
Verify audio file URL is accessible and CORS headers are set.
