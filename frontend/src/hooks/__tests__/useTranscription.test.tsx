import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import {
  useStartTranscription,
  useCancelTranscription,
  useTranscriptionStatus,
  useSegments,
  useSpeakers,
  useUpdateSegment,
  useUpdateSpeaker,
} from '../useTranscription';
import type { TranscriptionStatus, Segment, Speaker } from '../../types';

// Mock the API client
vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);
const mockPut = vi.mocked(apiClient.put);

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
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

describe('useTranscription hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useStartTranscription', () => {
    it('should start transcription successfully', async () => {
      const mockResponse = {
        data: {
          status: 'processing',
          message: 'Transcription started',
        },
      };
      mockPost.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useStartTranscription(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        fileId: 1,
        includeDiarization: true,
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/api/transcription/1/action?action=auto',
        { include_diarization: true }
      );
    });

    it('should handle transcription start errors', async () => {
      const error = new Error('Failed to start transcription');
      mockPost.mockRejectedValue(error);

      const { result } = renderHook(() => useStartTranscription(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ fileId: 1, includeDiarization: true })
      ).rejects.toThrow('Failed to start transcription');
    });

    it('should invalidate transcription status cache on success', async () => {
      const mockResponse = { data: { status: 'processing' } };
      mockPost.mockResolvedValue(mockResponse);

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useStartTranscription(), { wrapper });

      await result.current.mutateAsync({ fileId: 1, includeDiarization: true });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['transcription-status', 1, 'v3'],
        });
      });
    });
  });

  describe('useCancelTranscription', () => {
    it('should cancel transcription successfully', async () => {
      const mockResponse = {
        data: {
          status: 'cancelled',
          message: 'Transcription cancelled',
        },
      };
      mockPost.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCancelTranscription(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(1);

      expect(mockPost).toHaveBeenCalledWith('/api/transcription/1/cancel');
    });

    it('should handle cancellation errors', async () => {
      const error = new Error('Failed to cancel');
      mockPost.mockRejectedValue(error);

      const { result } = renderHook(() => useCancelTranscription(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync(1)).rejects.toThrow('Failed to cancel');
    });
  });

  describe('useTranscriptionStatus', () => {
    it('should fetch transcription status successfully', async () => {
      const mockStatus: TranscriptionStatus = {
        file_id: 1,
        filename: 'test.mp3',
        original_filename: 'test.mp3',
        status: 'completed',
        progress: 1.0,
        error_message: undefined,
        processing_stage: undefined,
        segment_count: 10,
        duration: 120.5,
        transcription_started_at: '2024-01-01T00:00:00Z',
        transcription_completed_at: '2024-01-01T00:05:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:05:00Z',
        transcription_metadata: undefined,
      };

      mockGet.mockResolvedValue({ data: mockStatus });

      const { result } = renderHook(() => useTranscriptionStatus(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toMatchObject({
        file_id: 1,
        status: 'completed',
        progress: 1.0,
        segment_count: 10,
      });

      expect(mockGet).toHaveBeenCalledWith('/api/transcription/1/status');
    });

    it('should normalize status values', async () => {
      const mockStatus = {
        file_id: 1,
        filename: 'test.mp3',
        original_filename: 'test.mp3',
        status: 'PROCESSING', // Uppercase
        progress: 50, // Percentage instead of decimal
        error_message: undefined,
        processing_stage: undefined,
        segment_count: 5,
        duration: 120.5,
        transcription_started_at: undefined,
        transcription_completed_at: undefined,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        transcription_metadata: undefined,
      };

      mockGet.mockResolvedValue({ data: mockStatus });

      const { result } = renderHook(() => useTranscriptionStatus(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toMatchObject({
        status: 'processing', // Normalized to lowercase
        progress: 0.5, // Normalized to decimal (50/100)
      });
    });

    it('should not fetch when fileId is null', async () => {
      const { result } = renderHook(() => useTranscriptionStatus(null), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should poll for status updates when processing', async () => {
      const mockStatus: TranscriptionStatus = {
        file_id: 1,
        filename: 'test.mp3',
        original_filename: 'test.mp3',
        status: 'processing',
        progress: 0.5,
        error_message: undefined,
        processing_stage: 'transcribing',
        segment_count: 0,
        duration: 120.5,
        transcription_started_at: '2024-01-01T00:00:00Z',
        transcription_completed_at: undefined,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        transcription_metadata: undefined,
      };

      mockGet.mockResolvedValue({ data: mockStatus });

      const { result } = renderHook(() => useTranscriptionStatus(1, 2000), {
        wrapper: createWrapper(),
      });

      // Wait for initial fetch
      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.status).toBe('processing');
      expect(mockGet).toHaveBeenCalled();
    });

    it('should use v3 cache key for isolation', async () => {
      const mockStatus: TranscriptionStatus = {
        file_id: 1,
        filename: 'test.mp3',
        original_filename: 'test.mp3',
        status: 'completed',
        progress: 1.0,
        error_message: undefined,
        processing_stage: undefined,
        segment_count: 10,
        duration: 120.5,
        transcription_started_at: '2024-01-01T00:00:00Z',
        transcription_completed_at: '2024-01-01T00:05:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:05:00Z',
        transcription_metadata: undefined,
      };

      mockGet.mockResolvedValue({ data: mockStatus });

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useTranscriptionStatus(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      const cachedData = queryClient.getQueryData(['transcription-status', 1, 'v3']);
      expect(cachedData).toBeDefined();
    });
  });

  describe('useSegments', () => {
    it('should fetch segments successfully', async () => {
      const mockSegments: Segment[] = [
        {
          id: 1,
          start_time: 0.0,
          end_time: 10.0,
          original_text: 'First segment',
          edited_text: undefined,
          speaker_id: 1,
          sequence: 0,
          is_passive: false,
        },
        {
          id: 2,
          start_time: 10.0,
          end_time: 20.0,
          original_text: 'Second segment',
          edited_text: 'Edited second segment',
          speaker_id: 2,
          sequence: 1,
          is_passive: false,
        },
      ];

      mockGet.mockResolvedValue({ data: mockSegments });

      const { result } = renderHook(() => useSegments(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0]).toMatchObject({
        id: 1,
        original_text: 'First segment',
      });

      expect(mockGet).toHaveBeenCalledWith('/api/transcription/1/segments');
    });

    it('should not fetch when fileId is null', async () => {
      const { result } = renderHook(() => useSegments(null), {
        wrapper: createWrapper(),
      });

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
      expect(result.current.isSuccess).toBe(false);
    });
  });

  describe('useSpeakers', () => {
    it('should fetch speakers successfully', async () => {
      const mockSpeakers: Speaker[] = [
        {
          id: 1,
          speaker_id: 'SPEAKER_00',
          display_name: 'Speaker 1',
          color: '#FF5733',
        },
        {
          id: 2,
          speaker_id: 'SPEAKER_01',
          display_name: 'Speaker 2',
          color: '#33FF57',
        },
      ];

      mockGet.mockResolvedValue({ data: mockSpeakers });

      const { result } = renderHook(() => useSpeakers(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0]).toMatchObject({
        id: 1,
        display_name: 'Speaker 1',
      });

      expect(mockGet).toHaveBeenCalledWith('/api/transcription/1/speakers');
    });
  });

  describe('useUpdateSegment', () => {
    it('should update segment successfully', async () => {
      const mockUpdatedSegment: Segment = {
        id: 1,
        start_time: 0.0,
        end_time: 10.0,
        original_text: 'Original text',
        edited_text: 'Updated text',
        speaker_id: 1,
        sequence: 0,
        is_passive: false,
      };

      mockPatch.mockResolvedValue({ data: mockUpdatedSegment });

      const { result } = renderHook(() => useUpdateSegment(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        segmentId: 1,
        editedText: 'Updated text',
      });

      expect(mockPatch).toHaveBeenCalledWith('/api/transcription/segment/1', {
        edited_text: 'Updated text',
      });
    });

    it('should handle update errors', async () => {
      const error = new Error('Failed to update segment');
      mockPatch.mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateSegment(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ segmentId: 1, editedText: 'Updated text' })
      ).rejects.toThrow('Failed to update segment');
    });
  });

  describe('useUpdateSpeaker', () => {
    it('should update speaker successfully', async () => {
      const mockUpdatedSpeaker: Speaker = {
        id: 1,
        speaker_id: 'SPEAKER_00',
        display_name: 'John Doe',
        color: '#FF5733',
      };

      mockPut.mockResolvedValue({ data: mockUpdatedSpeaker });

      const { result } = renderHook(() => useUpdateSpeaker(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        speakerId: 1,
        displayName: 'John Doe',
      });

      expect(mockPut).toHaveBeenCalledWith('/api/transcription/speaker/1', {
        display_name: 'John Doe',
      });
    });

    it('should handle speaker update errors', async () => {
      const error = new Error('Failed to update speaker');
      mockPut.mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateSpeaker(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ speakerId: 1, displayName: 'John Doe' })
      ).rejects.toThrow('Failed to update speaker');
    });
  });
});
