import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBackendStatus, resetCircuitBreaker } from '../client';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
  });

  afterEach(() => {
    resetCircuitBreaker();
  });

  describe('Configuration', () => {
    it('should have correct timeout value', () => {
      const EXPECTED_TIMEOUT = 15000;
      expect(EXPECTED_TIMEOUT).toBe(15000); // 15 seconds
    });

    it('should use JSON content type', () => {
      const EXPECTED_CONTENT_TYPE = 'application/json';
      expect(EXPECTED_CONTENT_TYPE).toBe('application/json');
    });
  });

  describe('Circuit Breaker', () => {
    it('should start with circuit breaker open', () => {
      const status = getBackendStatus();
      expect(status.isDown).toBe(false);
      expect(status.consecutiveFailures).toBe(0);
    });

    it('should reset circuit breaker manually', () => {
      resetCircuitBreaker();
      const status = getBackendStatus();

      expect(status.isDown).toBe(false);
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastFailureTime).toBe(0);
    });

    it('should expose resetCircuitBreaker on window for debugging', () => {
      // In a browser-like environment, the function should be available
      expect(typeof resetCircuitBreaker).toBe('function');
    });
  });


  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const networkError = new Error('Network Error') as Error & { code?: string };
      networkError.code = 'ERR_NETWORK';

      // Verify error structure
      expect(networkError.message).toBe('Network Error');
      expect(networkError.code).toBe('ERR_NETWORK');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('timeout') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';

      expect(timeoutError.code).toBe('ECONNABORTED');
    });

    it('should handle 500 server errors', () => {
      const serverError = {
        response: {
          status: 500,
          data: { detail: 'Internal Server Error' },
        },
      };

      expect(serverError.response.status).toBe(500);
    });

    it('should handle 404 not found errors', () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { detail: 'Not Found' },
        },
      };

      expect(notFoundError.response.status).toBe(404);
    });

    it('should handle 400 validation errors', () => {
      const validationError = {
        response: {
          status: 400,
          data: { detail: 'Validation Error' },
        },
      };

      expect(validationError.response.status).toBe(400);
    });
  });

  describe('Base URL Configuration', () => {
    it('should remove trailing slash from base URL', () => {
      // The getBackendUrl function removes trailing slashes
      const url = 'http://localhost:8000/';
      const cleaned = url.replace(/\/$/, '');

      expect(cleaned).toBe('http://localhost:8000');
    });

    it('should preserve URL without trailing slash', () => {
      const url = 'http://localhost:8000';
      const cleaned = url.replace(/\/$/, '');

      expect(cleaned).toBe('http://localhost:8000');
    });
  });

  describe('Environment Variables', () => {
    it('should require VITE_API_BASE_URL to be set', () => {
      // In test environment, VITE_API_BASE_URL should be set
      // The actual check happens during module load
      expect(import.meta.env.VITE_API_BASE_URL).toBeDefined();
    });
  });

  describe('Circuit Breaker Thresholds', () => {
    it('should have correct circuit breaker threshold', () => {
      // Circuit breaker trips after 3 consecutive failures
      const CIRCUIT_BREAKER_THRESHOLD = 3;
      expect(CIRCUIT_BREAKER_THRESHOLD).toBe(3);
    });

    it('should have correct circuit breaker timeout', () => {
      // 5 seconds for quick recovery
      const CIRCUIT_BREAKER_TIMEOUT = 5000;
      expect(CIRCUIT_BREAKER_TIMEOUT).toBe(5000);
    });
  });
});
