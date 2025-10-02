# API Documentation

## Base URL
`http://localhost:8000`

## Authentication
Currently no authentication required for development. JWT authentication will be added in Phase 7.

---

## Upload Endpoints

### Create Project
**POST** `/api/upload/project`

Create a new transcription project.

**Request Body:**
```json
{
  "name": "Interview with John Doe",
  "description": "Optional description"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "Interview with John Doe",
  "description": "Optional description",
  "created_at": "2025-10-02T12:00:00"
}
```

---

### Upload Audio File
**POST** `/api/upload/file/{project_id}`

Upload an audio file to a project.

**Parameters:**
- `project_id` (path): ID of the project

**Request:** `multipart/form-data`
- `file`: Audio file (mp3, wav, m4a, webm, ogg, flac)

**Response:** `201 Created`
```json
{
  "file_id": 1,
  "filename": "abc123-def456.mp3",
  "original_filename": "interview.mp3",
  "file_size": 5242880,
  "duration": 300.5,
  "status": "pending"
}
```

**Errors:**
- `400 Bad Request`: Invalid file format or size
- `404 Not Found`: Project not found

---

### List Project Files
**GET** `/api/upload/files/{project_id}`

Get all audio files in a project.

**Parameters:**
- `project_id` (path): ID of the project

**Response:** `200 OK`
```json
[
  {
    "file_id": 1,
    "filename": "abc123-def456.mp3",
    "original_filename": "interview.mp3",
    "file_size": 5242880,
    "duration": 300.5,
    "status": "completed"
  }
]
```

---

## Transcription Endpoints

### Start Transcription
**POST** `/api/transcription/{file_id}/start`

Start transcription of an audio file in the background.

**Parameters:**
- `file_id` (path): ID of the audio file

**Request Body:**
```json
{
  "include_diarization": true
}
```

**Response:** `202 Accepted`
```json
{
  "message": "Transcription started",
  "file_id": 1,
  "include_diarization": true
}
```

---

### Get Transcription Status
**GET** `/api/transcription/{file_id}/status`

Get the current status of transcription.

**Parameters:**
- `file_id` (path): ID of the audio file

**Response:** `200 OK`
```json
{
  "file_id": 1,
  "status": "processing",
  "progress": 0.65,
  "error_message": null,
  "segment_count": 42,
  "duration": 300.5
}
```

**Status Values:**
- `pending`: Not yet started
- `processing`: Currently transcribing
- `completed`: Transcription finished
- `failed`: Error occurred

---

### Get Segments
**GET** `/api/transcription/{file_id}/segments`

Get all transcription segments for an audio file.

**Parameters:**
- `file_id` (path): ID of the audio file

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "start_time": 0.0,
    "end_time": 5.2,
    "original_text": "Hello, welcome to the interview.",
    "edited_text": null,
    "speaker_id": 1,
    "sequence": 0
  },
  {
    "id": 2,
    "start_time": 5.2,
    "end_time": 10.8,
    "original_text": "Thank you for having me.",
    "edited_text": "Thanks for having me!",
    "speaker_id": 2,
    "sequence": 1
  }
]
```

---

### Get Speakers
**GET** `/api/transcription/{file_id}/speakers`

Get all speakers identified in the audio file.

**Parameters:**
- `file_id` (path): ID of the audio file

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "speaker_id": "SPEAKER_00",
    "display_name": "Interviewer",
    "color": "#3B82F6"
  },
  {
    "id": 2,
    "speaker_id": "SPEAKER_01",
    "display_name": "John Doe",
    "color": "#EF4444"
  }
]
```

---

## Error Responses

All endpoints may return these standard error responses:

**400 Bad Request**
```json
{
  "detail": "File size exceeds maximum allowed size of 500MB"
}
```

**404 Not Found**
```json
{
  "detail": "Project with ID 123 not found"
}
```

**500 Internal Server Error**
```json
{
  "detail": "Internal server error"
}
```

---

## AI Analysis Endpoints

### Analyze Project Content
**POST** `/api/ai/analyze/project/{project_id}`

Analyze project content and suggest content type using AI.

**Parameters:**
- `project_id` (path): ID of the project
- `provider` (query, optional): LLM provider to use (default: "ollama")

**Response:** `200 OK`
```json
{
  "suggested_content_type": "lyrics",
  "confidence": 0.95,
  "reasoning": "Clear verse/chorus structure with poetic language and repetition",
  "suggested_description": "Song lyrics with multiple verses and chorus"
}
```

**How It Works:**
1. Fetches first 10 segments from the project
2. Sends sample text to LLM with analysis prompt
3. LLM suggests content type with reasoning
4. System validates consistency using weighted keyword scoring
5. Returns suggestion with confidence

**Weighted Keyword Scoring:**

The system post-processes LLM responses for accuracy:

| Content Type | Strong (3 pts) | Medium (2 pts) | Weak (1 pt) |
|--------------|----------------|----------------|-------------|
| Lyrics | "lyrics", "verse/chorus" | "verse", "chorus" | "poetic" |
| Academic | "academic", "lecture" | "research", "educational" | "formal" |
| Interview | "interview", "q&a" | "conversation" | "discussion" |
| Literature | "fiction", "novel" | "story", "tale" | "narrative" |
| Media | "podcast", "radio show" | "broadcast" | "show" |
| Presentation | "presentation" | "business talk" | - |

Requires score ≥ 2 for confident match. Corrects inconsistencies between suggested type and reasoning.

**Errors:**
- `404 Not Found`: Project not found
- `400 Bad Request`: No segments available for analysis
- `503 Service Unavailable`: LLM provider not responding

---

### Apply Analysis
**POST** `/api/ai/analyze/project/{project_id}/apply`

Apply suggested content type and description to project.

**Parameters:**
- `project_id` (path): ID of the project

**Request Body:**
```json
{
  "content_type": "lyrics",
  "description": "Song lyrics with multiple verses"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "My Project",
  "content_type": "lyrics",
  "description": "Song lyrics with multiple verses",
  "updated": true
}
```

**Errors:**
- `404 Not Found`: Project not found

---

## AI Correction Endpoints

### Correct Segment
**POST** `/api/ai/correct-segment`

Get AI correction suggestions for a single segment.

**Request Body:**
```json
{
  "segment_id": 123,
  "provider": "ollama",
  "correction_type": "all"
}
```

**Parameters:**
- `segment_id`: ID of the segment to correct
- `provider` (optional): "ollama" or "openrouter" (default: "ollama")
- `correction_type` (optional): "grammar", "spelling", "punctuation", or "all" (default: "all")

**Context Included:**
- **Speaker**: Speaker name/label if assigned
- **Content Type**: From project settings (if not "general")
- **Previous Segment**: Last 80 characters (if available)
- **Next Segment**: First 80 characters (if available)

**Response:** `200 OK`
```json
{
  "segment_id": 123,
  "original_text": "This is a test sentance with an error.",
  "corrected_text": "This is a test sentence with an error.",
  "changes": [
    "\"sentance\" → \"sentence\""
  ],
  "confidence": 0.85
}
```

**Errors:**
- `404 Not Found`: Segment not found
- `400 Bad Request`: Invalid provider
- `503 Service Unavailable`: LLM provider not responding

---

### Correct Multiple Segments
**POST** `/api/ai/correct-batch`

Get AI corrections for multiple segments.

**Request Body:**
```json
{
  "segment_ids": [123, 124, 125],
  "provider": "ollama",
  "correction_type": "all"
}
```

**Response:** `200 OK`
```json
[
  {
    "segment_id": 123,
    "original_text": "First segment",
    "corrected_text": "First segment",
    "changes": [],
    "confidence": 0.9
  },
  {
    "segment_id": 124,
    "original_text": "Second segment",
    "corrected_text": "Second segment",
    "changes": [],
    "confidence": 0.9
  }
]
```

**Note**: Continues processing even if individual segments fail. Failed segments return with `confidence: 0.0` and error in `changes`.

---

### List LLM Providers
**GET** `/api/ai/providers`

List available LLM providers.

**Response:** `200 OK`
```json
[
  {
    "name": "ollama",
    "available": true
  },
  {
    "name": "openrouter",
    "available": true
  }
]
```

---

### Check Provider Health
**GET** `/api/ai/health`

Check health status of all LLM providers.

**Response:** `200 OK`
```json
{
  "ollama": true,
  "openrouter": false
}
```

---

## Interactive Documentation

When the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
