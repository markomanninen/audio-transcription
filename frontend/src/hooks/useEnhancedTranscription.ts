import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'

export interface EnhancedTranscriptionStatus {
  file_id: number
  filename: string
  status: string
  progress: number
  segments_created: number
  can_resume: boolean
  is_stuck: boolean
  error_message?: string
  started_at?: string
  duration?: number
  transcription_stage: string
  last_processed_segment: number
  audio_transformed: boolean
  audio_transformation_path?: string
  whisper_model_loaded?: string
  resume_token?: string
  interruption_count: number
  recovery_attempts: number
  last_error_at?: string
  checkpoint: {
    stage: string
    segment_index: number
    metadata: Record<string, unknown>
  }
  transcription_metadata?: string
}

export interface TranscriptionActionResult {
  action: string
  message: string
  segments?: number
  deleted_segments?: number
  new_segments?: number
}

// Enhanced status hook with detailed information
export const useEnhancedTranscriptionStatus = (fileId: number, pollInterval?: number) => {
  return useQuery({
    queryKey: ['enhanced-transcription-status', fileId],
    queryFn: async (): Promise<EnhancedTranscriptionStatus> => {
      const response = await apiClient.get(`/api/transcription/${fileId}/status`)
      return response.data
    },
    refetchInterval: pollInterval,
    enabled: !!fileId,
  })
}

// Smart transcription action hook
export const useTranscriptionAction = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      fileId,
      action = 'auto',
    }: {
      fileId: number
      action?: 'auto' | 'resume' | 'restart' | 'continue'
    }): Promise<TranscriptionActionResult> => {
      const response = await apiClient.post(`/api/transcription/${fileId}/action`, null, {
        params: { action }
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries after action
      queryClient.invalidateQueries({ queryKey: ['enhanced-transcription-status', variables.fileId] })
      queryClient.invalidateQueries({ queryKey: ['transcription-status', variables.fileId] })
      queryClient.invalidateQueries({ queryKey: ['segments', variables.fileId] })
    },
  })
}

// Force restart hook
export const useForceRestart = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiClient.post(`/api/transcription/${fileId}/action?action=restart`)
      return response.data
    },
    onSuccess: (_, fileId) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-transcription-status', fileId] })
      queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId] })
      queryClient.invalidateQueries({ queryKey: ['segments', fileId] })
    },
  })
}

// Resume transcription hook
export const useResumeTranscription = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fileId: number): Promise<TranscriptionActionResult> => {
      const response = await apiClient.post(`/api/transcription/${fileId}/action?action=resume`)
      return response.data
    },
    onSuccess: (_, fileId) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-transcription-status', fileId] })
      queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId] })
      queryClient.invalidateQueries({ queryKey: ['segments', fileId] })
    },
  })
}