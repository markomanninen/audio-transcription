/**
 * React Query hooks for AI corrections
 */
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  correctSegment,
  correctBatch,
  listProviders,
  checkProviderHealth,
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
