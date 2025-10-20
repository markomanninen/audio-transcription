import React from 'react'
import { useStartTranscription, useTranscriptionStatus } from '../../hooks/useTranscription'
import { useProjectFiles } from '../../hooks/useUpload'
import { useForceRestart } from '../../hooks/useEnhancedTranscription'
import { useSystemHealth } from '../../hooks/useSystemHealth'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, API_BASE_URL } from '../../api/client'
import { TranscriptionSettingsModal, TranscriptionSettings } from './TranscriptionSettingsModal'
import SplitBatchDialog from './SplitBatchDialog'
import { getStatusBadgeColors } from '../../utils/statusColors'
import { useToast } from '../../hooks/useToast'
import type { TranscriptionStatus as TranscriptionStatusResult, AudioFile } from '../../types'

interface FileListProps {
  projectId: number
  onSelectFile?: (fileId: number | null) => void
  selectedFileId?: number
}

interface ActionInProgress {
  fileId: number
  action: string
}

interface BatchChunk {
  fileId: number
  originalFilename: string
}

interface BatchState {
  parentId: number
  chunks: BatchChunk[]
  startedAt: string
  completedAt?: string
}

export function FileList({ projectId, onSelectFile, selectedFileId }: FileListProps) {
  const { data: files, isLoading, error } = useProjectFiles(projectId)
  
  // Debug logging for file data
  if (import.meta.env.DEV) {
    console.log('[FileList] Received', files?.length || 0, 'files:', files?.map(f => f.file_id) || [])
    console.log('[FileList] File statuses:', files?.map(f => ({ file_id: f.file_id, status: f.status, filename: f.original_filename || f.filename })) || [])
  }
  React.useEffect(() => {
    if (files && files.length > 0) {
      if (import.meta.env.DEV) {
        console.log(`[FileList] Received ${files.length} files:`, files.map(f => f.file_id))
        console.log(`[FileList] File statuses:`, files.map(f => ({ id: f.file_id, status: f.status, filename: f.original_filename })))
      }
    }
  }, [files])
  
  const startTranscription = useStartTranscription()
  const forceRestart = useForceRestart()
  const queryClient = useQueryClient()
  const { success } = useToast()
  const { data: systemHealth } = useSystemHealth()
  const [actionInProgress, setActionInProgress] = React.useState<ActionInProgress | null>(null)
  const [showTranscriptionModal, setShowTranscriptionModal] = React.useState<{
    fileId: number
    fileName: string
  } | null>(null)
  const [splitTarget, setSplitTarget] = React.useState<{
    fileId: number
    fileName: string
  } | null>(null)
  const [activeBatch, setActiveBatch] = React.useState<BatchState | null>(null)
  const lastAutoSelected = React.useRef<number | null>(null)
  const completionToastShown = React.useRef<number | null>(null)

  const handleBatchBegin = React.useCallback(
    ({ parentId, chunks }: { parentId: number; chunks: BatchChunk[] }) => {
      setActiveBatch({ parentId, chunks, startedAt: new Date().toISOString() })
      if (chunks.length > 0) {
        onSelectFile?.(chunks[0].fileId)
      }
    },
    [onSelectFile]
  )

  // Auto-detect batch from processing split files
  React.useEffect(() => {
    if (activeBatch || !files) return
    
    console.log('Auto-detection check:', {
      hasActiveBatch: !!activeBatch,
      fileCount: files.length,
      files: files.map(f => ({
        id: f.file_id,
        status: f.status,
        parent_id: f.parent_audio_file_id,
        transcription_started: f.transcription_started_at
      }))
    })
    
    // Find all split files (processing or pending ONLY) that could form a batch
    // Don't include completed files - we only want active batches
    const splitFiles = files.filter(file =>
      file.parent_audio_file_id &&
      (file.status === 'processing' || file.status === 'pending')
    )
    
    console.log('Split files found for batch detection:', splitFiles.length, splitFiles.map(f => ({
      id: f.file_id,
      status: f.status,
      parent_id: f.parent_audio_file_id
    })))
    
    if (splitFiles.length >= 2) {
      // Group by parent file
      const parentGroups = splitFiles.reduce((groups, file) => {
        const parentId = file.parent_audio_file_id!
        if (!groups[parentId]) groups[parentId] = []
        groups[parentId].push(file)
        return groups
      }, {} as Record<number, typeof splitFiles>)
      
      // Find the largest group of split files processing together
      const largestGroup = Object.values(parentGroups).reduce((largest, current) => 
        current.length > largest.length ? current : largest, [])
      
      if (largestGroup.length >= 2) {
        // Create auto-detected batch
        const chunks: BatchChunk[] = largestGroup.map((file: AudioFile) => ({
          fileId: file.file_id,
          originalFilename: file.original_filename
        }))
        
        console.log('Auto-detected batch of', chunks.length, 'split files')
        setActiveBatch({
          parentId: largestGroup[0].parent_audio_file_id!,
          chunks,
          startedAt: largestGroup[0].transcription_started_at!
        })
        
        // Select the first file in the batch
        if (chunks.length > 0) {
          onSelectFile?.(chunks[0].fileId)
        }
      }
    }
  }, [files, activeBatch, onSelectFile])

  const batchFileIdSet = React.useMemo(() => {
    if (!activeBatch) {
      return new Set<number>()
    }
    return new Set(activeBatch.chunks.map((chunk) => chunk.fileId))
  }, [activeBatch])

  const batchProgress = React.useMemo(() => {
    if (!activeBatch) return null
    const total = activeBatch.chunks.length
    if (total === 0) return null

    const fileMap = new Map((files || []).map((file) => [file.file_id, file]))
    let completedCount = 0
    let failedCount = 0
    let currentIndex = 0
    let currentChunk: { file?: AudioFile; chunk: BatchChunk } | null = null

    // First, count completed and failed
    activeBatch.chunks.forEach((chunk, _index) => {
      const file = fileMap.get(chunk.fileId)
      const status = file?.status
      if (status === 'completed') {
        completedCount += 1
      } else if (status === 'failed') {
        failedCount += 1
      }
    })

    // CRITICAL FIX: Find the ACTUAL current processing file by looking at
    // most recent transcription_started_at timestamp
    let processingFiles: Array<{ file: AudioFile; chunk: BatchChunk; index: number }> = []

    activeBatch.chunks.forEach((chunk, index) => {
      const file = fileMap.get(chunk.fileId)
      const status = file?.status
      if (status === 'processing' || status === 'pending') {
        processingFiles.push({ file: file!, chunk, index })
      }
    })

    if (processingFiles.length > 0) {
      // Sort by transcription_started_at (most recent first)
      processingFiles.sort((a, b) => {
        const aStarted = a.file?.transcription_started_at
        const bStarted = b.file?.transcription_started_at

        // Files with start time come before files without
        if (aStarted && !bStarted) return -1
        if (!aStarted && bStarted) return 1
        if (!aStarted && !bStarted) return 0

        // Most recent start time first
        return new Date(bStarted!).getTime() - new Date(aStarted!).getTime()
      })

      // The first in sorted list is the actual current file
      const current = processingFiles[0]
      currentChunk = { file: current.file, chunk: current.chunk }
      currentIndex = current.index
    }

    if (!currentChunk) {
      const fallback = activeBatch.chunks[total - 1]
      currentChunk = { file: fileMap.get(fallback.fileId), chunk: fallback }
      currentIndex = total - 1
    }

    const isComplete = completedCount + failedCount === total

    return {
      parentId: activeBatch.parentId,
      total,
      completed: completedCount,
      failed: failedCount,
      currentChunk,
      currentIndex,
      isComplete,
    }
  }, [activeBatch, files])

  const currentBatchFileId = batchProgress?.currentChunk?.chunk.fileId ?? null

  // CRITICAL FIX: Stop polling when batch is complete to prevent flickering
  const shouldPollBatch = currentBatchFileId && !batchProgress?.isComplete

  // Reduce polling frequency during batch processing to prevent excessive requests
  const batchPollInterval = React.useMemo(() => {
    if (!shouldPollBatch) return undefined
    
    // Count how many files are actively processing
    const processingCount = files?.filter(f => f.status === 'processing').length || 0
    
    // Increase interval based on number of processing files to reduce server load
    if (processingCount > 3) return 5000 // 5 second interval for heavy batch loads
    if (processingCount > 1) return 3000 // 3 second interval for moderate loads
    return 2000 // Standard 2 second interval for single file
  }, [shouldPollBatch, files])

  const { data: currentBatchStatus } = useTranscriptionStatus(
    currentBatchFileId,
    batchPollInterval
  )

  React.useEffect(() => {
    const targetId = batchProgress?.currentChunk?.chunk.fileId
    if (!targetId) return
    if (lastAutoSelected.current === targetId) return

    // Debounce auto-selection to prevent rapid flickering during batch processing
    const timer = setTimeout(() => {
      lastAutoSelected.current = targetId
      onSelectFile?.(targetId)
      console.log(`[FileList] Auto-selected file ${targetId} during batch processing`)
    }, 300) // 300ms delay to stabilize selection

    return () => clearTimeout(timer)
  }, [batchProgress?.currentChunk?.chunk.fileId, onSelectFile])

  React.useEffect(() => {
    if (!batchProgress?.isComplete) return
    if (!activeBatch) return

    // Add stabilization delay for completion handling to prevent flickering
    const timer = setTimeout(() => {
      // Show completion toast (only once per batch)
      if (activeBatch.parentId !== completionToastShown.current) {
        completionToastShown.current = activeBatch.parentId

        const completed = batchProgress.completed
        const failed = batchProgress.failed
        const total = batchProgress.total

        if (failed > 0) {
          success(
            'Batch transcription completed',
            `${completed} of ${total} chunks transcribed successfully. ${failed} failed.`
          )
        } else {
          success(
            'Batch transcription completed!',
            `All ${total} chunks have been transcribed successfully.`
          )
        }
      }

      // CRITICAL FIX: Only set completedAt if not already set
      if (!activeBatch.completedAt) {
        setActiveBatch((previous) => {
          if (!previous || previous.completedAt) return previous
          return { ...previous, completedAt: new Date().toISOString() }
        })
      }
    }, 500) // 500ms stabilization delay

    return () => clearTimeout(timer)
  }, [batchProgress?.isComplete, batchProgress?.completed, batchProgress?.failed, batchProgress?.total, activeBatch?.parentId, activeBatch?.completedAt, activeBatch, success])

  React.useEffect(() => {
    if (!activeBatch?.completedAt) return

    // CRITICAL FIX: Clear overlay after 5 seconds (give user time to see completion message)
    const timeout = window.setTimeout(() => {
      setActiveBatch(null)
      lastAutoSelected.current = null
      completionToastShown.current = null // Reset for next batch
    }, 5000) // 5 seconds instead of 3

    return () => window.clearTimeout(timeout)
  }, [activeBatch?.completedAt])

  const showBatchOverlay = Boolean(activeBatch && batchProgress)
  const batchOverlayProgress = batchProgress
    ? batchProgress.isComplete
      ? 100
      : Math.min(Math.max(Math.round((currentBatchStatus?.progress ?? 0) * 100), 0), 99)
    : 0
  const batchOverlayFileName = batchProgress
    ? batchProgress.currentChunk?.file?.original_filename ?? batchProgress.currentChunk?.chunk.originalFilename
    : undefined
  const batchOverlayStage = batchProgress?.isComplete
    ? 'Batch completed'
    : currentBatchStatus?.processing_stage ?? 'Preparing next chunk...'
  const batchOverlayPosition = batchProgress ? Math.min(batchProgress.currentIndex + 1, batchProgress.total) : 0
  const batchOverlayRemaining = batchProgress
    ? Math.max(batchProgress.total - batchProgress.completed - batchProgress.failed, 0)
    : 0

  const batchOverlayElement = showBatchOverlay && batchProgress && (
    <div className="fixed bottom-6 inset-x-0 flex justify-center pointer-events-none z-50">
      <div className="pointer-events-auto bg-white dark:bg-gray-900 border border-border shadow-xl rounded-2xl px-6 py-4 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
          <span>Batch transcription</span>
          <span>{batchProgress.isComplete ? 'Done' : `File ${batchOverlayPosition} of ${batchProgress.total}`}</span>
        </div>
        {batchOverlayFileName && (
          <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {batchOverlayFileName}
          </div>
        )}
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-2 bg-indigo-500 transition-all duration-300"
            style={{ width: `${batchOverlayProgress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            {batchProgress.completed} completed{batchProgress.failed ? ` • ${batchProgress.failed} failed` : ''}
          </span>
          {!batchProgress.isComplete && <span>{batchOverlayRemaining} remaining</span>}
        </div>
        {batchOverlayStage && (
          <div className="mt-2 text-xs text-muted-foreground">{batchOverlayStage}</div>
        )}
      </div>
    </div>
  )

  // Delete file mutation
  const deleteFile = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiClient.delete(`/api/upload/files/${fileId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'], exact: false })
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

  const formatSplitRange = (start?: number | null, end?: number | null): string => {
    if (start == null || end == null) return ''
    const format = (value: number) => {
      const mins = Math.floor(value / 60)
      const secs = Math.floor(value % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return `${format(start)} → ${format(end)}`
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

    // Check if Whisper model is currently loading or downloading to prevent concurrent downloads
    if (systemHealth?.components?.whisper?.status === 'loading' || 
        systemHealth?.components?.whisper?.status === 'downloading') {
      console.log('Whisper model is loading/downloading, preventing concurrent transcription start')
      return
    }

    const fileId = showTranscriptionModal.fileId
    const statusQueryKey = ['transcription-status', fileId, 'v3'] as const
    const filesQueryKey = ['files', projectId] as const
    const previousStatus = queryClient.getQueryData<TranscriptionStatusResult>(statusQueryKey)
    const previousFiles = queryClient.getQueryData<AudioFile[]>(filesQueryKey)
    const now = new Date().toISOString()

    const optimisticStatus: TranscriptionStatusResult = {
      file_id: previousStatus?.file_id ?? fileId,
      filename: previousStatus?.filename ?? showTranscriptionModal.fileName,
      original_filename: previousStatus?.original_filename ?? showTranscriptionModal.fileName,
      status: 'processing',
      progress: previousStatus?.progress ?? 0,
      error_message: undefined,
      processing_stage: 'Preparing transcription...',
      segment_count: previousStatus?.segment_count ?? 0,
      duration: previousStatus?.duration,
      transcription_started_at: previousStatus?.transcription_started_at ?? now,
      transcription_completed_at: undefined,
      created_at: previousStatus?.created_at ?? now,
      updated_at: now,
      transcription_metadata: previousStatus?.transcription_metadata ?? undefined,
    }

    console.log('Setting action in progress...')
    setActionInProgress({ 
      fileId, 
      action: 'Starting transcription' 
    })
    
    // Apply optimistic updates so the UI reflects the new state immediately
    queryClient.setQueryData(statusQueryKey, optimisticStatus)
    queryClient.setQueryData<AudioFile[] | undefined>(filesQueryKey, (current) =>
      current?.map((audioFile) =>
        audioFile.file_id === fileId
          ? {
              ...audioFile,
              status: 'processing',
              transcription_started_at: optimisticStatus.transcription_started_at,
              transcription_completed_at: undefined,
            }
          : audioFile
      )
    )

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
      queryClient.invalidateQueries({ queryKey: ['files'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['transcription-status', showTranscriptionModal.fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['segments', showTranscriptionModal.fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['speakers', showTranscriptionModal.fileId, 'v3'] })

      console.log('Transcription start completed successfully')
    } catch (error) {
      console.error('Failed to start transcription:', error)
      // Revert optimistic updates if start fails
      if (previousStatus) {
        queryClient.setQueryData(statusQueryKey, previousStatus)
      } else {
        queryClient.removeQueries({ queryKey: statusQueryKey, exact: true })
      }
      if (previousFiles) {
        queryClient.setQueryData(filesQueryKey, previousFiles)
      }

      // Even on error, refresh status queries so the UI shows latest state from backend
      queryClient.invalidateQueries({ queryKey: ['files'], exact: false })
      if (showTranscriptionModal) {
        queryClient.invalidateQueries({ queryKey: ['transcription-status', showTranscriptionModal.fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['segments', showTranscriptionModal.fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['speakers', showTranscriptionModal.fileId, 'v3'] })
      }
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
    } catch (error: unknown) {
      console.error('Error deleting file:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred'
      alert(`Failed to delete file: ${errorMessage}`)
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <>
        {batchOverlayElement}
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading files...</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        {batchOverlayElement}
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
      </>
    )
  }

  if (!files || files.length === 0) {
    return (
      <>
        {batchOverlayElement}
        <div className="text-center p-8 text-gray-600 dark:text-gray-400">
          <div className="text-4xl mb-4">📄</div>
          <p className="text-lg font-medium">No audio files uploaded yet</p>
          <p className="text-sm mt-2">Upload your first file to get started with transcription.</p>
        </div>
      </>
    )
  }

  return (
    <>
      {batchOverlayElement}
      <div className="space-y-4" data-component="file-list">
        {files.map((file) => {
          const cachedStatus = queryClient.getQueryData<TranscriptionStatusResult>([
            'transcription-status',
            file.file_id,
            'v3',
          ])
          // Prioritize fresh file data over potentially stale cache for status
          const baseStatus = file.status ?? cachedStatus?.status ?? 'pending'
          // Use processing_stage and error_message from file data (now included in file list API)
          const errorMessage = file.error_message ?? cachedStatus?.error_message
          const processingStage = file.processing_stage ?? cachedStatus?.processing_stage
          

          
          // Enhanced status determination based on error messages and whisper state
          const getEnhancedStatus = (status: string, errorMsg?: string, processingStage?: string) => {
            // Normalize status to lowercase for consistent comparison
            const normalizedStatus = status?.toLowerCase()

            // PHASE 3 FIX: Backend now returns status='processing' even during model loading
            // If status is 'processing' and stage mentions "loading", we're in model loading phase
            if (normalizedStatus === 'processing' && processingStage) {
              const stageLC = processingStage.toLowerCase()
              // Check for model loading indicators (old and new formats)
              if (stageLC.includes('loading') && (stageLC.includes('whisper') || stageLC.includes('model'))) {
                // This is model loading, not actual transcription
                // Keep status as 'processing' to show unified progress bar
                return normalizedStatus
              }
            }

            // OLD CODE: For backwards compatibility with files that haven't been updated yet
            if (normalizedStatus === 'pending' && processingStage) {
              // Handle old specific processing stages
              if (processingStage === 'model_ready_to_load' || processingStage === 'queued_ready') {
                return 'ready-to-start'
              }
              if (processingStage === 'model_download_needed' || processingStage === 'queued_download') {
                return 'model-download-needed'
              }
              if (processingStage === 'model_loading') {
                return 'model-loading'
              }
              // Only consider it processing if actually transcribing (not loading)
              if (errorMsg && errorMsg.includes('Stage:') && processingStage !== 'model_loading') {
                return 'processing'
              }
            }
            return normalizedStatus || 'pending'
          }
          
          const effectiveStatus = getEnhancedStatus(baseStatus, errorMessage, processingStage)
          const isSelected = selectedFileId === file.file_id
          const isBatchMember = batchFileIdSet.has(file.file_id)
          const isBatchCurrent = batchProgress?.currentChunk?.chunk.fileId === file.file_id
          const depthIndent = Math.min((file.split_depth ?? 0) * 16, 64)

          return (
            <div key={file.file_id} style={{ marginLeft: depthIndent }}>
              <div
                className={`
                  bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                  rounded-xl p-6 transition-all duration-200 hover:shadow-md cursor-pointer
                  ${
                    isBatchCurrent
                      ? 'ring-2 ring-indigo-500 border-indigo-500'
                      : isSelected
                        ? 'ring-2 ring-blue-500 border-blue-500'
                        : 'hover:border-gray-300 dark:hover:border-gray-600'
                  }
                  ${!isBatchCurrent && !isSelected && isBatchMember ? 'border-indigo-200 dark:border-indigo-400/40' : ''}
                `}
                data-component="file-card"
                data-file-id={file.file_id}
                data-status={effectiveStatus}
                data-selected={isSelected ? 'true' : 'false'}
                data-batch-member={isBatchMember ? 'true' : 'false'}
                data-batch-current={isBatchCurrent ? 'true' : 'false'}
                onClick={() => onSelectFile?.(file.file_id)}
              >
          {/* Header Row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                <span data-file-name>{file.original_filename}</span>
              </h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  📄 {formatFileSize(file.file_size)}
                </span>
                <span className="flex items-center gap-1">
                  ⏱️ {formatDuration(file.duration || 0)}
                </span>
              </div>
              {file.parent_audio_file_id && (
                <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">
                  ↳ {formatSplitRange(file.split_start_seconds, file.split_end_seconds)}
                </div>
              )}
            </div>
            
            {/* Delete Button */}
            <div className="flex items-center gap-3">
              {isBatchMember && (
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${
                    file.status === 'processing'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
                  }`}
                >
                  {file.status === 'processing' ? 'Processing' : 'Batch'}
                </span>
              )}
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
              {(effectiveStatus === 'pending' || effectiveStatus === 'model-loading' || effectiveStatus === 'ready-to-start' || effectiveStatus === 'model-download-needed') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTranscribe(file.file_id, file.original_filename)
                  }}
                  disabled={
                    startTranscription.isPending || 
                    actionInProgress?.fileId === file.file_id ||
                    systemHealth?.components?.whisper?.status === 'loading' ||
                    systemHealth?.components?.whisper?.status === 'downloading'
                  }
                  className="
                    px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                    hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                  "
                >
                  {actionInProgress?.fileId === file.file_id 
                    ? 'Starting...' 
                    : systemHealth?.components?.whisper?.status === 'downloading'
                    ? `📥 Downloading... ${systemHealth.components.whisper.progress || 0}%`
                    : systemHealth?.components?.whisper?.status === 'loading'
                    ? '⏳ Model Loading...'
                    : effectiveStatus === 'model-loading' 
                    ? '⏳ Model Loading...'
                    : effectiveStatus === 'model-download-needed'
                    ? '📥 Download & Start'
                    : effectiveStatus === 'ready-to-start'
                    ? '🚀 Start (Model Cached)'
                    : '▶️ Start Transcription'}
                </button>
              )}

              {effectiveStatus === 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectFile?.(file.file_id)
                  }}
                  className="
                    px-3 py-2 border border-border text-sm rounded-lg transition-colors
                    hover:bg-muted
                  "
                  title="View Transcription"
                >
                  📋
                </button>
              )}

              {effectiveStatus === 'failed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectFile?.(file.file_id)
                  }}
                  className="
                    px-3 py-2 border border-border text-sm rounded-lg transition-colors
                    hover:bg-muted
                  "
                  title="View Details"
                >
                  📋
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSplitTarget({ fileId: file.file_id, fileName: file.original_filename })
                }}
                disabled={actionInProgress?.fileId === file.file_id}
                className="
                  px-3 py-2 border border-border text-sm rounded-lg transition-colors
                  hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed
                "
                title="Split & Batch"
              >
                ✂️
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center gap-2">
              {/* Status Badge */}
              <span
                className={`
                  px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide
                  ${getStatusBadgeColors(effectiveStatus)}
                `}
              >
                {effectiveStatus === 'model-loading' 
                  ? 'MODEL LOADING' 
                  : effectiveStatus === 'ready-to-start'
                  ? 'READY TO START'
                  : effectiveStatus === 'model-download-needed'
                  ? 'MODEL DOWNLOAD NEEDED'
                  : effectiveStatus}
              </span>

              {/* No secondary actions for failed files - use details panel instead */}

              {effectiveStatus === 'processing' && (
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


          {actionInProgress?.fileId === file.file_id && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                {actionInProgress.action}...
              </div>
            </div>
          )}
        </div>
      </div>
        )
        })}
      </div>

      <SplitBatchDialog
        open={!!splitTarget}
        fileId={splitTarget?.fileId ?? 0}
        fileName={splitTarget?.fileName ?? ''}
        projectId={projectId}
        onClose={() => setSplitTarget(null)}
        onBatchBegin={handleBatchBegin}
      />

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
