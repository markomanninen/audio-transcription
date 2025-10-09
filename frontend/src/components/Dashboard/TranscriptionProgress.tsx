import { useEffect, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranscriptionStatus, useCancelTranscription } from '../../hooks/useTranscription'
import { useSystemHealth } from '../../hooks/useSystemHealth'
import { getStatusBadgeColors } from '../../utils/statusColors'

interface TranscriptionProgressProps {
  fileId: number
  projectName?: string
  onStatusChange?: (status: string) => void
  onRestartRequested?: (fileId: number) => void
}

// Enhanced transcription actions
const transcriptionActions = {
  async startTranscription(fileId: number) {
    const response = await fetch(`/api/transcription/${fileId}/transcribe`, {
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
    const response = await fetch(`/api/transcription/${fileId}/action?action=${action}`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to execute action')
    return response.json()
  },

  async getDetailedStatus(fileId: number) {
    const response = await fetch(`/api/transcription/${fileId}/status`)
    if (!response.ok) throw new Error('Failed to get status')
    return response.json()
  },

  async forceRestart(fileId: number) {
    const response = await fetch(`/api/transcription/${fileId}/action?action=restart`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to restart')
    return response.json()
  },

  async resume(fileId: number) {
    const response = await fetch(`/api/transcription/${fileId}/action?action=resume`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to resume')
    return response.json()
  }
}

export default function TranscriptionProgress({ fileId, projectName, onStatusChange, onRestartRequested }: TranscriptionProgressProps) {
  // Always pass poll interval - the hook handles stopping when not processing
  const { data: status, isLoading, refetch } = useTranscriptionStatus(fileId, 2000)
  const systemHealth = useSystemHealth()
  const cancelTranscription = useCancelTranscription()
  const queryClient = useQueryClient()
  const [detailedStatus, setDetailedStatus] = useState<any>(null)
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

      // Clear detailed status for previous file
      setDetailedStatus(null)
      setActionInProgress(null)

      // Force immediate refetch for new file
      refetch()
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

  useEffect(() => {
    if (status) {
      onStatusChange?.(status.status)
      // Load detailed status for enhanced features
      transcriptionActions.getDetailedStatus(fileId)
        .then(setDetailedStatus)
        .catch(console.error)
    }
  }, [status?.status, onStatusChange, fileId])

  // Force periodic refetch when processing to ensure real-time updates
  useEffect(() => {
    if (status?.status === 'processing') {
      const interval = setInterval(() => {
        console.log('Force refetching status during processing...')
        refetch()
      }, 1500) // Refetch every 1.5 seconds when processing
      
      return () => clearInterval(interval)
    }
  }, [status?.status, refetch])

  const handleCancel = async () => {
    if (fileId && status?.status === 'processing') {
      try {
        await cancelTranscription.mutateAsync(fileId)
      } catch (error) {
        console.error('Failed to cancel transcription:', error)
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
        transcriptionActions.getDetailedStatus(fileId)
          .then(setDetailedStatus)
          .catch(console.error)

        // Invalidate all related queries for comprehensive refresh with v3 keys
        queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['speakers', fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['files'] })
        queryClient.invalidateQueries({ queryKey: ['project-files'] })
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
  const isWhisperLoading = whisperStatus?.status === 'loading' || whisperStatus?.status === 'downloading'
  const isWhisperReady = whisperStatus?.status === 'up' ||
    (whisperStatus?.status === 'downloading' && whisperStatus?.progress === 100)

  // CRITICAL FIX: Only show Whisper loading state for PENDING files
  // Do NOT show for completed/processing/failed files - they should show their actual status
  if (isWhisperLoading && status.status === 'pending' && !status.transcription_completed_at) {
    return (
      <div
        className="bg-card rounded-lg shadow-sm border border-border p-6"
        data-component="transcription-progress"
        data-file-id={fileId}
        data-status="whisper-loading"
        data-model-size={whisperStatus?.model_size}
        data-testid={`transcription-progress-${fileId}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {projectName ? `${projectName} - ${status.original_filename || status.filename}` : `Audio Transcription - ${status.original_filename || status.filename}`}
          </h3>
          <span className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide bg-yellow-100 text-yellow-800">
            Whisper Model Loading
          </span>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-yellow-800 dark:text-yellow-200 font-medium">
              Transcription Model Download
            </span>
          </div>
          
          {whisperStatus?.progress !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-yellow-700 dark:text-yellow-300">
                <span>Progress: {whisperStatus.progress}%</span>
                <span>{whisperStatus.downloaded} / {whisperStatus.total}</span>
              </div>
              <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
                <div 
                  className="bg-yellow-600 dark:bg-yellow-400 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${whisperStatus.progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-yellow-600 dark:text-yellow-400">
                <span>Speed: {whisperStatus.speed}</span>
                <span>Whisper model: {whisperStatus.model_size}</span>
              </div>
            </div>
          )}
          
          <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-3">
            The Whisper transcription model is being downloaded. Transcription will start automatically once the download completes. This may take several minutes on first startup - please be patient.
          </p>
        </div>
      </div>
    )
  }

  const progressPercent = Math.round(status.progress * 100)
  const isStuck = detailedStatus?.is_stuck || false
  const canResume = detailedStatus?.can_resume || false
  
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
      const isModelReadyToLoad = whisperStatus?.status === 'downloading' && whisperStatus?.progress === 100
      const buttonTitle = !isWhisperReady ? "AI model is still loading - please wait" : 
        (isModelReadyToLoad ? "Start transcription (will load model automatically)" : "Start transcription")
      const buttonText = !isWhisperReady ? '⏳ Model Loading...' : 
        (actionInProgress === 'Start' ? 'Starting...' : 
         isModelReadyToLoad ? '▶️ Start (Auto-load)' : '▶️ Start')
      
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
          {projectName ? `${projectName} - ${status.original_filename || status.filename}` : `Audio Transcription - ${status.original_filename || status.filename}`}
          {isStuck && <span className="ml-2 text-sm text-orange-600">⚠️ Stuck</span>}
        </h3>
        <div className="flex items-center gap-3">
          {renderActionButtons()}
          <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${getStatusBadgeColors(status.status)}`}>
            {status.status}
          </span>
        </div>
      </div>

      {status.status === 'processing' && (
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {progressPercent}% complete
            </p>
            {status.processing_stage && (
              <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                {status.processing_stage}
              </p>
            )}
          </div>
          
          {/* DateTime information for processing status */}
          {status.transcription_started_at && (
            <div className="text-sm text-muted-foreground">
              Started: {formatDateTime(status.transcription_started_at)}
            </div>
          )}
          
          {status.processing_stage && (
            <div className="text-xs text-muted-foreground text-center">
              {status.processing_stage.includes('Creating segments') && (
                <>
                  📝 {status.processing_stage}
                  <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ This may take several minutes for long audio files
                  </div>
                </>
              )}
              {status.processing_stage.includes('segments') && !status.processing_stage.includes('Creating segments') && '📝 Creating text segments...'}
            </div>
          )}
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
            } catch (e) {
              return null
            }
          })()}
        </div>
      )}

      {status.status === 'failed' && status.error_message && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{status.error_message}</p>
          {detailedStatus?.recovery_attempts > 0 && (
            <p className="text-xs text-red-600 mt-1">
              Recovery attempts: {detailedStatus.recovery_attempts}
            </p>
          )}
        </div>
      )}

      {/* Enhanced State Information - Only show for processing transcriptions */}
      {status.status === 'processing' && (
        <div className="mt-4 bg-muted/50 rounded-lg p-3">
          <h4 className="text-sm font-medium mb-2">Transcription Details</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Stage: {status.processing_stage || 'Starting...'}</div>
            <div>Segments: {status.segment_count || 0}</div>
            <div>Progress: {Math.round(status.progress * 100)}%</div>
            <div>Model: {(() => {
              if (status.transcription_metadata) {
                try {
                  const metadata = JSON.parse(status.transcription_metadata)
                  return metadata.model_size || 'default'
                } catch (e) {
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
