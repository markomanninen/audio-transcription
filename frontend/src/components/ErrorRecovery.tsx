import React from 'react'
import { useRecovery } from '../utils/recovery'

interface ErrorRecoveryProps {
  onRetry?: () => void
  className?: string
}

export const ErrorRecovery: React.FC<ErrorRecoveryProps> = ({ 
  onRetry, 
  className = "" 
}) => {
  const { clearErrorsAndRetry, checkBackendAndRecover } = useRecovery()
  
  const handleRetry = async () => {
    try {
      // First check if backend is responsive
      const isBackendHealthy = await checkBackendAndRecover()
      
      if (isBackendHealthy) {
        // Backend is healthy, errors should be cleared automatically
        onRetry?.()
      } else {
        // Backend still down, just retry the specific operation
        await clearErrorsAndRetry()
        onRetry?.()
      }
    } catch (error) {
      console.error('Recovery failed:', error)
    }
  }

  return (
    <div className={`text-center space-y-4 ${className}`}>
      <div className="text-red-600 dark:text-red-400">
        <p className="font-medium">Unable to load data</p>
        <p className="text-sm text-muted-foreground mt-1">
          The server may be restarting or temporarily unavailable
        </p>
      </div>
      
      <button
        onClick={handleRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus-ring transition-colors"
      >
        <span className="inline-block w-4 h-4">🔄</span>
        Retry Connection
      </button>
      
      <div className="text-xs text-muted-foreground">
        <p>If the problem persists, try refreshing the page</p>
      </div>
    </div>
  )
}

export default ErrorRecovery