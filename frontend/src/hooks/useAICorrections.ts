/**
 * React Query hooks for AI corrections
 */
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  correctSegment,
  correctBatch,
  listProviders,
  checkProviderHealth,
  listModels,
  checkModelAvailability,
  CorrectionRequest,
  BatchCorrectionRequest,
  ProviderInfo,
} from '../api/aiCorrections'

/**
 * Hook to get available LLM providers
 */
export const useProviders = () => {
  return useQuery<ProviderInfo[]>({
    queryKey: ['ai-providers'],
    queryFn: listProviders,
  })
}

/**
 * Hook to check provider health
 */
export const useProviderHealth = () => {
  return useQuery<Record<string, boolean>>({
    queryKey: ['ai-health'],
    queryFn: checkProviderHealth,
    refetchInterval: 30000, // Check every 30s
  })
}

/**
 * Hook to correct a single segment
 */
export const useCorrectSegment = () => {
  return useMutation({
    mutationFn: (request: CorrectionRequest) => correctSegment(request),
    onSuccess: () => {
      // Don't automatically invalidate - let user review and accept
      // queryClient.invalidateQueries({ queryKey: ['segments'] })
    },
  })
}

/**
 * Hook to correct multiple segments
 */
export const useCorrectBatch = () => {
  return useMutation({
    mutationFn: (request: BatchCorrectionRequest) => correctBatch(request),
    onSuccess: () => {
      // Don't automatically invalidate - let user review and accept
      // queryClient.invalidateQueries({ queryKey: ['segments'] })
    },
  })
}

/**
 * Hook to list available models for a provider
 */
export const useModels = (provider: string, enabled: boolean = true) => {
  return useQuery<string[]>({
    queryKey: ['ai-models', provider],
    queryFn: () => listModels(provider),
    enabled: enabled && !!provider,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}

/**
 * Hook to check model availability
 */
export const useModelAvailability = (provider: string, model: string, enabled: boolean = true) => {
  return useQuery<{ available: boolean }>({
    queryKey: ['ai-model-check', provider, model],
    queryFn: () => checkModelAvailability(provider, model),
    enabled: enabled && !!provider && !!model,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  })
}
