import { useState } from 'react'
import { API_BASE_URL } from '../../api/client'

interface ProjectExportDialogProps {
  projectId: number | null
  projectName: string
  onClose: () => void
}

export default function ProjectExportDialog({ projectId, projectName, onClose }: ProjectExportDialogProps) {
  const [useEdited, setUseEdited] = useState(true)
  const [includeSpeakers, setIncludeSpeakers] = useState(true)
  const [includeTimestamps, setIncludeTimestamps] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const apiBaseUrl = API_BASE_URL

  const buildExportUrl = (format: string): string => {
    const params = new URLSearchParams({
      use_edited: useEdited.toString(),
      include_speakers: includeSpeakers.toString(),
    })

    if (format === 'html' || format === 'txt') {
      params.append('include_timestamps', includeTimestamps.toString())
    }

    return `${apiBaseUrl}/api/export/project/${projectId}/${format}?${params.toString()}`
  }

  const handleExport = async (format: string) => {
    if (!projectId) return

    setIsExporting(true)
    try {
      const url = buildExportUrl(format)

      // Trigger download by opening URL
      const link = document.createElement('a')
      link.href = url
      link.download = '' // Let the server set the filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!projectId) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg border border-border max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Export Project</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">{projectName}</p>
            <p>Export all files and segments from this project as a single document.</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useEdited}
                onChange={(e) => setUseEdited(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Use edited text (if available)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={includeSpeakers}
                onChange={(e) => setIncludeSpeakers(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Include speaker names</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Include timestamps</span>
              <span className="text-xs text-muted-foreground">(HTML/TXT only)</span>
            </label>
          </div>

          {/* Format Buttons */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Choose Format</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleExport('srt')}
                disabled={isExporting}
                className="p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <div className="font-medium">SRT Subtitles</div>
                <div className="text-xs text-muted-foreground">Standard subtitle format with timestamps</div>
              </button>

              <button
                onClick={() => handleExport('html')}
                disabled={isExporting}
                className="p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <div className="font-medium">HTML Document</div>
                <div className="text-xs text-muted-foreground">Formatted document with styles and metadata</div>
              </button>

              <button
                onClick={() => handleExport('txt')}
                disabled={isExporting}
                className="p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <div className="font-medium">Plain Text</div>
                <div className="text-xs text-muted-foreground">Simple text format with optional timestamps</div>
              </button>
            </div>
          </div>

          {isExporting && (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">Preparing export...</div>
            </div>
          )}
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