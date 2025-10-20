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
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string }
        // Enhanced error handling
        if (err.code === 'ECONNABORTED') {
          throw new Error('Upload timed out. The server may be restarting. Please try again.')
        } else if (err.code === 'ERR_NETWORK') {
          throw new Error('Upload failed: Server unavailable. Please check your connection.')
        }
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    },
    onError: (error: unknown) => {
      const err = error as Error
      console.error('File upload failed:', err.message)
    },
    // Add retry configuration
    retry: (failureCount, error: unknown) => {
      const err = error as { code?: string }
      // Retry network errors and timeouts up to 2 times
      if ((err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') && failureCount < 2) {
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
      if (import.meta.env.DEV) {
        console.log(`[useProjectFiles] Fetching files for project ${projectId}`)
      }
        const response = await apiClient.get<AudioFile[]>(`/api/upload/files/${projectId}`)
        
      if (import.meta.env.DEV) {
        console.log(`[useProjectFiles] Backend returned ${response.data.length} files:`, response.data.map(f => f.file_id))
      }
        
        // Advanced deduplication: by file_id AND by filename/time range for splits
        const uniqueFiles = new Map<string, AudioFile>()
        
        response.data.forEach((file) => {
          const normalizedStatus =
            typeof file.status === 'string'
              ? (file.status.toLowerCase() as AudioFile['status'])
              : 'pending'
          
          const normalizedFile = {
            ...file,
            status: normalizedStatus,
          }
          
          // Create a unique key based on filename and time range for split files
          // This handles cases where the same split was created multiple times
          const timeRange = file.split_start_seconds !== null && file.split_end_seconds !== null
            ? `${file.split_start_seconds}-${file.split_end_seconds}`
            : 'no-split'
          
          const uniqueKey = `${file.original_filename}:${timeRange}`
          
          // Keep the file with the highest ID (most recent) for duplicates
          const existing = uniqueFiles.get(uniqueKey)
          if (!existing || file.file_id > existing.file_id) {
            uniqueFiles.set(uniqueKey, normalizedFile)
          }
        })
        
        const result = Array.from(uniqueFiles.values()).sort((a, b) => a.file_id - b.file_id)
      if (import.meta.env.DEV) {
        console.log(`[useProjectFiles] After advanced deduplication: ${result.length} files:`, result.map(f => `${f.file_id}:${f.original_filename}`))
      }
        return result
      } catch (error: unknown) {
        const err = error as { code?: string }
        // Enhanced error handling
        if (err.code === 'ECONNABORTED') {
          throw new Error('Failed to load files: Request timed out. The server may be restarting.')
        } else if (err.code === 'ERR_NETWORK') {
          throw new Error('Failed to load files: Server unavailable. Please check your connection.')
        }
        throw error
      }
    },
    enabled: !!projectId,
    staleTime: 1000, // Consider data stale after 1 second to reduce race conditions
    gcTime: 30000, // Keep in cache for 30 seconds
    // Add retry configuration for network errors
    retry: (failureCount, error: unknown) => {
      const err = error as { code?: string }
      // Retry network errors and timeouts up to 3 times
      if ((err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') && failureCount < 3) {
        return true
      }
      return false
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s
    // Poll for updates when there are processing files (for batch transcription)
    refetchInterval: (query) => {
      const files = query.state.data
      if (!files || files.length === 0) return false

      // Check if any files are processing or pending
      const hasActiveFiles = files.some(
        (file) => file.status === 'processing' || file.status === 'pending'
      )

      // Refetch every 2 seconds if there are active files, otherwise don't poll
      return hasActiveFiles ? 2000 : false
    },
    // Refetch on window focus to recover from error states
    refetchOnWindowFocus: true,
  })
}
