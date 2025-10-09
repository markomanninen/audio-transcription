/**
 * Frontend Recovery Utilities
 * 
 * These utilities help recover from error states when the backend comes back online.
 * This is part of the reliability improvements to handle stuck error states.
 */

import { QueryClient } from '@tanstack/react-query'

export class FrontendRecovery {
  constructor(private queryClient: QueryClient) {}

  /**
   * Clear all cached errors and retry failed queries
   * Use this when the backend comes back online after being down
   */
  async clearErrorStatesAndRetry() {
    console.log('🔄 Clearing error states and retrying failed queries...')
    
    // Clear all query caches to remove error states
    this.queryClient.clear()
    
    // Force refetch all active queries
    await this.queryClient.refetchQueries({
      type: 'active',
      stale: true
    })
    
    console.log('✅ Error states cleared and queries retried')
  }

  /**
   * Clear specific query error states
   */
  clearQueryErrors(queryKey: string[]) {
    console.log(`🔄 Clearing errors for query: ${queryKey.join(', ')}`)
    
    // Remove the cached error state
    this.queryClient.removeQueries({ queryKey })
    
    // Trigger a fresh fetch
    this.queryClient.refetchQueries({ queryKey })
  }

  /**
   * Check if the backend is responsive and clear errors if it is
   */
  async checkBackendAndRecover(baseUrl: string = 'http://localhost:8000') {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        timeout: 5000
      } as RequestInit)
      
      if (response.ok) {
        console.log('✅ Backend is healthy, clearing error states...')
        await this.clearErrorStatesAndRetry()
        return true
      }
    } catch (error) {
      console.log('❌ Backend still unavailable:', error)
      return false
    }
    
    return false
  }

  /**
   * Set up automatic recovery checks
   */
  setupAutoRecovery(intervalMs: number = 30000) {
    const checkInterval = setInterval(async () => {
      // Only run recovery if there are queries in error state
      const queryCache = this.queryClient.getQueryCache()
      const errorQueries = queryCache.getAll().filter(query => 
        query.state.status === 'error'
      )
      
      if (errorQueries.length > 0) {
        console.log(`🔍 Found ${errorQueries.length} queries in error state, checking backend...`)
        const recovered = await this.checkBackendAndRecover()
        
        if (recovered) {
          // Stop checking once we've recovered
          clearInterval(checkInterval)
        }
      }
    }, intervalMs)
    
    return () => clearInterval(checkInterval)
  }
}

/**
 * Hook to provide recovery utilities
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'

export const useRecovery = () => {
  const queryClient = useQueryClient()
  const recovery = new FrontendRecovery(queryClient)

  const clearErrorsAndRetry = useCallback(() => {
    return recovery.clearErrorStatesAndRetry()
  }, [recovery])

  const clearQueryErrors = useCallback((queryKey: string[]) => {
    return recovery.clearQueryErrors(queryKey)
  }, [recovery])

  const checkBackendAndRecover = useCallback(() => {
    return recovery.checkBackendAndRecover()
  }, [recovery])

  // Set up automatic recovery
  useEffect(() => {
    const cleanup = recovery.setupAutoRecovery()
    return cleanup
  }, [recovery])

  return {
    clearErrorsAndRetry,
    clearQueryErrors,
    checkBackendAndRecover
  }
}