import { useState } from 'react'
import { 
  useEnhancedTranscriptionStatus, 
  useTranscriptionAction,
  useForceRestart,
  useResumeTranscription
} from '../../hooks/useEnhancedTranscription'
import { getStatusBadgeColors } from '../../utils/statusColors'

interface EnhancedTranscriptionControlProps {
  fileId: number
}

export default function EnhancedTranscriptionControl({ fileId }: EnhancedTranscriptionControlProps) {
  const { data: status, isLoading } = useEnhancedTranscriptionStatus(fileId, 2000)
  const transcriptionAction = useTranscriptionAction()
  const forceRestart = useForceRestart()
  const resumeTranscription = useResumeTranscription()
  const [showDetails, setShowDetails] = useState(false)

  const handleAction = async (action: 'auto' | 'resume' | 'restart' | 'continue') => {
    try {
      const result = await transcriptionAction.mutateAsync({ fileId, action })
      console.log(`Action result:`, result)
    } catch (error) {
      console.error(`Action failed:`, error)
    }
  }

  const handleForceRestart = async () => {
    try {
      const result = await forceRestart.mutateAsync(fileId)
      console.log(`Force restart result:`, result)
    } catch (error) {
      console.error(`Force restart failed:`, error)
    }
  }

  const handleResume = async () => {
    try {
      const result = await resumeTranscription.mutateAsync(fileId)
      console.log(`Resume result:`, result)
    } catch (error) {
      console.error(`Resume failed:`, error)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const getStageEmoji = (stage: string) => {
    if (stage.includes('initializing')) return '🔄'
    if (stage.includes('loading_model')) return '🤖'
    if (stage.includes('converting') || stage.includes('transforming')) return '🎵'
    if (stage.includes('transcribing')) return '🗣️'
    if (stage.includes('segments')) return '📝'
    if (stage.includes('completed')) return '✅'
    return '⏳'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-sm text-muted-foreground">Loading status...</span>
      </div>
    )
  }

  if (!status) return null

  const progressPercent = Math.round(status.progress * 100)
  const isInProgress = status.status === 'processing'
  const isActionPending = transcriptionAction.isPending || forceRestart.isPending || resumeTranscription.isPending

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Enhanced Transcription Control</h3>
          {status.is_stuck && (
            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
              ⚠️ Stuck
            </span>
          )}
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Status Badge and Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${getStatusBadgeColors(status.status)}`}>
          {status.status}
        </span>
        <div className="text-sm text-muted-foreground">
          File ID: {status.file_id}
        </div>
      </div>

      {/* Progress Bar */}
      {isInProgress && (
        <div className="space-y-3 mb-4">
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
            <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
              {getStageEmoji(status.transcription_stage)} {status.transcription_stage}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {status.status === 'processing' ? (
          <button
            onClick={() => handleAction('auto')}
            disabled={isActionPending}
            className="px-3 py-1 text-sm bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-md transition-colors disabled:opacity-50"
          >
            {isActionPending ? 'Working...' : '⚠️ Check Status'}
          </button>
        ) : (
          <>
            <button
              onClick={() => handleAction('auto')}
              disabled={isActionPending}
              className="px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md transition-colors disabled:opacity-50"
            >
              {isActionPending ? 'Working...' : '🤖 Smart Action'}
            </button>
            
            {status.can_resume && (
              <button
                onClick={handleResume}
                disabled={isActionPending}
                className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors disabled:opacity-50"
              >
                {isActionPending ? 'Working...' : '▶️ Resume'}
              </button>
            )}
            
            <button
              onClick={() => handleAction('restart')}
              disabled={isActionPending}
              className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded-md transition-colors disabled:opacity-50"
            >
              {isActionPending ? 'Working...' : '🔄 Restart'}
            </button>
            
            {status.is_stuck && (
              <button
                onClick={handleForceRestart}
                disabled={isActionPending}
                className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors disabled:opacity-50"
              >
                {isActionPending ? 'Working...' : '🚨 Force Restart'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Enhanced Details */}
      {showDetails && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-sm">📊 Detailed Status</h4>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Stage:</span>
              <span className="ml-2">{getStageEmoji(status.transcription_stage)} {status.transcription_stage}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Segments:</span>
              <span className="ml-2">{status.segments_created}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Audio Transformed:</span>
              <span className="ml-2">{status.audio_transformed ? '✅' : '❌'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Model:</span>
              <span className="ml-2">{status.whisper_model_loaded || 'Not loaded'}</span>
            </div>
            
            {status.duration && (
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <span className="ml-2">{formatDuration(status.duration)}</span>
              </div>
            )}
            
            {status.last_processed_segment > 0 && (
              <div>
                <span className="text-muted-foreground">Last Segment:</span>
                <span className="ml-2">{status.last_processed_segment}</span>
              </div>
            )}
            
            {status.interruption_count > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Interruptions:</span>
                <span className="ml-2 text-orange-600">{status.interruption_count}</span>
              </div>
            )}
            
            {status.recovery_attempts > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Recovery Attempts:</span>
                <span className="ml-2 text-blue-600">{status.recovery_attempts}</span>
              </div>
            )}
          </div>

          {status.error_message && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{status.error_message}</p>
            </div>
          )}
        </div>
      )}

      {/* Success State */}
      {status.status === 'completed' && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <span className="text-xl">✅</span>
            <span className="font-medium">Transcription completed successfully!</span>
          </div>
          <div className="text-sm text-green-700 dark:text-green-300 mt-2">
            <p>{status.segments_created} segments created</p>
            {status.duration && <p>Duration: {formatDuration(status.duration)}</p>}
          </div>
        </div>
      )}
    </div>
  )
}