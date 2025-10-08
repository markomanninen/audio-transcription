import React from 'react'
import { useStartTranscription } from '../../hooks/useTranscription'
import { TranscriptionSettingsModal, TranscriptionSettings } from './TranscriptionSettingsModal'
import { getStatusBadgeColors } from '../../utils/statusColors'

interface File {
  file_id: number
  filename: string
  original_filename: string
  file_size: number
  duration: number
  status: string
  created_at?: string
  updated_at?: string
  transcription_started_at?: string
  transcription_completed_at?: string
}

interface FileListProps {
  files?: File[]
  onSelectFile?: (fileId: number) => void
  selectedFileId?: number
  isLoading?: boolean
  error?: string
}

interface ActionInProgress {
  fileId: number
  action: string
}

export function FileList({ files, onSelectFile, selectedFileId, isLoading, error }: FileListProps) {
  const startTranscription = useStartTranscription()
  const [actionInProgress, setActionInProgress] = React.useState<ActionInProgress | null>(null)
  const [showTranscriptionModal, setShowTranscriptionModal] = React.useState<{
    fileId: number
    fileName: string
  } | null>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDateTime = (dateString: string | undefined): string => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } catch {
      return ''
    }
  }

  const getProcessingDuration = (startTime: string | undefined): string => {
    if (!startTime) return ''
    try {
      const start = new Date(startTime)
      const now = new Date()
      const diffMs = now.getTime() - start.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      
      if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m`
      } else {
        return `${diffMins}m`
      }
    } catch {
      return ''
    }
  }

  const handleTranscribe = async (fileId: number, fileName: string) => {
    setShowTranscriptionModal({ fileId, fileName })
  }

  const handleStartTranscription = async (settings: TranscriptionSettings) => {
    if (!showTranscriptionModal) return
    
    setActionInProgress({ 
      fileId: showTranscriptionModal.fileId, 
      action: 'Starting transcription' 
    })
    
    try {
      // Call the API with the selected settings
      const response = await fetch(`/api/transcription/${showTranscriptionModal.fileId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      if (!response.ok) throw new Error('Failed to start transcription')
      
      setShowTranscriptionModal(null)
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error('Failed to start transcription:', error)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleTranscriptionAction = async (fileId: number, action: string, actionLabel: string) => {
    setActionInProgress({ fileId, action: actionLabel })
    try {
      const response = await fetch(`/api/transcription/${fileId}/action?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Action failed')
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error(`Failed to ${action}:`, error)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDeleteFile = async (fileId: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return
    }
    
    setActionInProgress({ fileId, action: 'Deleting' })
    try {
      const response = await fetch(`/api/upload/files/${fileId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete file')
      setTimeout(() => window.location.reload(), 500)
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Failed to delete file. Please try again.')
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading files...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600 dark:text-red-400 mb-4">⚠️</div>
        <p className="text-red-600 dark:text-red-400 font-medium">Unable to load files</p>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="text-center p-8 text-gray-600 dark:text-gray-400">
        <div className="text-4xl mb-4">📄</div>
        <p className="text-lg font-medium">No audio files uploaded yet</p>
        <p className="text-sm mt-2">Upload your first file to get started with transcription.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div
          key={file.file_id}
          className={`
            bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
            rounded-xl p-6 transition-all duration-200 hover:shadow-md cursor-pointer
            ${
              selectedFileId === file.file_id
                ? 'ring-2 ring-blue-500 border-blue-500'
                : 'hover:border-gray-300 dark:hover:border-gray-600'
            }
          `}
          onClick={() => onSelectFile?.(file.file_id)}
        >
          {/* Header Row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {file.original_filename}
              </h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  📄 {formatFileSize(file.file_size)}
                </span>
                <span className="flex items-center gap-1">
                  ⏱️ {formatDuration(file.duration)}
                </span>
                {file.status === 'completed' && file.transcription_completed_at && (
                  <span className="flex items-center gap-1">
                    🏁 {formatDateTime(file.transcription_completed_at)}
                  </span>
                )}
                {file.status === 'processing' && file.transcription_started_at && (
                  <span className="flex items-center gap-1">
                    🚀 {getProcessingDuration(file.transcription_started_at)} ago
                  </span>
                )}
                {file.status === 'pending' && file.created_at && (
                  <span className="flex items-center gap-1">
                    📅 {formatDateTime(file.created_at)}
                  </span>
                )}
              </div>
            </div>
            
            {/* Delete Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteFile(file.file_id, file.original_filename)
                }}
                disabled={actionInProgress?.fileId === file.file_id}
                className="
                  p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 
                  dark:hover:bg-red-900/20 rounded-lg transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                title="Delete file"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Primary Action Button */}
              {file.status === 'pending' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTranscribe(file.file_id, file.original_filename)
                  }}
                  disabled={startTranscription.isPending || actionInProgress?.fileId === file.file_id}
                  className="
                    px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                    hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                  "
                >
                  {actionInProgress?.fileId === file.file_id ? 'Starting...' : '▶️ Start Transcription'}
                </button>
              )}

              {file.status === 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectFile?.(file.file_id)
                  }}
                  className="
                    px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
                    hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500
                  "
                >
                  📋 View Transcription
                </button>
              )}

              {file.status === 'failed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTranscriptionAction(file.file_id, 'restart', 'Retry')
                  }}
                  disabled={actionInProgress?.fileId === file.file_id}
                  className="
                    px-6 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg
                    hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500
                  "
                >
                  {actionInProgress?.fileId === file.file_id ? 'Retrying...' : '🔄 Retry'}
                </button>
              )}
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center gap-2">
              {/* Status Badge */}
              <span
                className={`
                  px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide
                  ${getStatusBadgeColors(file.status)}
                `}
              >
                {file.status}
              </span>

              {(file.status === 'completed' || file.status === 'failed') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTranscriptionAction(file.file_id, 'restart', 'Restart')
                  }}
                  disabled={actionInProgress?.fileId === file.file_id}
                  className="
                    px-3 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 
                    dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 
                    dark:hover:bg-gray-700 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  title="Start over"
                >
                  🔄
                </button>
              )}

              {file.status === 'processing' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTranscriptionAction(file.file_id, 'restart', 'Force Restart')
                  }}
                  disabled={actionInProgress?.fileId === file.file_id}
                  className="
                    px-3 py-2 text-orange-600 dark:text-orange-400 border border-orange-300 
                    dark:border-orange-600 text-sm rounded-lg hover:bg-orange-50 
                    dark:hover:bg-orange-900/20 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  title="Force restart"
                >
                  ⚡
                </button>
              )}

              {(file.status === 'pending' || file.status === 'failed') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTranscriptionAction(file.file_id, 'resume', 'Resume')
                  }}
                  disabled={actionInProgress?.fileId === file.file_id}
                  className="
                    px-3 py-2 text-blue-600 dark:text-blue-400 border border-blue-300 
                    dark:border-blue-600 text-sm rounded-lg hover:bg-blue-50 
                    dark:hover:bg-blue-900/20 transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  title="Resume from where it left off"
                >
                  ▶️
                </button>
              )}
            </div>
          </div>

          {/* Action Progress Indicator */}
          {actionInProgress?.fileId === file.file_id && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                {actionInProgress.action}...
              </div>
            </div>
          )}
        </div>
      ))}
      
      {/* Transcription Settings Modal */}
      {showTranscriptionModal && (
        <TranscriptionSettingsModal
          isOpen={true}
          onClose={() => setShowTranscriptionModal(null)}
          onStartTranscription={handleStartTranscription}
          fileId={showTranscriptionModal.fileId}
          fileName={showTranscriptionModal.fileName}
          isLoading={actionInProgress?.fileId === showTranscriptionModal.fileId}
        />
      )}
    </div>
  )
}