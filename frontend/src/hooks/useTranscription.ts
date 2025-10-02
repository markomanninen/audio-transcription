import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { TranscriptionStatus, Segment, Speaker } from '../types'

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
      const response = await apiClient.post(`/api/transcription/${fileId}/start`, {
        include_diarization: includeDiarization,
      })
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transcription-status', variables.fileId] })
    },
  })
}

export const useTranscriptionStatus = (fileId: number | null, pollInterval?: number) => {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['transcription-status', fileId],
    queryFn: async (): Promise<TranscriptionStatus> => {
      if (!fileId) throw new Error('No file ID')
      const response = await apiClient.get<TranscriptionStatus>(
        `/api/transcription/${fileId}/status`
      )
      return response.data
    },
    enabled: !!fileId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Poll every 2 seconds while processing
      if (pollInterval && status === 'processing') {
        return pollInterval
      }
      return false
    },
    onSuccess: (data) => {
      // When transcription completes, invalidate related queries
      if (data.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: ['segments', fileId] })
        queryClient.invalidateQueries({ queryKey: ['speakers', fileId] })
        queryClient.invalidateQueries({ queryKey: ['files'] })
      }
    },
  })
}

export const useSegments = (fileId: number | null) => {
  return useQuery({
    queryKey: ['segments', fileId],
    queryFn: async (): Promise<Segment[]> => {
      if (!fileId) return []
      console.log('Fetching segments for file:', fileId)
      const response = await apiClient.get<Segment[]>(`/api/transcription/${fileId}/segments`)
      console.log('Segments response:', response.data)
      return response.data
    },
    enabled: !!fileId,
    staleTime: 10000, // Consider data fresh for 10 seconds
  })
}

export const useSpeakers = (fileId: number | null) => {
  return useQuery({
    queryKey: ['speakers', fileId],
    queryFn: async (): Promise<Speaker[]> => {
      if (!fileId) return []
      const response = await apiClient.get<Speaker[]>(`/api/transcription/${fileId}/speakers`)
      return response.data
    },
    enabled: !!fileId,
  })
}
