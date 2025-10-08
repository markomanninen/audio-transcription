import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Project } from '../types'

interface CreateProjectRequest {
  name: string
  description?: string
  content_type?: string
}

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<Project[]> => {
      const response = await apiClient.get<Project[]>('/api/upload/projects')
      return response.data
    },
  })
}

export const useProject = (projectId: number | null) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<Project> => {
      if (!projectId) throw new Error('No project ID')
      const response = await apiClient.get<Project>(`/api/upload/project/${projectId}`)
      return response.data
    },
    enabled: !!projectId,
  })
}

export const useCreateProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateProjectRequest): Promise<Project> => {
      try {
        const response = await apiClient.post<Project>('/api/upload/project', data)
        return response.data
      } catch (error: any) {
        // Enhanced error handling
        if (error.code === 'ECONNABORTED') {
          throw new Error('Create operation timed out. The server may be restarting. Please try again.')
        }
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (error: Error) => {
      console.error('Project creation failed:', error.message)
    },
    // Add retry configuration
    retry: (failureCount, error: any) => {
      // Retry network errors and timeouts up to 2 times
      if ((error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') && failureCount < 2) {
        return true
      }
      return false
    },
    retryDelay: 2000, // Wait 2 seconds between retries
  })
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      data
    }: {
      projectId: number
      data: CreateProjectRequest
    }): Promise<Project> => {
      try {
        const response = await apiClient.put<Project>(`/api/upload/project/${projectId}`, data)
        return response.data
      } catch (error: any) {
        // Enhanced error handling
        if (error.code === 'ECONNABORTED') {
          throw new Error('Save operation timed out. The server may be restarting. Please try again.')
        }
        throw error
      }
    },
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] })
    },
    onError: (error: Error) => {
      console.error('Project update failed:', error.message)
    },
    // Add retry configuration
    retry: (failureCount, error: any) => {
      // Retry network errors and timeouts up to 2 times
      if ((error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') && failureCount < 2) {
        return true
      }
      return false
    },
    retryDelay: 2000, // Wait 2 seconds between retries
  })
}

export const useDeleteProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectId: number): Promise<void> => {
      await apiClient.delete(`/api/upload/project/${projectId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
