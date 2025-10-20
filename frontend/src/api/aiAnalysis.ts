/**
 * AI project analysis API client
 */
import { apiClient } from './client'

export interface ProjectAnalysisResponse {
  suggested_content_type: string
  confidence: number
  reasoning: string
  suggested_description?: string
}

/**
 * Analyze project content and get AI suggestions
 */
export const analyzeProject = async (
  projectId: number,
  provider: string = 'ollama'
): Promise<ProjectAnalysisResponse> => {
  const response = await apiClient.post(
    `/api/ai/analyze/project/${projectId}`,
    null,
    { params: { provider } }
  )
  return response.data
}

export interface ApplyAnalysisResponse {
  success: boolean
  message?: string
  updated_fields?: string[]
}

/**
 * Apply AI suggestions to project
 */
export const applyAnalysis = async (
  projectId: number,
  contentType: string,
  description?: string
): Promise<ApplyAnalysisResponse> => {
  const response = await apiClient.post(
    `/api/ai/analyze/project/${projectId}/apply`,
    null,
    {
      params: {
        content_type: contentType,
        description: description || undefined,
      },
    }
  )
  return response.data
}
