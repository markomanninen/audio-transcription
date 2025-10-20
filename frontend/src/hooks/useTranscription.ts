import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiClient } from '../api/client'
import type { TranscriptionStatus, Segment, Speaker, AudioFile } from '../types'

export const useStartTranscription = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      fileId,
      includeDiarization = true,
    }: {
      fileId: number
      includeDiarization?: boolean
    }) => {
      const response = await apiClient.post(`/api/transcription/${fileId}/action?action=auto`, {
        include_diarization: includeDiarization,
      })
      return response.data
    },
    onSuccess: (_, variables: { fileId: number; includeDiarization?: boolean }) => {
      // Invalidate with new cache key structure
      queryClient.invalidateQueries({ queryKey: ['transcription-status', variables.fileId, 'v3'] })
    },
  })
}

export const useCancelTranscription = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiClient.post(`/api/transcription/${fileId}/cancel`)
      return response.data
    },
    onSuccess: (_, fileId: number) => {
      // Invalidate with new cache key structure
      queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
    },
  })
}

export const useTranscriptionStatus = (fileId: number | null, pollInterval?: number) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    // Enhanced cache key with version for isolation
    queryKey: ['transcription-status', fileId, 'v3'],
    queryFn: async (): Promise<TranscriptionStatus> => {
      if (!fileId) throw new Error('No file ID')

      // Debug logging in development
      if (import.meta.env.DEV) {
        console.log(`[useTranscriptionStatus] Fetching status for file ${fileId}`)
      }

      const response = await apiClient.get<TranscriptionStatus>(
        `/api/transcription/${fileId}/status`
      )

      // Update file list cache in-place instead of invalidating (prevents cascade)
      queryClient.setQueriesData<AudioFile[] | undefined>(
        { queryKey: ['files'] },
        (oldFiles) => {
          if (!oldFiles) return oldFiles

          // Check if file exists and status changed
          const fileIndex = oldFiles.findIndex(f => f.file_id === fileId)
          if (fileIndex === -1) return oldFiles

          const file = oldFiles[fileIndex]
          if (file.status === response.data.status) return oldFiles

          // Only update if status changed
          if (import.meta.env.DEV) {
        if (import.meta.env.DEV) {
          console.log(`[useTranscriptionStatus] Updating file ${fileId} in cache: ${file.status} → ${response.data.status}`)
        }
          }

          const newFiles = [...oldFiles]
          newFiles[fileIndex] = {
            ...file,
            status: response.data.status,
            transcription_started_at: response.data.transcription_started_at,
            transcription_completed_at: response.data.transcription_completed_at,
            processing_stage: response.data.processing_stage,
            error_message: response.data.error_message,
            updated_at: response.data.updated_at
          }
          return newFiles
        }
      )

      if (import.meta.env.DEV) {
    if (import.meta.env.DEV) {
      console.log(`[useTranscriptionStatus] File ${fileId} status:`, response.data.status)
    }
      }

      const raw = response.data

      const statusValue = typeof raw.status === 'string' ? raw.status.toLowerCase() : 'pending'
      const normalizedStatus: TranscriptionStatus['status'] =
        statusValue === 'processing' ||
        statusValue === 'completed' ||
        statusValue === 'failed' ||
        statusValue === 'pending'
          ? (statusValue as TranscriptionStatus['status'])
          : 'pending'

      let normalizedProgress = typeof raw.progress === 'number' ? raw.progress : 0
      if (normalizedProgress > 1) {
        normalizedProgress = normalizedProgress / 100
      }
      normalizedProgress = Math.min(Math.max(normalizedProgress, 0), 1)

      const stageFromError =
        typeof raw.error_message === 'string' && raw.error_message.startsWith('Stage: ')
          ? raw.error_message.slice(7)
          : null
      const normalizedStage = raw.processing_stage ?? stageFromError

      return {
        ...raw,
        status: normalizedStatus,
        progress: normalizedProgress,
        processing_stage: normalizedStage ?? undefined,
        error_message: stageFromError ? undefined : raw.error_message ?? undefined,
      }
    },
    enabled: !!fileId,
    // CRITICAL FIX: Use longer staleTime for completed/failed to reduce flickering
    staleTime: (query) => {
      const status = query.state.data?.status
      // Completed/failed files: consider fresh for 30 seconds
      if (status === 'completed' || status === 'failed') {
        return 30000
      }
      // Processing: give backend 1 second to start processing (reduces race condition)
      if (status === 'processing') {
        return 1000
      }
      // Pending: always stale (fetch every time)
      return 0
    },
    gcTime: 30000, // Keep in cache for 30 seconds (was 0)
    refetchInterval: (query) => {
      const status = query.state.data?.status
      const processingStage = query.state.data?.processing_stage

      // Poll every 2 seconds while processing
      if (pollInterval && status === 'processing') {
        return pollInterval
      }

      // CRITICAL FIX: Also poll if status is pending but there's a processing_stage
      // This handles cases where the backend was restarted mid-transcription
      if (pollInterval && status === 'pending' && processingStage &&
          (processingStage.includes('loading') || processingStage.includes('queued'))) {
        return pollInterval
      }

      // When status changes from processing to completed/failed, do one final poll
      // to ensure UI gets the latest status
      if (pollInterval && status && status !== 'processing') {
        // Return false to stop polling, but React Query will do one final fetch
        return false
      }
      return false
    },
    // CRITICAL FIX: Only refetch on mount for processing files, not completed
    refetchOnMount: (query) => {
      const status = query.state.data?.status
      return status === 'processing' || status === 'pending' ? 'always' : false
    },
    // CRITICAL FIX: Don't refetch completed files on focus to prevent flickering
    refetchOnWindowFocus: (query) => {
      const status = query.state.data?.status
      return status === 'processing' || status === 'pending'
    },
    refetchOnReconnect: true, // Refetch when reconnecting (always good to check)
  })

  // Handle transcription completion side effects with debouncing to prevent flickering
  useEffect(() => {
    if (query.data?.status === 'completed') {
      if (import.meta.env.DEV) {
        console.log(`[useTranscriptionStatus] Transcription completed for file ${fileId} - scheduling delayed invalidation`)
      }
      
      // Debounce invalidations to prevent cascading re-renders during batch processing
      const timer = setTimeout(() => {
        // Only invalidate related queries, NOT the status query itself
        queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
        queryClient.invalidateQueries({ queryKey: ['speakers', fileId, 'v3'] })
        
        // Don't invalidate files query immediately to prevent flickering
        // It will be updated via optimistic updates in the file list
        if (import.meta.env.DEV) {
          console.log(`[useTranscriptionStatus] Delayed invalidation completed for file ${fileId}`)
        }
      }, 1000) // 1 second delay to allow UI to stabilize

      return () => clearTimeout(timer)
    }
  }, [query.data?.status, queryClient, fileId])

  // Cleanup on unmount - cancel ongoing queries
  useEffect(() => {
    return () => {
      if (fileId && import.meta.env.DEV) {
        console.log(`[useTranscriptionStatus] Cleanup - cancelling queries for file ${fileId}`)
      }
      // Cancel any ongoing queries when component unmounts
      queryClient.cancelQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
    }
  }, [fileId, queryClient])

  return query
}

export const useSegments = (fileId: number | null) => {
  return useQuery({
    // Enhanced cache key with version for isolation
    queryKey: ['segments', fileId, 'v3'],
    queryFn: async (): Promise<Segment[]> => {
      if (!fileId) {
        if (import.meta.env.DEV) {
          console.log(`[useSegments] No fileId provided, returning empty array`)
        }
        return []
      }

      if (import.meta.env.DEV) {
        console.log(`[useSegments] Fetching segments for file ${fileId}`)
      }

      try {
        const response = await apiClient.get<Segment[]>(`/api/transcription/${fileId}/segments`)
      if (import.meta.env.DEV) {
        console.log(`[useSegments] File ${fileId} returned ${response.data.length} segments:`, response.data)
      }
        return response.data
      } catch (error) {
        console.error(`[useSegments] Error fetching segments for file ${fileId}:`, error)
        throw error
      }
    },
    enabled: !!fileId,
    staleTime: 5000, // Consider data fresh for 5 seconds
    gcTime: 10000, // Keep in cache for 10 seconds
  })
}

export const useSpeakers = (fileId: number | null) => {
  return useQuery({
    // Enhanced cache key with version for isolation
    queryKey: ['speakers', fileId, 'v3'],
    queryFn: async (): Promise<Speaker[]> => {
      if (!fileId) return []

      if (import.meta.env.DEV) {
      if (import.meta.env.DEV) {
        console.log(`[useSpeakers] Fetching speakers for file ${fileId}`)
      }
      }

      const response = await apiClient.get<Speaker[]>(`/api/transcription/${fileId}/speakers`)

      if (import.meta.env.DEV) {
      if (import.meta.env.DEV) {
        console.log(`[useSpeakers] File ${fileId} returned ${response.data.length} speakers`)
      }
      }

      return response.data
    },
    enabled: !!fileId,
    staleTime: 5000, // Consider data fresh for 5 seconds
    gcTime: 10000, // Keep in cache for 10 seconds
  })
}

export const useUpdateSegment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      segmentId,
      editedText,
      isPassive,
    }: {
      segmentId: number
      editedText?: string
      isPassive?: boolean
    }) => {
      const payload: Record<string, unknown> = {}
      if (editedText !== undefined) {
        payload.edited_text = editedText
      }
      if (isPassive !== undefined) {
        payload.is_passive = isPassive
      }

      if (Object.keys(payload).length === 0) {
        throw new Error('No updates provided for segment')
      }

      const response = await apiClient.patch(`/api/transcription/segment/${segmentId}`, payload)
      return response.data
    },
    onSuccess: () => {
      // Update the segment in the cache
      queryClient.invalidateQueries({ queryKey: ['segments'] })
    },
  })
}

export const useBulkUpdateSegmentPassive = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      segmentIds,
      isPassive,
    }: {
      segmentIds: number[]
      isPassive: boolean
    }) => {
      const response = await apiClient.post('/api/transcription/segments/passive', {
        segment_ids: segmentIds,
        is_passive: isPassive,
      })
      return response.data as Segment[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] })
    },
  })
}

export const useJoinSegments = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      segmentIds,
      maxGapSeconds,
    }: {
      segmentIds: number[]
      maxGapSeconds?: number
    }) => {
      const response = await apiClient.post<Segment>('/api/transcription/segments/join', {
        segment_ids: segmentIds,
        max_gap_seconds: maxGapSeconds,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] })
    },
  })
}

export const useDeleteSegment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (segmentId: number): Promise<Segment[]> => {
      const response = await apiClient.delete<{ segments: Segment[] }>(
        `/api/transcription/segments/${segmentId}`
      )
      return response.data.segments
    },
    onSuccess: (segments) => {
      queryClient.setQueriesData<Segment[] | undefined>({ queryKey: ['segments'] }, () => segments)
    },
  })
}

export const useInsertSegment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      segmentId,
      direction,
    }: {
      segmentId: number
      direction: 'above' | 'below'
    }): Promise<Segment> => {
      const response = await apiClient.post<Segment>(
        `/api/transcription/segment/${segmentId}/insert`,
        {
          direction,
        }
      )
      return response.data
    },
    onSuccess: (segment) => {
      queryClient.setQueriesData<Segment[] | undefined>({ queryKey: ['segments'] }, (current) => {
        if (!current) return current
        const insertIndex = current.findIndex((item) => item.sequence >= segment.sequence)
        const next = [...current]
        if (insertIndex === -1) {
          next.push(segment)
        } else {
          next.splice(insertIndex, 0, segment)
        }
        return next.map((item, index) => ({ ...item, sequence: index }))
      })
    },
  })
}

interface SplitBatchChunkResult {
  file_id: number
  original_filename: string
  duration: number
  order_index: number
  chunk_label?: string | null
  chunk_total?: number | null
  split_start_seconds?: number | null
  split_end_seconds?: number | null
  parent_file_id?: number | null
  transcription_requested: boolean
  started_immediately: boolean
}

interface SplitBatchResponse {
  parent_file_id: number
  created_files: SplitBatchChunkResult[]
}

export const useSplitAndBatchTranscribe = (projectId: number | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      fileId,
      chunkDurationSeconds,
      overlapSeconds = 0,
      startTranscription = true,
      includeDiarization = true,
      modelSize,
      language,
    }: {
      fileId: number
      chunkDurationSeconds: number
      overlapSeconds?: number
      startTranscription?: boolean
      includeDiarization?: boolean
      modelSize?: string
      language?: string | null
    }): Promise<SplitBatchResponse> => {
      const response = await apiClient.post<SplitBatchResponse>(
        `/api/transcription/${fileId}/split-batch`,
        {
          chunk_duration_seconds: chunkDurationSeconds,
          overlap_seconds: overlapSeconds,
          start_transcription: startTranscription,
          include_diarization: includeDiarization,
          model_size: modelSize,
          language,
        }
      )
      return response.data
    },
    onSuccess: async (_data, variables) => {
      // Small delay to ensure backend has processed the split completely
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['files', projectId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['files'] })
      }
      queryClient.invalidateQueries({ queryKey: ['segments', variables.fileId, 'v3'] })
    },
  })
}

export const useUpdateSpeaker = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ speakerId, displayName }: { speakerId: number; displayName: string }) => {
      const response = await apiClient.put(`/api/transcription/speaker/${speakerId}`, {
        display_name: displayName,
      })
      return response.data
    },
    onSuccess: () => {
      // Update speakers and segments (since segments display speaker names)
      queryClient.invalidateQueries({ queryKey: ['speakers'] })
      queryClient.invalidateQueries({ queryKey: ['segments'] })
    },
  })
}

export const useClearTranscription = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiClient.delete(`/api/transcription/${fileId}/clear`)
      return response.data
    },
    onSuccess: (_, fileId: number) => {
      // Immediately update the transcription status cache to reflect cleared state
      queryClient.setQueryData(['transcription-status', fileId, 'v3'], (oldData: TranscriptionStatus | undefined) => {
        if (!oldData) return oldData
        
        return {
          ...oldData,
          status: 'pending' as const,
          progress: 0,
          error_message: null,
          processing_stage: null,
          transcription_started_at: undefined,
          transcription_completed_at: undefined,
          segment_count: 0
        }
      })
      
      // Update files cache to reflect cleared state
      queryClient.setQueriesData<AudioFile[] | undefined>(
        { queryKey: ['files'] },
        (oldFiles: AudioFile[] | undefined) => {
          if (!oldFiles) return oldFiles
          
          return oldFiles.map(file => 
            file.file_id === fileId
              ? {
                  ...file,
                  status: 'pending' as const,
                  transcription_started_at: undefined,
                  transcription_completed_at: undefined,
                  processing_stage: undefined,
                  error_message: undefined
                }
              : file
          )
        }
      )
      
      // Clear segments and speakers cache
      queryClient.setQueryData(['segments', fileId, 'v3'], [])
      queryClient.setQueryData(['speakers', fileId], [])
      
      // Invalidate all related data for this file to ensure fresh fetch
      queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['speakers', fileId] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
  })
}
