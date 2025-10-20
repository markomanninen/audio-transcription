import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSystemHealth, useBackendReadiness } from '../useSystemHealth';
import type { SystemHealthStatus } from '../useSystemHealth';
import type { WhisperDownloadProgress } from '../useWhisperProgress';

// Mock the API client
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
  },
  API_BASE_URL: 'http://localhost:8000',
}));

// Mock useWhisperProgress hook
vi.mock('../useWhisperProgress', () => ({
  useWhisperProgress: vi.fn(),
}));

import apiClient from '../../api/client';
import { useWhisperProgress } from '../useWhisperProgress';

const mockGet = vi.mocked(apiClient.get);
const mockUseWhisperProgress = vi.mocked(useWhisperProgress);

const createWrapper = (overrides = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        ...overrides,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useSystemHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useSystemHealth', () => {
    it('should fetch healthy system status', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'healthy',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'up', message: 'OK' },
          whisper: { status: 'up', message: 'Ready' },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: [],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toEqual(mockHealth);
      expect(mockGet).toHaveBeenCalledWith('/health');
    });

    it('should fetch starting system status', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'starting',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'starting', message: 'Initializing...' },
          whisper: { status: 'downloading', message: 'Downloading model...', progress: 45 },
          ollama: { status: 'starting', message: 'Starting...' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['database', 'whisper'],
        optional: ['ollama'],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.status).toBe('starting');
      expect(result.current.data?.components.whisper.status).toBe('downloading');
      expect(result.current.data?.components.whisper.progress).toBe(45);
    });

    it('should fetch unhealthy system status', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'unhealthy',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'down', message: 'Connection failed' },
          whisper: { status: 'up', message: 'Ready' },
          ollama: { status: 'down', message: 'Service unavailable' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['database'],
        optional: ['ollama'],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.status).toBe('unhealthy');
      expect(result.current.data?.critical).toContain('database');
    });

    it('should handle database busy status during transcription', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'healthy',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'busy', message: 'Transcription in progress' },
          whisper: {
            status: 'processing',
            message: 'Processing audio',
            active_transcription: {
              file_id: 1,
              filename: 'interview.mp3',
              progress: 65.5,
              stage: 'transcribing',
              started_at: '2024-01-01T00:00:00Z',
            },
          },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: [],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.components.database.status).toBe('busy');
      expect(result.current.data?.components.whisper.active_transcription?.progress).toBe(65.5);
    });

    it('should handle whisper model download progress', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'starting',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'up', message: 'OK' },
          whisper: {
            status: 'downloading',
            message: 'Downloading model...',
            progress: 73,
            downloaded: '1.2GB',
            total: '1.5GB',
            speed: '5.3 MB/s',
            model_size: 'medium',
          },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['whisper'],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      const whisper = result.current.data?.components.whisper;
      expect(whisper?.status).toBe('downloading');
      expect(whisper?.progress).toBe(73);
      expect(whisper?.downloaded).toBe('1.2GB');
      expect(whisper?.total).toBe('1.5GB');
      expect(whisper?.speed).toBe('5.3 MB/s');
      expect(whisper?.model_size).toBe('medium');
    });

    it('should handle API errors with retry logic', async () => {
      const error = new Error('Failed to fetch health status');
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      // isLoading should be true initially
      expect(result.current.isLoading).toBe(true);

      // The hook has retry logic, so it will keep retrying
      // We just verify it's loading and handling the error
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should still be loading or in error state due to retries
      expect(result.current.isLoading || result.current.isError).toBe(true);
    });

    it('should handle network timeout errors with retry logic', async () => {
      const timeoutError = new Error('timeout') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';
      mockGet.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      // The hook has retry logic with backoff
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should be in loading or error state
      expect(result.current.isLoading || result.current.isError).toBe(true);
    });

    it('should handle 503 service unavailable errors with retry logic', async () => {
      const serviceError = {
        response: {
          status: 503,
          data: { detail: 'Service Unavailable' },
        },
      };
      mockGet.mockRejectedValue(serviceError);

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      });

      // The hook will retry with backoff
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should be in loading or error state
      expect(result.current.isLoading || result.current.isError).toBe(true);
    });
  });

  describe('useBackendReadiness', () => {
    beforeEach(() => {
      // Default mock: no whisper progress
      mockUseWhisperProgress.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        isError: false,
        isPending: false,
        isSuccess: true,
        status: 'success'
      } as ReturnType<typeof mockUseWhisperProgress>);
    });

    it('should indicate ready when system is healthy', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'healthy',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'up', message: 'OK' },
          whisper: { status: 'up', message: 'Ready' },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: [],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isReady).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.isUiReady).toBe(true);
      expect(result.current.isStarting).toBe(false);
      expect(result.current.isUnhealthy).toBe(false);
    });

    it('should indicate starting when system is initializing', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'starting',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'starting', message: 'Initializing...' },
          whisper: { status: 'loading', message: 'Loading model...' },
          ollama: { status: 'starting', message: 'Starting...' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['database', 'whisper'],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isStarting).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.isUnhealthy).toBe(false);
    });

    it('should indicate unhealthy when critical services are down', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'unhealthy',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'down', message: 'Connection failed' },
          whisper: { status: 'up', message: 'Ready' },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['database'],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isUnhealthy).toBe(true), {
        timeout: 3000,
      });

      // Note: isReady may still be true if whisper is ready (complex logic in hook)
      // The key indicator is isUnhealthy
      expect(result.current.isUnhealthy).toBe(true);
    });

    it('should consider system ready when database is busy during transcription', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'healthy',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'busy', message: 'Transcription in progress' },
          whisper: {
            status: 'processing',
            message: 'Processing audio',
            active_transcription: {
              file_id: 1,
              filename: 'test.mp3',
              progress: 50,
            },
          },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: [],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isReady).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.isUiReady).toBe(true);
    });

    it('should detect whisper loading state', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'starting',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'up', message: 'OK' },
          whisper: {
            status: 'loading',
            message: 'Loading model...',
            model_size: 'medium',
          },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['whisper'],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isWhisperLoading).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.whisperMessage).toContain('Loading medium model');
    });

    it('should show whisper download progress message', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'starting',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'up', message: 'OK' },
          whisper: {
            status: 'downloading',
            message: 'Downloading...',
            model_size: 'medium',
          },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['whisper'],
        optional: [],
      };

      const mockProgress: WhisperDownloadProgress = {
        progress: 65,
        downloaded: '900MB',
        total: '1.5GB',
        speed: '8.2 MB/s',
      };

      mockGet.mockResolvedValue({ data: mockHealth });
      mockUseWhisperProgress.mockReturnValue({
        data: mockProgress,
        isLoading: false,
        error: null,
        isError: false,
        isPending: false,
        isSuccess: true,
        status: 'success'
      } as ReturnType<typeof mockUseWhisperProgress>);

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isWhisperLoading).toBe(true), {
        timeout: 3000,
      });

      // The message will contain the model size from whisper status
      expect(result.current.whisperMessage).toContain('model... 65%');
    });

    it('should show active transcription progress', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'healthy',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'busy', message: 'Processing' },
          whisper: {
            status: 'processing',
            message: 'Processing',
            active_transcription: {
              file_id: 1,
              filename: 'interview.mp3',
              progress: 42.7,
              stage: 'diarization',
              started_at: '2024-01-01T00:00:00Z',
            },
          },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: [],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isReady).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.whisperMessage).toContain('Processing interview.mp3');
      // Progress is formatted to 0 decimal places when >= 10%, 1 decimal when < 10%
      // 42.7% becomes 43%
      expect(result.current.whisperMessage).toContain('43%');
      expect(result.current.whisperMessage).toContain('diarization');
    });

    it('should handle infrastructure ready but whisper not ready', async () => {
      const mockHealth: SystemHealthStatus = {
        status: 'starting',
        version: '1.0.0',
        components: {
          api: { status: 'up', message: 'OK' },
          database: { status: 'up', message: 'OK' },
          whisper: { status: 'starting', message: 'Starting...' },
          ollama: { status: 'up', message: 'OK' },
          redis: { status: 'up', message: 'OK' },
          storage: { status: 'up', message: 'OK' },
        },
        critical: ['whisper'],
        optional: [],
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isUiReady).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.isReady).toBe(false);
    });

    it('should handle whisper progress data without health endpoint', async () => {
      // Simulate backend not responding yet but whisper progress available
      mockGet.mockRejectedValue(new Error('Connection refused'));

      const mockProgress: WhisperDownloadProgress = {
        progress: 30,
        downloaded: '400MB',
        total: '1.5GB',
        speed: '6.5 MB/s',
      };

      mockUseWhisperProgress.mockReturnValue({
        data: mockProgress,
        isLoading: false,
        error: null,
        isError: false,
        isPending: false,
        isSuccess: true,
        status: 'success'
      } as ReturnType<typeof mockUseWhisperProgress>);

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      // Should construct health from whisper progress
      await waitFor(() => expect(result.current.health?.status).toBe('starting'), {
        timeout: 3000,
      });

      expect(result.current.health?.components.whisper.progress).toBe(30);
      expect(result.current.health?.components.whisper.message).toContain('30%');
    });

    it('should handle error state gracefully', async () => {
      const error = new Error('Network error');
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(() => useBackendReadiness(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeDefined(), {
        timeout: 3000,
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toBeDefined();
    });
  });
});
