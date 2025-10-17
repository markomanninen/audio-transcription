import axios from 'axios'

// Dynamic port configuration based on environment
function getBackendUrl(): string {
  // VITE_API_BASE_URL MUST be set by the dev environment
  if (!import.meta.env.VITE_API_BASE_URL) {
    const error = 'FATAL: VITE_API_BASE_URL environment variable not set. Run via dev_runner.py or set VITE_API_BASE_URL manually.'
    console.error(error)
    throw new Error(error)
  }
  
  console.log('Using VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
  return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
}

export const API_BASE_URL = getBackendUrl()

// Debug logging
console.log('API_BASE_URL configured as:', API_BASE_URL)

// Circuit breaker state
let isBackendDown = false
let lastFailureTime = 0
let consecutiveFailures = 0
const CIRCUIT_BREAKER_THRESHOLD = 3 // Trips after 3 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 5000 // 5 seconds - quick recovery for restarts

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Increased timeout for CPU-intensive transcription operations
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor for debugging and circuit breaker
apiClient.interceptors.request.use(
  (config) => {
    // Circuit breaker: block requests if backend is down and cooldown hasn't passed
    if (isBackendDown && Date.now() - lastFailureTime < CIRCUIT_BREAKER_TIMEOUT) {
      return Promise.reject(new Error('Backend temporarily unavailable (circuit breaker)'))
    }
    
    console.log('API Request:', config.method?.toUpperCase(), config.url, 'Base URL:', config.baseURL)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling and circuit breaker
apiClient.interceptors.response.use(
  (response) => {
    // Reset circuit breaker on successful response
    if (isBackendDown) {
      console.log('Backend recovered - resetting circuit breaker')
      isBackendDown = false
      consecutiveFailures = 0
    }
    return response
  },
  (error) => {
    // Track failures for circuit breaker - be more lenient during transcription
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || 
        error.response?.status >= 500 || !error.response) {
      consecutiveFailures++
      lastFailureTime = Date.now()
      
      // Only trip circuit breaker if we have many failures and recent ones
      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && 
          Date.now() - lastFailureTime < 60000) { // Within last minute
        isBackendDown = true
        console.warn(`Backend marked as down after ${consecutiveFailures} failures`)
      }
    } else {
      // Reset consecutive failures on non-network errors (e.g., 404, 400)
      consecutiveFailures = Math.max(0, consecutiveFailures - 1)
    }
    
    // Enhanced error handling for common issues
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - server may be restarting')
      error.message = 'Request timed out. Please try again.'
    } else if (error.code === 'ERR_NETWORK') {
      console.error('Network error - server may be unavailable')
      error.message = 'Server unavailable. Please check your connection.'
    } else if (error.message === 'Backend temporarily unavailable (circuit breaker)') {
      // Don't log circuit breaker blocks to reduce noise
    } else {
      console.error('API Error:', error.response?.data || error.message)
    }
    return Promise.reject(error)
  }
)

// Export circuit breaker state for components to check
export const getBackendStatus = () => ({
  isDown: isBackendDown,
  lastFailureTime,
  consecutiveFailures
})

// Function to manually reset circuit breaker
export const resetCircuitBreaker = () => {
  isBackendDown = false
  consecutiveFailures = 0
  lastFailureTime = 0
  console.log('Circuit breaker manually reset')
}

// Expose reset function globally for debugging
if (typeof window !== 'undefined') {
  (window as any).resetCircuitBreaker = resetCircuitBreaker
}

export default apiClient
