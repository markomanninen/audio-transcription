import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Project } from '../types'

interface CreateProjectRequest {
  name: string
  description?: string
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
      const response = await apiClient.post<Project>('/api/upload/project', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
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
      const response = await apiClient.put<Project>(`/api/upload/project/${projectId}`, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] })
    },
  })
}
