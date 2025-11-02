/**
 * AI correction API client
 */
import { apiClient } from './client'

export interface CorrectionRequest {
  segment_id: number
  provider?: string
  model?: string
  correction_type?: string
  timeout?: number
}

export interface BatchCorrectionRequest {
  segment_ids: number[]
  provider?: string
  model?: string
  correction_type?: string
  timeout?: number
}

export interface CorrectionResponse {
  segment_id: number
  original_text: string
  corrected_text: string
  changes: string[]
  confidence: number
}

export interface ProviderInfo {
  name: string
  available: boolean
}

/**
 * Correct a single segment
 */
export const correctSegment = async (
  request: CorrectionRequest
): Promise<CorrectionResponse> => {
  const response = await apiClient.post('/api/ai/correct-segment', request)
  return response.data
}

/**
 * Correct multiple segments
 */
export const correctBatch = async (
  request: BatchCorrectionRequest
): Promise<CorrectionResponse[]> => {
  const response = await apiClient.post('/api/ai/correct-batch', request)
  return response.data
}

/**
 * List available LLM providers
 */
export const listProviders = async (): Promise<ProviderInfo[]> => {
  const response = await apiClient.get('/api/ai/providers')
  return response.data
}

/**
 * Check health of LLM providers
 */
export const checkProviderHealth = async (): Promise<Record<string, boolean>> => {
  const response = await apiClient.get('/api/ai/health')
  return response.data
}

/**
 * List available models for a provider
 */
export const listModels = async (provider: string): Promise<string[]> => {
  const response = await apiClient.get(`/api/ai/models/${provider}`)
  return response.data
}

/**
 * Check if a model is available for a provider
 */
export const checkModelAvailability = async (
  provider: string,
  model: string
): Promise<{ available: boolean }> => {
  const response = await apiClient.get(`/api/ai/models/${provider}/${model}/check`)
  return response.data
}
