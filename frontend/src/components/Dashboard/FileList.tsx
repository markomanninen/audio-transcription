import { useEffect } from 'react'
import { useProjectFiles } from '../../hooks/useUpload'
import { useStartTranscription } from '../../hooks/useTranscription'
import type { AudioFile } from '../../types'

interface FileListProps {
  projectId: number
  onSelectFile?: (fileId: number) => void
  selectedFileId?: number
}

export default function FileList({ projectId, onSelectFile, selectedFileId }: FileListProps) {
  const { data: files, isLoading, error, refetch } = useProjectFiles(projectId)
  const startTranscription = useStartTranscription()

  // Refresh file list every 3 seconds only if there are processing files
  useEffect(() => {
    const hasProcessing = files?.some(f => f.status === 'processing' || f.status === 'pending')

    if (!hasProcessing) return

    const interval = setInterval(() => {
      refetch()
    }, 3000)
    return () => clearInterval(interval)
  }, [refetch, files])

  const handleTranscribe = (fileId: number) => {
    startTranscription.mutate({ fileId, includeDiarization: true })
  }

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: AudioFile['status']): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200'
      case 'processing':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200'
      case 'failed':
        return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200">Error loading files</p>
      </div>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>No audio files uploaded yet.</p>
        <p className="text-sm mt-2">Upload your first file to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div
          key={file.file_id}
          className={`
            border rounded-lg p-4 transition-all cursor-pointer bg-card
            ${
              selectedFileId === file.file_id
                ? 'border-primary-500 ring-2 ring-primary-500/20'
                : 'border-border hover:border-primary-300'
            }
          `}
          onClick={() => onSelectFile?.(file.file_id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">
                {file.original_filename}
              </h4>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>{formatFileSize(file.file_size)}</span>
                <span>{formatDuration(file.duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-4">
              <span
                className={`
                  px-3 py-1 rounded-full text-xs font-medium
                  ${getStatusColor(file.status)}
                `}
              >
                {file.status}
              </span>

              {file.status === 'pending' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTranscribe(file.file_id)
                  }}
                  disabled={startTranscription.isPending}
                  className="
                    px-4 py-2 bg-primary-600 text-white text-sm rounded-lg
                    hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                  "
                >
                  Transcribe
                </button>
              )}

              {file.status === 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectFile?.(file.file_id)
                  }}
                  className="
                    px-4 py-2 bg-green-600 text-white text-sm rounded-lg
                    hover:bg-green-700 transition-colors
                  "
                >
                  View
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
