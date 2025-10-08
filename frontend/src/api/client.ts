import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Circuit breaker state
let isBackendDown = false
let lastFailureTime = 0
let consecutiveFailures = 0
const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_TIMEOUT = 10000 // 10 seconds

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Reduced timeout for faster failure detection
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
    
    console.log('API Request:', config.method?.toUpperCase(), config.url)
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
    // Track failures for circuit breaker
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || 
        error.response?.status >= 500 || !error.response) {
      consecutiveFailures++
      lastFailureTime = Date.now()
      
      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        isBackendDown = true
        console.warn(`Backend marked as down after ${consecutiveFailures} failures`)
      }
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

export default apiClient
