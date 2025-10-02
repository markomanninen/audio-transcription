import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { AudioFile } from '../types'

export const useUploadFile = (projectId: number) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File): Promise<AudioFile> => {
      const formData = new FormData()
      formData.append('file', file)

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    },
  })
}

export const useProjectFiles = (projectId: number | null) => {
  return useQuery({
    queryKey: ['files', projectId],
    queryFn: async (): Promise<AudioFile[]> => {
      if (!projectId) return []
      const response = await apiClient.get<AudioFile[]>(`/api/upload/files/${projectId}`)
      return response.data
    },
    enabled: !!projectId,
  })
}
