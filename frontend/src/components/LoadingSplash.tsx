import { useEffect, useMemo, useState } from 'react'
import { useBackendReadiness } from '../hooks/useSystemHealth'

interface LoadingSplashProps {
  children: React.ReactNode
}

export function LoadingSplash({ children }: LoadingSplashProps) {
  const {
    isUiReady,
    isStarting,
    isUnhealthy,
    isLoading,
    error,
    health,
    isWhisperLoading,
    whisperMessage,
  } = useBackendReadiness()

  const [showSplash, setShowSplash] = useState(true)
  const [hasBeenReady, setHasBeenReady] = useState(false)

  useEffect(() => {
    if (isUiReady && !hasBeenReady) {
      setHasBeenReady(true)
      const timer = setTimeout(() => setShowSplash(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [isUiReady, hasBeenReady])

  const whisperUiState = useMemo(() => {
    if (!health?.components?.whisper) {
      return null
    }

    const whisper = health.components.whisper
    const progressValue =
      typeof whisper.progress === 'number' && whisper.progress > 0 ? whisper.progress : undefined
    const downloadComplete = progressValue !== undefined && progressValue >= 100

    if (progressValue !== undefined && !downloadComplete) {
      return {
        mode: 'download' as const,
        progress: progressValue,
        downloaded: whisper.downloaded ?? '0MB',
        total: whisper.total ?? 'Unknown',
        speed: whisper.speed ?? 'Calculating...',
        model: whisper.model_size ?? 'unknown',
        message: whisperMessage || 'Downloading Whisper model...',
      }
    }

    const defaultMessage = downloadComplete
      ? 'Model download complete. Finalizing load into memory...'
      : 'Loading Whisper model into memory... (this may take several minutes)'

    return {
      mode: 'loading' as const,
      model: whisper.model_size ?? 'unknown',
      message:
        typeof whisperMessage === 'string' && whisperMessage.length > 0
          ? whisperMessage
          : defaultMessage,
    }
  }, [health?.components?.whisper, whisperMessage])

  // Once the UI has been ready once, never show splash again (prevents flickering during transcription)
  const shouldShowSplash =
    showSplash && !hasBeenReady && (isLoading || isStarting || (isUnhealthy && !isUiReady) || (!!error && !isUiReady))

  if (!shouldShowSplash) {
    return <>{children}</>
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center"
      data-testid="loading-splash"
    >
      <div className="text-center max-w-md mx-auto px-6">
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
            <span className="text-white text-2xl font-bold">🎵</span>
          </div>
          <div className="absolute inset-0 w-20 h-20 bg-blue-600 rounded-full mx-auto opacity-20 animate-ping"></div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Audio Transcription</h1>

        {isWhisperLoading && whisperUiState && (
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                  {whisperUiState.mode === 'download' ? 'AI Model Download' : 'AI Model Loading'}
                </span>
              </div>

              {whisperUiState.mode === 'download' ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-yellow-700 dark:text-yellow-300">
                    <span>Progress: {whisperUiState.progress}%</span>
                    <span>
                      {whisperUiState.downloaded} / {whisperUiState.total}
                    </span>
                  </div>
                  <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
                    <div
                      className="bg-yellow-600 dark:bg-yellow-400 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${whisperUiState.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-yellow-600 dark:text-yellow-400">
                    <span>Speed: {whisperUiState.speed}</span>
                    <span>Whisper model: {whisperUiState.model}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-yellow-700 dark:text-yellow-300">
                    <span>
                      Model:{' '}
                      <span className="font-bold">{whisperUiState.model.toUpperCase()}</span>
                    </span>
                    <span>
                      Status: <span className="font-bold">LOADING</span>
                    </span>
                  </div>
                  <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 dark:from-yellow-400 dark:via-yellow-300 dark:to-yellow-400 h-3 rounded-full animate-pulse w-full"></div>
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                    {whisperUiState.message}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isWhisperLoading && isLoading && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">Connecting to backend...</p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}

        {isStarting && health && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm mt-5">
              {Object.entries(health.components).map(([name, component]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="capitalize text-gray-600 dark:text-gray-400">{name}:</span>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        component.status === 'up'
                          ? 'bg-green-500'
                          : component.status === 'loading'
                            ? 'bg-yellow-500 animate-pulse'
                            : 'bg-red-500'
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        component.status === 'up'
                          ? 'text-green-600 dark:text-green-400'
                          : component.status === 'loading'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {component.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}

        {isUnhealthy && health && (
          <div className="space-y-4">
            <p className="text-red-600 dark:text-red-400 font-medium">
              System experiencing issues...
            </p>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300 text-sm">
                Some critical components are not responding. The system will continue trying to
                connect.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <p className="text-orange-600 dark:text-orange-400 font-medium">
              Connecting to backend...
            </p>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-orange-700 dark:text-orange-300 text-sm">
                Backend is starting up. This usually takes 30-60 seconds.
              </p>
              <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                If this persists, check that Docker containers are running.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoadingSplashWrapper(props: LoadingSplashProps) {
  return <LoadingSplash {...props} />
}
