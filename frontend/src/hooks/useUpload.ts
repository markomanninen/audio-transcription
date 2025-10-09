import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { AudioFile } from '../types'

export interface UploadFileParams {
  file: File
  language?: string
}

export const useUploadFile = (projectId: number) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: UploadFileParams): Promise<AudioFile> => {
      const formData = new FormData()
      formData.append('file', params.file)
      if (params.language) {
        formData.append('language', params.language)
      }

      try {
        const response = await apiClient.post<AudioFile>(
          `/api/upload/file/${projectId}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        )
        return response.data
      } catch (error: any) {
        // Enhanced error handling
        if (error.code === 'ECONNABORTED') {
          throw new Error('Upload timed out. The server may be restarting. Please try again.')
        } else if (error.code === 'ERR_NETWORK') {
          throw new Error('Upload failed: Server unavailable. Please check your connection.')
        }
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    },
    onError: (error: Error) => {
      console.error('File upload failed:', error.message)
    },
    // Add retry configuration
    retry: (failureCount, error: any) => {
      // Retry network errors and timeouts up to 2 times
      if ((error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') && failureCount < 2) {
        return true
      }
      return false
    },
    retryDelay: 3000, // Wait 3 seconds between retries for uploads
  })
}

export const useProjectFiles = (projectId: number | null) => {
  return useQuery({
    queryKey: ['files', projectId],
    queryFn: async (): Promise<AudioFile[]> => {
      if (!projectId) return []
      try {
        const response = await apiClient.get<AudioFile[]>(`/api/upload/files/${projectId}`)
        return response.data
      } catch (error: any) {
        // Enhanced error handling
        if (error.code === 'ECONNABORTED') {
          throw new Error('Failed to load files: Request timed out. The server may be restarting.')
        } else if (error.code === 'ERR_NETWORK') {
          throw new Error('Failed to load files: Server unavailable. Please check your connection.')
        }
        throw error
      }
    },
    enabled: !!projectId,
    // Add retry configuration for network errors
    retry: (failureCount, error: any) => {
      // Retry network errors and timeouts up to 3 times
      if ((error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') && failureCount < 3) {
        return true
      }
      return false
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s
    // Reduce stale time to encourage refetching after errors
    staleTime: 30000, // 30 seconds
    // Set cache time shorter to allow recovery from error states
    gcTime: 60000, // 1 minute (was cacheTime in older versions)
    // Refetch on window focus to recover from error states
    refetchOnWindowFocus: true,
  })
}
