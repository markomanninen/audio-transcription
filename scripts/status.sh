#!/bin/bash
# Cross-platform transcription monitor wrapper (Unix/Linux/macOS)

# Check if Python is available
if command -v python3 &> /dev/null; then
    PYTHON="python3"
elif command -v python &> /dev/null; then
    PYTHON="python"
else
    echo "❌ Error: Python not found. Please install Python 3.x"
    exit 1
fi

# Run the status script with any arguments passed
$PYTHON status.py "$@"