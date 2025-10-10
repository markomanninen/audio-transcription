import React from 'react'
import { useStartTranscription } from '../../hooks/useTranscription'
import { useProjectFiles } from '../../hooks/useUpload'
import { useForceRestart } from '../../hooks/useEnhancedTranscription'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, API_BASE_URL } from '../../api/client'
import { TranscriptionSettingsModal, TranscriptionSettings } from './TranscriptionSettingsModal'
import { getStatusBadgeColors } from '../../utils/statusColors'

interface FileListProps {
  projectId: number
  onSelectFile?: (fileId: number | null) => void
  selectedFileId?: number
}

interface ActionInProgress {
  fileId: number
  action: string
}

export function FileList({ projectId, onSelectFile, selectedFileId }: FileListProps) {
  const { data: files, isLoading, error } = useProjectFiles(projectId)
  const startTranscription = useStartTranscription()
  const forceRestart = useForceRestart()
  const queryClient = useQueryClient()
  const [actionInProgress, setActionInProgress] = React.useState<ActionInProgress | null>(null)
  const [showTranscriptionModal, setShowTranscriptionModal] = React.useState<{
    fileId: number
    fileName: string
  } | null>(null)

  // Delete file mutation
  const deleteFile = useMutation({
    mutationFn: async (fileId: number) => {
      console.log('Attempting to delete file:', fileId)
      const response = await apiClient.delete(`/api/upload/files/${fileId}`)
      console.log('Delete response:', response)
      return response.data
    },
    onSuccess: () => {
      console.log('Delete successful, invalidating queries')
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-files'] })
    },
    onError: (error) => {
      console.error('Delete error details:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
      }
    },
  })

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

  const handleTranscribe = async (fileId: number, fileName: string) => {
    console.log('handleTranscribe called with:', fileId, fileName)
    setShowTranscriptionModal({ fileId, fileName })
    console.log('showTranscriptionModal set to:', { fileId, fileName })
  }

  const handleStartTranscription = async (settings: TranscriptionSettings) => {
    console.log('handleStartTranscription called with:', settings, 'modal state:', showTranscriptionModal)
    if (!showTranscriptionModal) {
      console.log('No modal state, exiting early')
      return
    }
    
    console.log('Setting action in progress...')
    setActionInProgress({ 
      fileId: showTranscriptionModal.fileId, 
      action: 'Starting transcription' 
    })
    
    console.log('Starting try block for API call...')
    try {
      // Save the last used settings for future transcriptions
      localStorage.setItem('lastUsedTranscriptionSettings', JSON.stringify(settings))
      
      // Call the API with the selected settings
      const url = `${API_BASE_URL}/api/transcription/${showTranscriptionModal.fileId}/start`
      console.log(`Making API call to: ${url}`)
      console.log('Request body:', JSON.stringify(settings))
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      console.log('API response status:', response.status, 'ok:', response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API error response:', errorText)
        throw new Error(`Failed to start transcription: ${response.status} ${errorText}`)
      }
      
      const result = await response.json()
      console.log('API success response:', result)
      
      console.log('Transcription started successfully, closing modal IMMEDIATELY...')
      // Close modal and clear loading state simultaneously
      setShowTranscriptionModal(null)
      setActionInProgress(null)
      
      // Auto-select the file to show progress
      console.log('Auto-selecting file:', showTranscriptionModal.fileId)
      onSelectFile?.(showTranscriptionModal.fileId)
      
      // Immediate invalidation of all relevant queries to refresh the UI with v3 cache keys
      console.log('Invalidating queries for UI refresh')
      queryClient.invalidateQueries({ queryKey: ['project-files'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['transcription-status', showTranscriptionModal.fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['segments', showTranscriptionModal.fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['speakers', showTranscriptionModal.fileId, 'v3'] })
      
      // Force additional refetch after short delay to catch status change with v3 keys
      setTimeout(() => {
        console.log('Force refetching after transcription start from FileList...')
        queryClient.refetchQueries({ queryKey: ['transcription-status', showTranscriptionModal.fileId, 'v3'] })
      }, 1000)

      setTimeout(() => {
        console.log('Second force refetch after transcription start from FileList...')
        queryClient.refetchQueries({ queryKey: ['transcription-status', showTranscriptionModal.fileId, 'v3'] })
      }, 3000)
      
      console.log('Transcription start completed successfully')
    } catch (error) {
      console.error('Failed to start transcription:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to start transcription: ${errorMessage}`)
      
      // Force close modal even on error
      console.log('Closing modal due to error')
      setShowTranscriptionModal(null)
      setActionInProgress(null)
    } finally {
      // Ensure action state is cleared and modal is closed (defensive programming)
      setActionInProgress(null)
      setShowTranscriptionModal(null)
      console.log('handleStartTranscription completed - modal should be closed')
    }
  }

  const handleRestart = async (fileId: number) => {
    setActionInProgress({ fileId, action: 'Restarting' })
    try {
      await forceRestart.mutateAsync(fileId)
    } catch (error) {
      console.error('Failed to restart:', error)
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
      await deleteFile.mutateAsync(fileId)
      // If the deleted file was selected, clear the selection
      if (selectedFileId === fileId) {
        onSelectFile?.(null)
      }
    } catch (error: any) {
      console.error('Error deleting file:', error)
      const errorMessage = error?.response?.data?.detail || error?.message || 'Unknown error occurred'
      alert(`Failed to delete file: ${errorMessage}`)
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
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
          {error instanceof Error ? error.message : String(error)}
        </p>
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
    <>
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
                  ⏱️ {formatDuration(file.duration || 0)}
                </span>
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
                    onSelectFile?.(file.file_id)
                  }}
                  className="
                    px-6 py-2 bg-red-600 text-white text-sm font-medium rounded-lg
                    hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500
                  "
                >
                  📋 View Details
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

              {/* No secondary actions for failed files - use details panel instead */}

              {file.status === 'processing' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRestart(file.file_id)
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
      </div>

      {/* Transcription Settings Modal */}
      <TranscriptionSettingsModal
        isOpen={!!showTranscriptionModal}
        onClose={() => setShowTranscriptionModal(null)}
        onStartTranscription={handleStartTranscription}
        fileId={showTranscriptionModal?.fileId || null}
        fileName={showTranscriptionModal?.fileName || ""}
        isLoading={actionInProgress?.action === 'Starting transcription'}
      />
    </>
  )
}
