#!/bin/bash

# Run the "Open in Editor" integration test for audio → text editor workflow
# This test requires an existing audio project with transcription segments

echo "🧪 Running Audio → Text Editor Integration Test"
echo "================================================"
echo ""
echo "Prerequisites:"
echo "  ✅ Frontend running on http://localhost:5173 (npm run dev)"
echo "  ✅ Backend running on http://localhost:8000"
echo "  📝 At least one audio project with completed transcription"
echo ""
echo "Quick setup: See setup-test-data.md if test skips"
echo ""

cd "$(dirname "$0")"

# Run the specific test (uses local dev ports by default)
npx playwright test ai-text-editor.spec.ts -g "should open transcription segments in text editor"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Test completed!"
else
  echo "⚠️  Test skipped or failed"
  echo ""
  echo "If test skipped due to 'No audio files found':"
  echo "  1. Open http://localhost:5173/audio"
  echo "  2. Select 'test' project from dropdown"
  echo "  3. Verify 'Kaaritorpantie - Rainer 4min.mp3' has transcription"
  echo "  4. Run this script again"
  echo ""
  echo "See setup-test-data.md for detailed instructions"
fi

exit $EXIT_CODE
