import { useEffect, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranscriptionStatus, useCancelTranscription, useClearTranscription } from '../../hooks/useTranscription'
import { useSystemHealth } from '../../hooks/useSystemHealth'
import { getStatusBadgeColors } from '../../utils/statusColors'
import { API_BASE_URL } from '../../api/client'

// Utility functions
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

interface TranscriptionProgressProps {
  fileId: number
  projectName?: string
  onStatusChange?: (status: string) => void
  onRestartRequested?: (fileId: number) => void
}

// Enhanced transcription actions
const transcriptionActions = {
  async startTranscription(fileId: number) {
    const response = await fetch(`${API_BASE_URL}/api/transcription/${fileId}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        include_diarization: true,
        model_size: 'tiny',
        language: null  // null for auto-detection
      })
    })
    
    // Handle different response codes
    if (response.status === 202) {
      // Queued for processing - this is success
      return response.json()
    }
    
    if (response.status === 200) {
      // Direct start - this is also success
      return response.json()
    }
    
    // Only throw error for actual error status codes (4xx, 5xx)
    if (response.status >= 400) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || 'Failed to start transcription')
    }
    
    // For any other status codes, try to return the response
    return response.json()
  },

  async smartAction(fileId: number, action: string = 'auto') {
    const response = await fetch(`${API_BASE_URL}/api/transcription/${fileId}/action?action=${action}`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to execute action')
    return response.json()
  },

  async getDetailedStatus(fileId: number) {
    const response = await fetch(`${API_BASE_URL}/api/transcription/${fileId}/status`)
    if (!response.ok) throw new Error('Failed to get status')
    return response.json()
  },

  async forceRestart(fileId: number) {
    const response = await fetch(`${API_BASE_URL}/api/transcription/${fileId}/action?action=restart`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to restart')
    return response.json()
  },

  async resume(fileId: number) {
    const response = await fetch(`${API_BASE_URL}/api/transcription/${fileId}/action?action=resume`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to resume')
    return response.json()
  }
}

export default function TranscriptionProgress({ fileId, projectName, onStatusChange, onRestartRequested }: TranscriptionProgressProps) {
  // Always pass poll interval - the hook handles stopping when not processing
  const { data: status, isLoading, refetch } = useTranscriptionStatus(fileId, 2000)

  const queryClient = useQueryClient()
  const systemHealth = useSystemHealth()
  const cancelTranscription = useCancelTranscription()
  const clearTranscription = useClearTranscription()
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const prevFileId = useRef<number | null>(null)

  // Detect file ID changes and clear cache for previous file
  useEffect(() => {
    const previousFileId = prevFileId.current

    if (previousFileId !== null && previousFileId !== fileId) {
      // File ID changed - clear cache for previous file
      if (import.meta.env.DEV) {
        console.log(`[TranscriptionProgress] File ID changed from ${previousFileId} to ${fileId} - clearing cache`)
      }

      // Remove stale queries for previous file with v3 keys
      queryClient.removeQueries({ queryKey: ['transcription-status', previousFileId, 'v3'] })
      queryClient.removeQueries({ queryKey: ['segments', previousFileId, 'v3'] })
      queryClient.removeQueries({ queryKey: ['speakers', previousFileId, 'v3'] })

      // Clear any cached state for previous file
      setActionInProgress(null)

      // Debounce refetch to prevent rapid fire during batch processing auto-selection
      const timer = setTimeout(() => {
        refetch()
        console.log(`[TranscriptionProgress] Delayed refetch for new file ${fileId}`)
      }, 200) // 200ms delay to prevent rapid fire refetches

      return () => clearTimeout(timer)
    }

    prevFileId.current = fileId
  }, [fileId, queryClient, refetch])

  // Helper function to format datetime
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

  const formatSecondsRange = (start?: number | null, end?: number | null): string | null => {
    if (start == null || end == null) return null
    const format = (value: number) => {
      const mins = Math.floor(value / 60)
      const secs = Math.floor(value % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return `${format(start)} → ${format(end)}`
  }

  const splitTimeRange = formatSecondsRange(status?.split_start_seconds, status?.split_end_seconds)

  useEffect(() => {
    if (status) {
      onStatusChange?.(status.status)
      // Status data from the hook is now used directly, no need to set detailedStatus
    }
  }, [status, onStatusChange])

  useEffect(() => {
    if (status?.status === 'completed') {
      // Debounce completion handling to prevent flickering during batch processing
      const timer = setTimeout(() => {
        queryClient.setQueriesData({ queryKey: ['files'], exact: false }, (data: unknown) => {
          if (!Array.isArray(data)) {
            return data
          }
          return data.map((file: Record<string, unknown>) =>
            file.file_id === status.file_id
              ? { ...file, status: 'completed', transcription_completed_at: status.transcription_completed_at }
              : file
          )
        })
        
        // Don't invalidate files query immediately during batch processing
        // This prevents cascading re-renders and flickering
        console.log(`[TranscriptionProgress] File ${status.file_id} completion handled with stabilization`)
      }, 800) // 800ms delay for completion stabilization

      return () => clearTimeout(timer)
    }
  }, [status?.status, status?.file_id, status?.transcription_completed_at, queryClient])



  const handleCancel = async () => {
    if (fileId && status?.status === 'processing') {
      try {
        await cancelTranscription.mutateAsync(fileId)
      } catch (error) {
        console.error('Failed to cancel transcription:', error)
      }
    }
  }

  const handleClear = async () => {
    if (fileId && window.confirm('Are you sure you want to clear all transcription data? This cannot be undone.')) {
      try {
        setActionInProgress('Clearing')
        await clearTranscription.mutateAsync(fileId)
        
        // Force immediate refetch and cache cleanup after clear
        setTimeout(() => {
          refetch()
          
          // Invalidate all related queries for comprehensive refresh with v3 keys
          queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
          queryClient.invalidateQueries({ queryKey: ['speakers', fileId] })
          queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
          queryClient.invalidateQueries({ queryKey: ['files'], exact: false })
        }, 500)
        
      } catch (error) {
        console.error('Failed to clear transcription:', error)
        alert('Failed to clear transcription. Please try again.')
      } finally {
        setActionInProgress(null)
      }
    }
  }

  const handleAction = async (action: string, actionName: string) => {
    setActionInProgress(actionName)
    try {
      let result
      switch (action) {
        case 'start':
          result = await transcriptionActions.startTranscription(fileId)
          break
        case 'restart':
          result = await transcriptionActions.forceRestart(fileId)
          break
        case 'resume':
          result = await transcriptionActions.resume(fileId)
          break
        case 'auto':
        case 'continue':
          result = await transcriptionActions.smartAction(fileId, action)
          break
        default:
          throw new Error(`Unknown action: ${action}`)
      }
      
      console.log(`${actionName} result:`, result)
      
      // Show success message for queued transcriptions
      if (result.status === 'queued') {
        // Don't show an alert for queued transcriptions - they're handled by the UI
        console.log('Transcription queued successfully:', result.message)
      }
      
      // Refresh status after action and invalidate all related queries
      setTimeout(() => {
        refetch()
        // Use the refetched data from the hook instead of making another API call
        // setDetailedStatus will be updated automatically via the hook

        // Invalidate all related queries for comprehensive refresh with v3 keys
        queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['speakers', fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['files'], exact: false })
      }, 1000)
      
    } catch (error) {
      console.error(`Failed to ${actionName.toLowerCase()}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Don't show alerts for 202-related "errors" (these are actually success cases)
      if (!errorMessage.includes('202') && !errorMessage.includes('Whisper model')) {
        alert(`Failed to ${actionName.toLowerCase()}: ${errorMessage}`)
      } else {
        console.log('Transcription queued (interpreted as error but is actually success):', errorMessage)
      }
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!status) return null

  // Check if Whisper AI model is still loading
  const whisperStatus = systemHealth.data?.components?.whisper
  const whisperStatusValue = whisperStatus?.status
  const whisperProgress =
    typeof whisperStatus?.progress === 'number' ? whisperStatus.progress : undefined

  const isWhisperReady =
    whisperStatusValue === 'up' ||
    whisperStatusValue === 'processing' ||
    whisperStatusValue === 'idle' ||
    (whisperStatusValue === 'downloading' && whisperProgress === 100)

  // Show simple "Ready to transcribe" state for files that haven't been started
  const isFileNotStarted = status.status === 'pending' && !status.transcription_started_at
  
  // Check if model is cached and ready (enhanced status)
  const isModelCachedReady = status.processing_stage === 'model_ready_to_load' || 
                            (status.error_message && status.error_message.includes('cached and ready'))
  

  
  // Check if Whisper model is loading or downloading
  const isWhisperModelLoading = systemHealth.data?.components?.whisper?.status === 'loading'
  const isWhisperModelDownloading = systemHealth.data?.components?.whisper?.status === 'downloading'
  const whisperDownloadProgress = systemHealth.data?.components?.whisper?.progress
  
  // If this file is not started and model is not processing, show ready state
  if (isFileNotStarted) {
    // If model is cached and ready, show cache-ready state
    if (isModelCachedReady) {
      return (
        <div
          className="bg-card rounded-lg shadow-sm border border-border p-6"
          data-component="transcription-progress"
          data-file-id={fileId}
          data-status="cache-ready"
          data-progress={0}
          data-testid={`transcription-progress-${fileId}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {projectName ? `${projectName} - ${status.original_filename || status.filename}` : `Audio File - ${status.original_filename || status.filename}`}
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide bg-emerald-100 text-emerald-800">
              Ready to Start
            </span>
          </div>
          
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-4 h-4 bg-emerald-500 rounded-full"></div>
              <span className="text-emerald-800 dark:text-emerald-200 font-medium">
                AI model is cached and ready
              </span>
            </div>
            
            <p className="text-emerald-700 dark:text-emerald-300 text-sm">
              Click "🚀 Start (Model Cached)" in the file list to begin transcription.
            </p>
            
            <div className="mt-4 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
              <div>Duration: {formatDuration(status.duration || 0)}</div>
              {status.file_size && (
                <div>📄 {(status.file_size / 1024 / 1024).toFixed(2)} MB</div>
              )}
              {status.split_start_seconds !== null && status.split_end_seconds !== null && (
                <div>Original time range: {formatTime(status.split_start_seconds || 0)} → {formatTime(status.split_end_seconds || 0)}</div>
              )}
            </div>
          </div>
        </div>
      )
    }
    
    // If model is downloading, show download progress
    if (isWhisperModelDownloading) {
      return (
        <div
          className="bg-card rounded-lg shadow-sm border border-border p-6"
          data-component="transcription-progress"
          data-file-id={fileId}
          data-status="model-downloading"
          data-progress={0}
          data-testid={`transcription-progress-${fileId}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {projectName ? `${projectName} - ${status.original_filename || status.filename}` : `Audio File - ${status.original_filename || status.filename}`}
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide bg-indigo-100 text-indigo-800">
              Downloading Model
            </span>
          </div>
          
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-indigo-800 dark:text-indigo-200 font-medium">
                  Downloading {systemHealth.data?.components?.whisper?.model_size || 'Whisper'} model
                </span>
              </div>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                {whisperDownloadProgress || 0}%
              </span>
            </div>

            {whisperDownloadProgress && whisperDownloadProgress > 0 && (
              <div className="mb-3">
                <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(whisperDownloadProgress, 100)}%` }}
                  />
                </div>
                {systemHealth.data?.components?.whisper?.downloaded && systemHealth.data?.components?.whisper?.total && (
                  <div className="flex justify-between text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    <span>{systemHealth.data.components.whisper.downloaded} / {systemHealth.data.components.whisper.total}</span>
                    <span>{systemHealth.data.components.whisper.speed}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-indigo-700 dark:text-indigo-300 text-sm">
              Transcription will start automatically when download completes.
            </p>

            {(status.file_size || status.duration) && (
              <div className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 space-x-4">
                {status.file_size && (
                  <span>
                    📄 {(status.file_size / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
                {status.duration && (
                  <span>
                    ⏱️ {Math.floor(status.duration / 60)}m {Math.floor(status.duration % 60)}s
                  </span>
                )}
              </div>
            )}

            {(status.split_label || splitTimeRange || status.split_origin_filename) && (
              <div className="mt-3 text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
                {status.split_label && (
                  <div>
                    Chunk {status.split_label}
                    {status.split_total_chunks ? ` of ${status.split_total_chunks}` : ''}
                  </div>
                )}
                {splitTimeRange && <div>Original time range: {splitTimeRange}</div>}
                {status.split_origin_filename && <div>Source file: {status.split_origin_filename}</div>}
              </div>
            )}
          </div>
        </div>
      )
    }
    
    // If model is loading, show model loading state instead of ready state
    if (isWhisperModelLoading) {
      return (
        <div
          className="bg-card rounded-lg shadow-sm border border-border p-6"
          data-component="transcription-progress"
          data-file-id={fileId}
          data-status="model-loading"
          data-progress={0}
          data-testid={`transcription-progress-${fileId}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {projectName ? `${projectName} - ${status.original_filename || status.filename}` : `Audio File - ${status.original_filename || status.filename}`}
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide bg-purple-100 text-purple-800">
              Model Loading
            </span>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
              <span className="text-purple-800 dark:text-purple-200 font-medium">
                Loading Whisper AI model into memory...
              </span>
            </div>
            
            <p className="text-purple-700 dark:text-purple-300 text-sm">
              The transcription engine is preparing. Transcription will be available once the model loads.
            </p>

            <div className="mt-3 text-xs text-purple-600 dark:text-purple-400 space-y-1">
              {status.duration && <div>⏱️ {Math.floor(status.duration / 60)}m {Math.floor(status.duration % 60)}s</div>}
              {status.file_size && <div>📄 {(status.file_size / 1024 / 1024).toFixed(2)} MB</div>}
            </div>

            {(status.split_label || splitTimeRange || status.split_origin_filename) && (
              <div className="mt-3 text-xs text-purple-700 dark:text-purple-300 space-y-1">
                {status.split_label && (
                  <div>
                    Chunk {status.split_label}
                    {status.split_total_chunks ? ` of ${status.split_total_chunks}` : ''}
                  </div>
                )}
                {splitTimeRange && <div>Original time range: {splitTimeRange}</div>}
                {status.split_origin_filename && <div>Source file: {status.split_origin_filename}</div>}
              </div>
            )}
          </div>
        </div>
      )
    }
    
    return (
      <div
        className="bg-card rounded-lg shadow-sm border border-border p-6"
        data-component="transcription-progress"
        data-file-id={fileId}
        data-status="ready"
        data-progress={0}
        data-testid={`transcription-progress-${fileId}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {projectName ? `${projectName} - ${status.original_filename || status.filename}` : `Audio File - ${status.original_filename || status.filename}`}
          </h3>
          <span className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide bg-blue-100 text-blue-800">
            Ready to Transcribe
          </span>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-blue-800 dark:text-blue-200 font-medium">
              Audio file uploaded successfully
            </span>
          </div>
          
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Click "Start Transcription" in the file list to begin processing this audio file with Whisper AI.
          </p>

          <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 space-y-1">
            {status.duration && <div>⏱️ {Math.floor(status.duration / 60)}m {Math.floor(status.duration % 60)}s</div>}
            {status.file_size && <div>📄 {(status.file_size / 1024 / 1024).toFixed(2)} MB</div>}
          </div>

          {(status.split_label || splitTimeRange || status.split_origin_filename) && (
            <div className="mt-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
              {status.split_label && (
                <div>
                  Chunk {status.split_label}
                  {status.split_total_chunks ? ` of ${status.split_total_chunks}` : ''}
                </div>
              )}
              {splitTimeRange && <div>Original time range: {splitTimeRange}</div>}
              {status.split_origin_filename && <div>Source file: {status.split_origin_filename}</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  // REMOVED: Separate Whisper loading panel - now part of unified progress bar
  // Model loading is shown as part of the processing state with processing_stage field

  const preciseProgress = Math.max(0, Math.min(100, (status.progress || 0) * 100))
  const progressPercent = Math.round(preciseProgress)
  const progressLabel = preciseProgress.toFixed(preciseProgress < 10 ? 1 : preciseProgress < 100 ? 1 : 0)
  // These properties might not exist in the standard TranscriptionStatus
  const isStuck = false // Not available in consolidated status
  const canResume = false // Not available in consolidated status
  
  // Disable actions if there's an action in progress OR if Whisper is not ready
  const isDisabled = actionInProgress !== null || !isWhisperReady

  // Helper function to clear cache and refresh
  const handleRefresh = () => {
    // Clear React Query cache for this file with v3 keys
    queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
    queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
    queryClient.invalidateQueries({ queryKey: ['speakers', fileId, 'v3'] })
    queryClient.invalidateQueries({ queryKey: ['system-health'] })

    // Force refetch
    refetch()

    if (import.meta.env.DEV) {
      console.log(`[TranscriptionProgress] Cache cleared and status refreshed for file ${fileId}`)
    }
  }





  // Helper function to render action buttons
  const renderActionButtons = () => {
    if (status.status === 'processing') {
      return (
        <div className="flex items-center gap-2">
          {isStuck && (
            <button
              onClick={() => handleAction('restart', 'Force Restart')}
              disabled={isDisabled}
              className="px-3 py-1 text-sm bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-md transition-colors disabled:opacity-50"
              title="Force restart stuck transcription"
            >
              {actionInProgress === 'Force Restart' ? 'Restarting...' : '🔄 Restart'}
            </button>
          )}
          <button
            onClick={handleCancel}
            disabled={cancelTranscription.isPending || isDisabled}
            className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors disabled:opacity-50"
            title="Cancel transcription"
          >
            {cancelTranscription.isPending ? 'Canceling...' : '❌ Cancel'}
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
            title="Refresh status"
          >
            🔄 Refresh
          </button>
        </div>
      )
    }

    if (status.status === 'pending') {
      const isModelReadyToLoad =
        (whisperStatusValue === 'downloading' && whisperProgress === 100) ||
        whisperStatusValue === 'idle'
      const buttonTitle = !isWhisperReady
        ? 'AI model is still loading - please wait'
        : isModelReadyToLoad
          ? 'Start transcription (Whisper will load on demand)'
          : 'Start transcription'
      const buttonText = !isWhisperReady
        ? '⏳ Model Loading...'
        : actionInProgress === 'Start'
          ? 'Starting...'
          : isModelReadyToLoad
            ? '▶️ Start (On-demand)'
            : '▶️ Start'
      
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (onRestartRequested) {
                onRestartRequested(fileId)
              } else {
                handleAction('start', 'Start')
              }
            }}
            disabled={isDisabled}
            className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded-md transition-colors disabled:opacity-50"
            title={buttonTitle}
          >
            {buttonText}
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
            title="Refresh status"
          >
            🔄 Refresh
          </button>
        </div>
      )
    }

    if (status.status === 'failed') {
      return (
        <div className="flex items-center gap-2">
          {canResume && (
            <button
              onClick={() => handleAction('resume', 'Resume')}
              disabled={isDisabled}
              className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors disabled:opacity-50"
              title="Resume from existing segments"
            >
              {actionInProgress === 'Resume' ? 'Resuming...' : '▶️ Resume'}
            </button>
          )}
          <button
            onClick={() => handleAction('restart', 'Restart')}
            disabled={isDisabled}
            className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded-md transition-colors disabled:opacity-50"
            title="Start fresh transcription"
          >
            {actionInProgress === 'Restart' ? 'Restarting...' : '🔄 Restart'}
          </button>
        </div>
      )
    }

    if (status.status === 'completed') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (onRestartRequested) {
                // Use the callback to trigger settings modal
                onRestartRequested(fileId)
              } else {
                // Fallback to direct restart
                handleAction('restart', 'Start Over')
              }
            }}
            disabled={isDisabled}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors disabled:opacity-50"
            title="Start fresh transcription (will replace current results)"
          >
            {actionInProgress === 'Start Over' ? 'Starting...' : '🔄 Start Over'}
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div
      className="bg-card rounded-lg shadow-sm border border-border p-6"
      data-component="transcription-progress"
      data-file-id={fileId}
      data-status={status.status}
      data-progress={progressPercent}
      data-testid={`transcription-progress-${fileId}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {projectName ? `${projectName} - ${status.original_filename || status.filename}` : `${status.original_filename || status.filename}`}
          {isStuck && <span className="ml-2 text-sm text-orange-600">⚠️ Stuck</span>}
        </h3>
        <div className="flex items-center gap-3">
          {renderActionButtons()}
          <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${getStatusBadgeColors(status.status)}`}>
            {status.status}
          </span>
        </div>
      </div>

      {(status.split_label || status.split_origin_filename || splitTimeRange) && (
        <div className="mb-4 text-xs text-indigo-600 dark:text-indigo-300 space-y-1">
          {status.split_label && (
            <div>
              Chunk {status.split_label}
              {status.split_total_chunks ? ` of ${status.split_total_chunks}` : ''}
            </div>
          )}
          {splitTimeRange && <div>Original time range: {splitTimeRange}</div>}
          {status.split_origin_filename && (
            <div>Source file: {status.split_origin_filename}</div>
          )}
        </div>
      )}

      {status.status === 'processing' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-800 dark:text-green-200 font-medium">
              {(() => {
                const stage = status.processing_stage || 'processing'
                const whisperCurrentStatus = systemHealth.data?.components?.whisper?.status
                
                switch (stage.toLowerCase()) {
                  case 'pending':
                    return 'Initializing transcription...'
                  case 'queued':
                  case 'queued_ready':
                    return 'Queued - starting soon...'
                  case 'model_loading':
                    // More specific based on what's actually happening
                    if (whisperCurrentStatus === 'downloading') {
                      return 'Downloading AI model from web...'
                    } else if (whisperCurrentStatus === 'loading') {
                      return 'Loading AI model into memory...'
                    } else {
                      return 'Preparing AI model...'
                    }
                  case 'model_ready_to_load':
                    return 'AI model downloaded, loading into memory...'
                  case 'transcribing':
                    return 'Transcribing audio...'
                  case 'processing_segments':
                    return 'Processing audio segments...'
                  case 'finalizing':
                    return 'Finalizing transcription...'
                  default:
                    // If it contains segment info, show it as is
                    if (stage.includes('segment') || stage.includes('Created')) {
                      return stage
                    }
                    return stage || 'Processing...'
                }
              })()}
            </span>
          </div>

          <div className="mb-3">
            <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-green-600 dark:text-green-400">{progressLabel}% complete</div>
          </div>

          {/* Show Whisper model download/loading details if applicable */}
          {status.processing_stage?.toLowerCase().includes('loading') && (
            <div className="mb-3 p-2 bg-green-100 dark:bg-green-800/30 rounded border border-green-300 dark:border-green-700">
              {/* Distinguish between downloading (from web) vs loading (into memory) */}
              {whisperStatus?.progress !== undefined && whisperStatus.status === 'downloading' ? (
                <>
                  <div className="flex justify-between text-xs text-green-700 dark:text-green-300 mb-1">
                    <span>📥 Downloading from web: {whisperStatus.progress}%</span>
                    <span>{whisperStatus.downloaded} / {whisperStatus.total}</span>
                  </div>
                  <div className="w-full bg-green-200 dark:bg-green-700 rounded-full h-1.5">
                    <div
                      className="bg-green-500 dark:bg-green-400 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(whisperStatus.progress || 0, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-green-600 dark:text-green-400 mt-1">
                    <span>Speed: {whisperStatus.speed}</span>
                    <span>Model: {whisperStatus.model_size}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-green-700 dark:text-green-300 mb-1">
                    <span>🧠 Loading into memory: {whisperStatus?.model_size || 'medium'} model</span>
                    <span>{whisperStatus?.status === 'loading' ? 'In progress...' : 'Preparing...'}</span>
                  </div>
                  <div className="w-full bg-green-200 dark:bg-green-700 rounded-full h-1.5">
                    <div className="bg-green-500 dark:bg-green-400 h-1.5 rounded-full transition-all duration-1000 animate-pulse" 
                         style={{ width: '70%' }} />
                  </div>
                  <div className="flex justify-between text-xs text-green-600 dark:text-green-400 mt-1">
                    <span>This may take 1-3 minutes</span>
                    <span>Model: {whisperStatus?.model_size || 'medium'}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-green-700 dark:text-green-300 text-sm">
            {(() => {
              const isModelStage = status.processing_stage?.toLowerCase().includes('loading')
              const whisperCurrentStatus = systemHealth.data?.components?.whisper?.status
              
              if (isModelStage) {
                if (whisperCurrentStatus === 'downloading') {
                  return 'Downloading AI model from web (first time only). This may take several minutes depending on your internet speed.'
                } else if (whisperCurrentStatus === 'loading') {
                  return 'Loading AI model into memory. This typically takes 1-3 minutes and happens once per session.'
                } else {
                  return 'Preparing AI model. Transcription will start automatically when ready.'
                }
              } else {
                return ''
              }
            })()}
          </p>

          <div className="mt-3 text-xs text-green-600 dark:text-green-400 space-y-1">
            {status.duration && <div>⏱️ {Math.floor(status.duration / 60)}m {Math.floor(status.duration % 60)}s</div>}
            {status.file_size && <div>📄 {(status.file_size / 1024 / 1024).toFixed(2)} MB</div>}
            {status.transcription_started_at && (
              <div>Started: {formatDateTime(status.transcription_started_at).split(' ')[1]}</div>
            )}
          </div>
        </div>
      )}

      {status.status === 'completed' && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground space-y-1">
            {status.duration && (
              <div>Duration: {Math.floor(status.duration / 60)}m {Math.floor(status.duration % 60)}s</div>
            )}
            {status.transcription_started_at && (
              <div>Started: {formatDateTime(status.transcription_started_at).split(' ')[1]}</div>
            )}
            {status.transcription_completed_at && (
              <div>Completed: {formatDateTime(status.transcription_completed_at).split(' ')[1]}</div>
            )}
          </div>
          
          {/* Display transcription settings */}
          {status.transcription_metadata && (() => {
            try {
              const metadata = JSON.parse(status.transcription_metadata)
              return (
                <div className="text-xs text-muted-foreground">
                  Model: {metadata.model_size || 'default'} • Language: {metadata.language || 'auto-detect'} • Diarization: {metadata.include_diarization ? 'enabled' : 'disabled'}
                </div>
              )
            } catch {
              return null
            }
          })()}
          
          {/* Clear transcription button */}
          <div className="pt-2">
            <button
              onClick={handleClear}
              disabled={actionInProgress === 'Clearing'}
              className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:text-red-400 dark:bg-red-950 dark:border-red-800 dark:hover:bg-red-900"
            >
              {actionInProgress === 'Clearing' ? 'Clearing...' : 'Clear Transcription'}
            </button>
          </div>
        </div>
      )}

      {status.status === 'failed' && status.error_message && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{status.error_message}</p>
          {/* Recovery attempts not available in consolidated status
          {detailedStatus?.recovery_attempts > 0 && (
            <p className="text-xs text-red-600 mt-1">
              Recovery attempts: {detailedStatus.recovery_attempts}
            </p>
          )} */}
        </div>
      )}

      {/* Enhanced State Information - Only show for processing transcriptions */}
      {status.status === 'processing' && (
        <div className="mt-4 bg-muted/50 rounded-lg p-3">
          <h4 className="text-sm font-medium mb-2">Transcription Details</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Stage: {(() => {
              const stage = status.processing_stage || 'starting'
              switch (stage.toLowerCase()) {
                case 'pending':
                  return 'Initializing...'
                case 'queued':
                case 'queued_ready':
                  return 'Queued'
                case 'model_loading':
                  return 'Loading AI model'
                case 'transcribing':
                  return 'Transcribing'
                default:
                  return stage
              }
            })()}</div>
            <div>Segments: {status.segment_count || 0}</div>
            <div>Model: {(() => {
              if (status.transcription_metadata) {
                try {
                  const metadata = JSON.parse(status.transcription_metadata)
                  return metadata.model_size || 'default'
                } catch {
                  return 'default'
                }
              }
              return 'default'
            })()}</div>
          </div>
        </div>
      )}
    </div>
  )
}
