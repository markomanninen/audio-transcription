import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useWhisperProgress } from './useWhisperProgress'

export interface SystemHealthStatus {
  status: 'healthy' | 'starting' | 'unhealthy'
  version: string
  components: {
    api: { status: string; message: string }
    database: { status: string; message: string }
    whisper: { 
      status: string; 
      message: string;
      progress?: number;
      downloaded?: string;
      total?: string;
      speed?: string;
      model_size?: string;
    }
    ollama: { status: string; message: string }
    redis: { status: string; message: string }
    storage: { status: string; message: string }
  }
  critical: string[]
  optional: string[]
}

export function useSystemHealth() {
  return useQuery<SystemHealthStatus>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await apiClient.get<SystemHealthStatus>('/health')
      return response.data
    },
    refetchInterval: (query) => {
      const data = query.state.data
      // More frequent checks if system is starting up or unhealthy
      if (!data || data.status === 'starting' || data.status === 'unhealthy') {
        return 2000 // 2 seconds
      }
      // If database is busy (transcription in progress), reduce polling frequency
      if (data.components?.database?.status === 'busy') {
        return 15000 // 15 seconds during transcription to reduce load
      }
      return 10000 // 10 seconds for healthy system
    },
    retry: (failureCount) => {
      // Keep retrying during startup, but with backoff
      if (failureCount < 20) {
        return true
      }
      return false
    },
    retryDelay: (attemptIndex) => {
      // Progressive backoff: 1s, 2s, 4s, 8s, then 10s
      return Math.min(1000 * Math.pow(2, attemptIndex), 10000)
    }
  })
}

export function useBackendReadiness() {
  const { data: health, isLoading, error } = useSystemHealth()
  const { data: whisperProgress } = useWhisperProgress()
  
  const isReady = health?.status === 'healthy'
  const isStarting = health?.status === 'starting'
  const isUnhealthy = health?.status === 'unhealthy'
  
  // Consider system ready even if database is busy (during transcription)
  const isDatabaseBusy = health?.components?.database?.status === 'busy'
  const isEffectivelyReady = isReady || (health?.status !== 'unhealthy' && isDatabaseBusy)
  
  const whisperStatus = health?.components?.whisper
  
  // Enhanced Whisper loading detection - show splash for downloading OR loading with model info
  const hasActualWhisperProgress = whisperProgress && typeof whisperProgress.progress === 'number'
  const backendReportsWhisperDownloading = whisperStatus?.status === 'downloading'
  const backendReportsWhisperLoading = whisperStatus?.status === 'loading'
  
  const isWhisperLoading = backendReportsWhisperDownloading || hasActualWhisperProgress || backendReportsWhisperLoading
  
  // Enhanced whisper message with progress and model info
  let whisperMessage = whisperStatus?.message
  const modelSize = whisperStatus?.model_size || 'unknown'
  
  if (whisperProgress) {
    whisperMessage = `Downloading ${modelSize} model... ${whisperProgress.progress}%`
  } else if (backendReportsWhisperLoading) {
    whisperMessage = `Loading ${modelSize} model into memory... (this may take several minutes)`
  } else if (isWhisperLoading && !whisperMessage) {
    whisperMessage = 'Loading AI components...'
  }
  
  return {
    isReady: isEffectivelyReady,  // Use the enhanced ready state
    isStarting,
    isUnhealthy,
    isLoading,
    error,
    health: health || (whisperProgress ? {
      status: 'starting' as const,
      version: 'unknown',
      components: {
        api: { status: 'starting', message: 'Starting...' },
        database: { status: 'starting', message: 'Starting...' },
        whisper: { 
          status: 'starting', 
          message: `Downloading AI model... ${whisperProgress.progress}%`,
          progress: whisperProgress.progress,
          downloaded: whisperProgress.downloaded,
          total: whisperProgress.total,
          speed: whisperProgress.speed
        },
        ollama: { status: 'starting', message: 'Starting...' },
        redis: { status: 'starting', message: 'Starting...' },
        storage: { status: 'starting', message: 'Starting...' }
      },
      critical: [],
      optional: []
    } : health),
    isWhisperLoading,
    whisperMessage
  }
}