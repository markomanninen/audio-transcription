import { useState } from 'react'

interface ExportDialogProps {
  fileId: number
  filename: string
  onClose: () => void
}

export default function ExportDialog({ fileId, filename, onClose }: ExportDialogProps) {
  const [useEdited, setUseEdited] = useState(true)
  const [includeSpeakers, setIncludeSpeakers] = useState(true)
  const [includeTimestamps, setIncludeTimestamps] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

  const buildExportUrl = (format: string): string => {
    const params = new URLSearchParams({
      use_edited: useEdited.toString(),
      include_speakers: includeSpeakers.toString(),
    })

    if (format === 'html' || format === 'txt') {
      params.append('include_timestamps', includeTimestamps.toString())
    }

    return `${apiBaseUrl}/api/export/${fileId}/${format}?${params.toString()}`
  }

  const handleExport = async (format: string) => {
    setIsExporting(true)
    try {
      const url = buildExportUrl(format)

      // Trigger download by opening URL
      window.open(url, '_blank')
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Export Transcription</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File info */}
          <div className="text-sm">
            <strong>File:</strong> {filename}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <h3 className="font-medium">Export Options</h3>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useEdited}
                onChange={(e) => setUseEdited(e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-ring"
              />
              <span className="text-sm">Use edited text (if available)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSpeakers}
                onChange={(e) => setIncludeSpeakers(e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-ring"
              />
              <span className="text-sm">Include speaker names</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-ring"
              />
              <span className="text-sm">Include timestamps (HTML/TXT)</span>
            </label>
          </div>

          {/* Export Buttons */}
          <div className="space-y-2">
            <h3 className="font-medium">Select Format</h3>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleExport('srt')}
                disabled={isExporting}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-left"
              >
                <div className="font-medium">SRT Subtitles</div>
                <div className="text-xs opacity-90">Standard subtitle format with timestamps</div>
              </button>

              <button
                onClick={() => handleExport('html')}
                disabled={isExporting}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-left"
              >
                <div className="font-medium">HTML Document</div>
                <div className="text-xs opacity-90">Formatted web page with styling</div>
              </button>

              <button
                onClick={() => handleExport('txt')}
                disabled={isExporting}
                className="w-full px-4 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors text-left"
              >
                <div className="font-medium">Plain Text</div>
                <div className="text-xs opacity-90">Simple text file</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
