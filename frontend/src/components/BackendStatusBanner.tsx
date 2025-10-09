import { useEffect, useState } from 'react'
import { getBackendStatus } from '../api/client'
import { useSystemHealth } from '../hooks/useSystemHealth'

export function BackendStatusBanner() {
  const [clientStatus, setClientStatus] = useState(getBackendStatus())
  const { data: health, error } = useSystemHealth()

  useEffect(() => {
    const interval = setInterval(() => {
      setClientStatus(getBackendStatus())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Show banner for various non-healthy states
  const shouldShow = clientStatus.isDown || 
                    health?.status === 'starting' || 
                    health?.status === 'unhealthy' ||
                    error

  if (!shouldShow) return null

  const secondsSinceFailure = Math.floor((Date.now() - clientStatus.lastFailureTime) / 1000)

  // Different states for different situations
  if (health?.status === 'starting') {
    const whisperStatus = health.components?.whisper
    const isWhisperLoading = whisperStatus?.status === 'loading'
    
    return (
      <div className="bg-yellow-600 text-white px-4 py-2 text-center text-sm">
        <div className="flex items-center justify-center gap-2">
          <span className="animate-pulse">🔄</span>
          <span>
            {isWhisperLoading 
              ? 'AI model downloading - this may take several minutes...'
              : 'System starting up...'}
          </span>
          <span className="animate-pulse">🔄</span>
        </div>
        {isWhisperLoading && (
          <div className="text-xs mt-1 opacity-90">
            Whisper model download in progress. Please be patient.
          </div>
        )}
      </div>
    )
  }

  if (health?.status === 'unhealthy') {
    return (
      <div className="bg-red-600 text-white px-4 py-2 text-center text-sm">
        <div className="flex items-center justify-center gap-2">
          <span className="animate-pulse">🔴</span>
          <span>Critical system components are not responding</span>
          <span className="animate-pulse">🔴</span>
        </div>
        <div className="text-xs mt-1 opacity-90">
          System is attempting automatic recovery...
        </div>
      </div>
    )
  }

  if (clientStatus.isDown) {
    return (
      <div className="bg-red-600 text-white px-4 py-2 text-center text-sm">
        <div className="flex items-center justify-center gap-2">
          <span className="animate-pulse">⚠️</span>
          <span>
            Backend service is temporarily unavailable
            {secondsSinceFailure > 0 && ` (${secondsSinceFailure}s ago)`}
          </span>
          <span className="animate-pulse">⚠️</span>
        </div>
        <div className="text-xs mt-1 opacity-90">
          Requests are temporarily paused. Connection will retry automatically.
        </div>
      </div>
    )
  }

  // Connection error/loading state
  return (
    <div className="bg-orange-600 text-white px-4 py-2 text-center text-sm">
      <div className="flex items-center justify-center gap-2">
        <span className="animate-pulse">🔌</span>
        <span>Connecting to backend...</span>
        <span className="animate-pulse">🔌</span>
      </div>
      <div className="text-xs mt-1 opacity-90">
        Please wait while the system initializes.
      </div>
    </div>
  )
}