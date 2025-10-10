import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL } from '../api/client'

export interface WhisperDownloadProgress {
  progress: number
  downloaded: string
  total: string
  speed: string
}

async function getWhisperProgress(): Promise<WhisperDownloadProgress | null> {
  try {
    // Try health endpoint with AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const healthResponse = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (healthResponse.ok) {
      const health = await healthResponse.json()
      if (health.components?.whisper?.progress !== undefined) {
        return {
          progress: health.components.whisper.progress,
          downloaded: health.components.whisper.downloaded || '0MB',
          total: health.components.whisper.total || 'Unknown',
          speed: health.components.whisper.speed || 'Calculating...'
        }
      }
    }
  } catch (error) {
    // Network error or timeout - backend might be starting up
  }
  
  return null
}

export function useWhisperProgress() {
  return useQuery<WhisperDownloadProgress | null>({
    queryKey: ['whisper-progress'],
    queryFn: getWhisperProgress,
    refetchInterval: 3000, // Check every 3 seconds
    retry: false, // Don't retry on failure, just return null
    staleTime: 0, // Always fetch fresh data
    initialData: null, // Start with null instead of undefined to prevent flash
  })
}
