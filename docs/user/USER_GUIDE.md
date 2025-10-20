# User Guide - Audio Transcription App

## Table of Contents

1. [Getting Started](#getting-started)
2. [Uploading Audio Files](#uploading-audio-files)
3. [Transcription](#transcription)
4. [Editing Transcriptions](#editing-transcriptions)
5. [AI-Powered Features](#ai-powered-features)
6. [Speaker Management](#speaker-management)
7. [Exporting](#exporting)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Dark Mode](#dark-mode)
10. [Tips and Tricks](#tips-and-tricks)

## Getting Started

### Creating Your First Project

1. Click **"New Project"** button
2. Enter a project name and optional description
3. Click **"Create"** to save

Projects help organize your audio files and transcriptions.

### Understanding the Interface

The interface consists of:
- **Project Selector** - Switch between projects
- **File List** - View uploaded audio files
- **Audio Player** - Play and navigate audio
- **Transcription Panel** - View and edit transcribed text
- **Settings** - Configure AI providers and preferences

## Uploading Audio Files

### Supported Formats

- MP3
- WAV
- M4A
- FLAC
- OGG

### Upload Process

1. Select a project (or create one)
2. Click **"Upload Audio"** or drag-and-drop files
3. Wait for upload to complete
4. File appears in the file list

### File Size Limits

- Maximum file size: 500MB
- For larger files, consider splitting them first

### Splitting Long Recordings

1. In the file list, click **"✂️ Split & Batch"** on the audio you want to divide
2. Choose chunk length, optional overlap, and whether to start transcription automatically
3. Submit to create new audio files (e.g., Part 01, Part 02) in the same project
4. Each chunk can be transcribed independently with the selected settings

New chunks appear alongside the original file so you can decide which version to keep.

## Transcription

### Starting Transcription

1. Select an uploaded audio file
2. Click **"Start Transcription"**
3. Choose options:
   - **Include Speaker Diarization** - Identify different speakers
4. Click **"Start"**

### Transcription Progress

- Progress bar shows completion percentage
- Transcription runs in the background
- You can continue working while it processes

### Viewing Transcription

Once complete:
- Transcribed text appears in segments
- Each segment shows:
  - Timestamp
  - Speaker (if diarization was used)
  - Transcribed text

## Editing Transcriptions

### Inline Editing

1. Click the **"Edit"** button on any segment
2. Make your changes
3. Click **"Save"** or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)
4. Click **"Cancel"** or press `Esc` to discard changes

### Viewing Original Text

- Edited segments show original text in italic below
- This helps you track what was changed

### Audio Synchronization

- Click the **Play** button on any segment to jump to that position
- Currently playing segment is highlighted
- Use this to verify accuracy

## AI-Powered Features

### Content Analysis

Automatically analyze your transcription to:
- Identify content type (lyrics, interview, academic, etc.)
- Get confidence scores
- Receive suggested descriptions

**To use:**
1. Click **"Analyze Content"** button
2. Review AI suggestions
3. Click **"Apply"** to update project metadata

### AI Corrections

Fix spelling, grammar, and punctuation errors:

**Single Segment:**
1. Click **"AI Correct"** button on a segment
2. Review suggested changes in the dialog
3. Check the diff to see what changed
4. Click **"Apply"** to accept or **"Cancel"** to reject

> 🛑 Passive segments cannot be sent to AI until you reactivate them.

### Segment Selection Tools

Manage multiple segments in bulk:

1. Use the checkbox next to each segment to build a selection
2. A toolbar appears above the list with actions:
   - **Mark Passive/Active** – exclude or include segments in exports and AI tools
   - **Join Selected** – merge nearby segments into a single entry
3. Click **Clear** to reset the selection at any time

Batch AI corrections will reuse the same selection workflow in a future update.

### Correction Types

- **Grammar** - Fix grammatical errors
- **Spelling** - Correct spelling mistakes
- **Punctuation** - Improve punctuation
- **All** - Apply all corrections

### LLM Provider Settings

Configure which AI provider to use:

1. Click **Settings** icon
2. Select provider:
   - **Ollama** - Local, private (default)
   - **OpenRouter** - Cloud-based (requires API key)
3. Health status indicator shows if provider is available

## Speaker Management

### Identifying Speakers

When transcription includes speaker diarization:
- Speakers are labeled (Speaker 1, Speaker 2, etc.)
- Each speaker gets a unique color

### Renaming Speakers

1. Click **"Manage Speakers"**
2. Enter meaningful names (e.g., "John Doe", "Interviewer")
3. Click **"Save"**
4. Names update throughout the transcription

### Speaker Colors

- Each speaker has a distinct color for easy identification
- Colors are automatically assigned

## Exporting

### Export Formats

1. **SRT (SubRip Subtitle)**
   - Standard subtitle format
   - Includes timestamps
   - Compatible with video players

2. **HTML (Web Page)**
   - Formatted document
   - Styled for printing or viewing
   - Includes metadata

3. **TXT (Plain Text)**
   - Simple text format
   - Optional timestamps
   - Easy to import elsewhere

### Export Options

- **Use edited text** - Include your manual edits (recommended)
- **Include speaker names** - Show who said what
- **Include timestamps** - Show when each segment occurred

### How to Export

1. Click **"Export"** button
2. Select format (SRT, HTML, or TXT)
3. Configure options
4. Click **"Download"**
5. File is saved to your downloads folder

## Keyboard Shortcuts

Press **`?`** anytime to view all shortcuts.

### Audio Controls

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `→` | Skip forward 5 seconds |
| `←` | Skip backward 5 seconds |

### Navigation

| Shortcut | Action |
|----------|--------|
| `↓` | Next segment |
| `↑` | Previous segment |

### Editing

| Shortcut | Action |
|----------|--------|
| `E` | Edit focused segment |
| `Ctrl+Enter` (Windows/Linux)<br>`Cmd+Enter` (Mac) | Save edit |
| `Esc` | Cancel edit / Close modal |

### General

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` (Windows/Linux)<br>`Cmd+S` (Mac) | Save |
| `?` | Show keyboard shortcuts |

### Tips

- Shortcuts don't work when typing in text fields
- Use keyboard navigation for faster editing
- Press `?` to see all available shortcuts

## Dark Mode

### Enabling Dark Mode

1. Click the **theme toggle** button (sun/moon icon) in the header
2. Choose from:
   - **Light mode** - Bright theme
   - **Dark mode** - Dark theme
   - **System** - Follows your OS preference

### Benefits

- Reduces eye strain in low light
- Saves battery on OLED screens
- Personal preference

Your theme preference is saved automatically.

## Tips and Tricks

### Accuracy Tips

1. **Use high-quality audio**
   - Clear speech improves accuracy
   - Minimize background noise
   - Use good recording equipment

2. **Enable speaker diarization**
   - Helps distinguish between speakers
   - Makes editing easier

3. **Choose appropriate content type**
   - Use AI analysis to identify content type
   - Improves AI correction accuracy

### Editing Workflow

1. **Review while listening**
   - Play each segment while reading
   - Edit as you go

2. **Use AI corrections wisely**
   - Review changes before applying
   - AI isn't perfect - verify critical content

3. **Save frequently**
   - Changes are auto-saved
   - But use `Ctrl+S` for peace of mind

### Performance Tips

1. **Split large files**
   - Files over 2 hours may be slow
   - Split into manageable chunks

2. **Close unused projects**
   - Select one project at a time
   - Reduces memory usage

3. **Use local Ollama for privacy**
   - No data sent to cloud
   - Faster for smaller texts

### Accessibility

The app is designed to be accessible:

- **Keyboard navigation** - Full keyboard support
- **Screen readers** - All content is announced
- **High contrast** - Meets WCAG AA standards
- **Zoom support** - Works at 200% zoom

### Mobile Usage

While optimized for desktop, the app works on mobile:

- Touch-friendly controls
- Responsive layout
- All features available

### Troubleshooting

**Transcription failed:**
- Check audio file format
- Ensure file isn't corrupted
- Try a smaller file first

**AI features not working:**
- Check provider status in Settings
- For Ollama: ensure it's running locally
- For OpenRouter: verify API key

**Poor transcription quality:**
- Use higher quality audio
- Reduce background noise
- Try different Whisper model size (in settings)

**Export not working:**
- Check browser allows downloads
- Try different export format
- Ensure transcription is complete

## Getting Help

### Keyboard Shortcuts Reference

Press **`?`** anytime to see all shortcuts.

### Documentation

- [Design System](/docs/development/DESIGN_SYSTEM.md)
- [Accessibility Guide](/docs/development/ACCESSIBILITY.md)
- [Keyboard Shortcuts](/docs/development/KEYBOARD_SHORTCUTS.md)

### Support

For issues or questions:
1. Check this guide
2. Review documentation
3. Report bugs on GitHub

## Privacy and Data

- **Local processing** - Transcription happens on your server
- **Ollama** - Runs locally, no data sent to cloud
- **OpenRouter** - Sends text to cloud (if used)
- **Your data** - Stored in your database

Choose Ollama for maximum privacy.
