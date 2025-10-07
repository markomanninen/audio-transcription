/**
 * React Query hooks for AI project analysis
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { analyzeProject, applyAnalysis } from '../api/aiAnalysis'

/**
 * Hook to analyze project with AI
 */
export const useAnalyzeProject = () => {
  return useMutation({
    mutationFn: ({ projectId, provider }: { projectId: number; provider: string }) =>
      analyzeProject(projectId, provider),
  })
}

/**
 * Hook to apply AI analysis suggestions to project
 */
export const useApplyAnalysis = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      projectId,
      contentType,
      description,
    }: {
      projectId: number
      contentType: string
      description?: string
    }) => applyAnalysis(projectId, contentType, description),
    onSuccess: () => {
      // Invalidate project queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
