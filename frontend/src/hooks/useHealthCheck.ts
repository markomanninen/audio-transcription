import { useQuery } from '@tanstack/react-query'
import { apiClient, getBackendStatus } from '../api/client'

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await apiClient.get('/health')
      return response.data
    },
    retry: (failureCount, error) => {
      // Don't retry if circuit breaker is active
      if (error.message?.includes('circuit breaker')) {
        return false
      }
      // Retry up to 3 times
      return failureCount < 3
    },
    retryDelay: 2000, // 2 second delay between retries
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
    refetchInterval: () => {
      // Only auto-refetch if backend is down (to detect recovery)
      const { isDown } = getBackendStatus()
      return isDown ? 15000 : false // Check every 15 seconds if down
    }
  })
}

export function useAppReadiness() {
  const healthCheck = useHealthCheck()
  const { isDown } = getBackendStatus()
  
  // App is ready when health check succeeds and circuit breaker is not active
  return {
    isReady: healthCheck.isSuccess && !isDown,
    isLoading: healthCheck.isLoading,
    error: healthCheck.error,
    isBackendDown: isDown
  }
}