# AI Editor Demo Guide

## How to See the AI Editor in Action

This guide shows you how to test and demonstrate the AI editor functionality that we just built comprehensive tests for.

## 🚀 Quick Start Demo

### 1. Start the Application

```bash
# Terminal 1: Start Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Start Frontend  
cd frontend
npm run dev
```

### 2. Access the AI Editor

1. Open browser to `http://localhost:3000`
2. Create or open a project with transcribed content
3. Navigate to the Editor view
4. Look for the **"AI Editor"** button in the interface

## 🎯 Testing Each AI Feature

### Feature 1: Semantic Reconstruction
**Purpose**: Improve clarity and structure of transcribed text

**How to test**:
1. Select text with unclear sentences or poor structure
2. Click "AI Editor" → "Semantic Reconstruction"
3. **Expected result**: Text becomes clearer and better structured

**Example input**:
```
uhm so like the thing is that we need to you know implement this feature and stuff
```

**Expected output**:
```
We need to implement this feature effectively.
```

### Feature 2: Style Generation
**Purpose**: Transform text into different writing styles

**How to test**:
1. Select any text segment
2. Click "AI Editor" → "Style Generation"
3. Choose style: Academic, Conversational, Formal, Journalistic, or Technical
4. **Expected result**: Text transformed to match selected style

**Example input**:
```
The meeting went well and we decided stuff.
```

**Academic style output**:
```
The meeting proceeded successfully, resulting in several key decisions being finalized.
```

### Feature 3: NLP Analysis
**Purpose**: Extract summary, themes, and structural analysis

**How to test**:
1. Select a longer text passage
2. Click "AI Editor" → "NLP Analysis"
3. **Expected result**: JSON structure showing:
   - Summary of the content
   - Key themes identified
   - Text structure analysis
   - Sentiment (if applicable)

**Example output**:
```json
{
  "summary": "Discussion about project implementation strategies",
  "themes": ["project management", "implementation", "strategy"],
  "structure": "conversational meeting notes",
  "sentiment": "positive"
}
```

### Feature 4: Fact Checking
**Purpose**: Verify factual claims in the content

**How to test**:
1. Select text containing factual statements
2. Click "AI Editor" → "Fact Checking"
3. Optionally specify domain (history, science, technology, etc.)
4. **Expected result**: Verification results for each statement

**Example input**:
```
Python was created in 1991 and the Earth is flat.
```

**Expected output**:
```json
{
  "verifications": [
    {
      "original_statement": "Python was created in 1991",
      "is_accurate": true,
      "verification_details": "Python 0.9.0 was released in February 1991."
    },
    {
      "original_statement": "the Earth is flat", 
      "is_accurate": false,
      "verification_details": "The Earth is spherical, not flat."
    }
  ]
}
```

### Feature 5: Technical Format Conversion
**Purpose**: Convert transcripts to technical formats

**How to test**:
1. Select text with speaker/timestamp metadata
2. Click "AI Editor" → "Technical Check"
3. Choose format: SRT, VTT, transcript, or chapters
4. **Expected result**: Properly formatted output

**Example input**:
```
[00:00:05] Speaker A: Hello everyone
[00:00:10] Speaker B: Thanks for joining
```

**SRT format output**:
```
1
00:00:05,000 --> 00:00:10,000
Speaker A: Hello everyone

2
00:00:10,000 --> 00:00:15,000
Speaker B: Thanks for joining
```

## 🧪 Running the Tests to Verify

### Frontend Tests
```bash
cd frontend

# Run all AI editor tests
npm test aiEditor.test.ts useAIEditor.test.tsx

# Or run with vitest directly
npx vitest run src/api/__tests__/aiEditor.test.ts
npx vitest run src/hooks/__tests__/useAIEditor.test.tsx
```

### Backend Tests
```bash
cd backend

# Run all AI editor tests
python -m pytest tests/test_ai_editor.py -v

# Run specific test categories
python -m pytest tests/test_ai_editor.py::TestSemanticReconstructionEndpoint -v
python -m pytest tests/test_ai_editor.py::TestStyleGenerationEndpoint -v
python -m pytest tests/test_ai_editor.py::TestNLPAnalysisEndpoint -v
python -m pytest tests/test_ai_editor.py::TestFactCheckingEndpoint -v
python -m pytest tests/test_ai_editor.py::TestTechnicalCheckEndpoint -v
```

## 🔧 Manual API Testing

### Using curl to test the backend directly:

#### 1. Semantic Reconstruction
```bash
curl -X POST "http://localhost:8000/api/ai_editor/semantic-reconstruction" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "uhm so like we need to you know do this thing",
    "project_id": 1,
    "provider": "ollama"
  }'
```

#### 2. Style Generation
```bash
curl -X POST "http://localhost:8000/api/ai_editor/style-generation" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The meeting was good",
    "project_id": 1,
    "target_style": "academic",
    "provider": "ollama"
  }'
```

#### 3. NLP Analysis
```bash
curl -X POST "http://localhost:8000/api/ai_editor/nlp-analysis" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a comprehensive discussion about project management strategies and implementation approaches.",
    "project_id": 1,
    "provider": "ollama"
  }'
```

#### 4. Fact Checking
```bash
curl -X POST "http://localhost:8000/api/ai_editor/fact-checking" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Python was created in 1991 by Guido van Rossum",
    "project_id": 1,
    "domain": "technology",
    "provider": "ollama"
  }'
```

#### 5. Technical Format Conversion
```bash
curl -X POST "http://localhost:8000/api/ai_editor/technical-check" \
  -H "Content-Type: application/json" \
  -d '{
    "text_with_metadata": "[00:00:05] Speaker A: Hello everyone [00:00:10] Speaker B: Thanks for joining",
    "project_id": 1,
    "target_format": "SRT",
    "provider": "ollama"
  }'
```

## 🐛 Troubleshooting

### Common Issues:

1. **"Provider not available" error**
   - Ensure Ollama is running: `ollama serve`
   - Check if models are installed: `ollama list`

2. **Frontend not connecting to backend**
   - Verify backend is running on port 8000
   - Check CORS settings in backend

3. **Tests failing**
   - Ensure all dependencies installed: `npm install` and `pip install -r requirements.txt`
   - Check Python version compatibility (Python 3.11 recommended)

4. **AI Editor button not visible**
   - Ensure you're in a project with transcribed content
   - Check browser console for JavaScript errors

## 📊 Expected Performance

- **Response Time**: 2-10 seconds per AI operation (depends on model and complexity)
- **Accuracy**: Varies by AI model quality and prompt engineering
- **Reliability**: High with proper error handling and retries

## 🎥 Demo Script

For a complete demonstration:

1. **Setup** (30 seconds): Start both backend and frontend
2. **Navigate** (30 seconds): Open project with existing transcript
3. **Semantic Reconstruction** (1 minute): Show text improvement
4. **Style Generation** (1 minute): Demonstrate different styles
5. **NLP Analysis** (1 minute): Show structured analysis output
6. **Fact Checking** (1 minute): Verify some factual claims
7. **Technical Conversion** (1 minute): Convert to SRT format
8. **Tests** (2 minutes): Run test suites to show reliability

**Total demo time**: ~8 minutes

This demonstrates a production-ready AI editor with comprehensive testing coverage!