import { useEffect } from 'react'
import { useTranscriptionStatus } from '../../hooks/useTranscription'

interface TranscriptionProgressProps {
  fileId: number
  onStatusChange?: (status: string) => void
}

export default function TranscriptionProgress({ fileId, onStatusChange }: TranscriptionProgressProps) {
  // Always pass poll interval - the hook handles stopping when not processing
  const { data: status, isLoading } = useTranscriptionStatus(fileId, 2000)

  useEffect(() => {
    if (status) {
      onStatusChange?.(status.status)
    }
  }, [status?.status, onStatusChange])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!status) return null

  const progressPercent = Math.round(status.progress * 100)

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          Transcription Status
        </h3>
        <span
          className={`
            px-3 py-1 rounded-full text-sm font-medium
            ${
              status.status === 'completed'
                ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200'
                : status.status === 'processing'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200'
                : status.status === 'failed'
                ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200'
                : 'bg-muted text-muted-foreground'
            }
          `}
        >
          {status.status}
        </span>
      </div>

      {status.status === 'processing' && (
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {progressPercent}% complete
          </p>
        </div>
      )}

      {status.status === 'completed' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <span className="text-2xl">✓</span>
            <span className="font-medium">Transcription complete!</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>{status.segment_count} segments created</p>
            {status.duration && (
              <p>Duration: {Math.floor(status.duration / 60)}m {Math.floor(status.duration % 60)}s</p>
            )}
          </div>
        </div>
      )}

      {status.status === 'failed' && status.error_message && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{status.error_message}</p>
        </div>
      )}
    </div>
  )
}
