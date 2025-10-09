import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
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
      const response = await apiClient.post(`/api/transcription/${fileId}/action?action=auto`, {
        include_diarization: includeDiarization,
      })
      return response.data
    },
    onSuccess: (_: any, variables: { fileId: number; includeDiarization?: boolean }) => {
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
    onSuccess: (_: any, fileId: number) => {
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

      if (import.meta.env.DEV) {
        console.log(`[useTranscriptionStatus] File ${fileId} status:`, response.data.status)
      }

      return response.data
    },
    enabled: !!fileId,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't keep stale data in cache AT ALL - always fetch fresh
    refetchInterval: (query: any) => {
      const status = query.state.data?.status
      // Poll every 2 seconds while processing
      if (pollInterval && status === 'processing') {
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
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when reconnecting
  })

  // Handle transcription completion side effects and status changes
  useEffect(() => {
    const status = query.data?.status

    if (status === 'completed' || status === 'failed') {
      // When transcription finishes, force remove stale cache and refetch everything
      if (import.meta.env.DEV) {
        console.log(`[useTranscriptionStatus] Status changed to ${status}, clearing cache and refetching`)
      }

      // Remove stale cache first
      queryClient.removeQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
      queryClient.removeQueries({ queryKey: ['segments', fileId, 'v3'] })
      queryClient.removeQueries({ queryKey: ['speakers', fileId, 'v3'] })

      // Then invalidate to trigger fresh fetch
      queryClient.invalidateQueries({ queryKey: ['transcription-status', fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['segments', fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['speakers', fileId, 'v3'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['project-files'] })
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
      if (!fileId) return []

      if (import.meta.env.DEV) {
        console.log(`[useSegments] Fetching segments for file ${fileId}`)
      }

      const response = await apiClient.get<Segment[]>(`/api/transcription/${fileId}/segments`)

      if (import.meta.env.DEV) {
        console.log(`[useSegments] File ${fileId} returned ${response.data.length} segments`)
      }

      return response.data
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
        console.log(`[useSpeakers] Fetching speakers for file ${fileId}`)
      }

      const response = await apiClient.get<Speaker[]>(`/api/transcription/${fileId}/speakers`)

      if (import.meta.env.DEV) {
        console.log(`[useSpeakers] File ${fileId} returned ${response.data.length} speakers`)
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
    mutationFn: async ({ segmentId, editedText }: { segmentId: number; editedText: string }) => {
      const response = await apiClient.patch(`/api/transcription/segment/${segmentId}`, {
        edited_text: editedText,
      })
      return response.data
    },
    onSuccess: () => {
      // Update the segment in the cache
      queryClient.invalidateQueries({ queryKey: ['segments'] })
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
