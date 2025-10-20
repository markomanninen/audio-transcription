import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProviders,
  useProviderHealth,
  useCorrectSegment,
  useCorrectBatch,
  useModels,
  useModelAvailability,
} from '../useAICorrections';
import * as aiCorrectionsApi from '../../api/aiCorrections';
import type {
  ProviderInfo,
  CorrectionResponse,
} from '../../api/aiCorrections';

// Mock the API module
vi.mock('../../api/aiCorrections', () => ({
  correctSegment: vi.fn(),
  correctBatch: vi.fn(),
  listProviders: vi.fn(),
  checkProviderHealth: vi.fn(),
  listModels: vi.fn(),
  checkModelAvailability: vi.fn(),
}));

const mockCorrectSegment = vi.mocked(aiCorrectionsApi.correctSegment);
const mockCorrectBatch = vi.mocked(aiCorrectionsApi.correctBatch);
const mockListProviders = vi.mocked(aiCorrectionsApi.listProviders);
const mockCheckProviderHealth = vi.mocked(aiCorrectionsApi.checkProviderHealth);
const mockListModels = vi.mocked(aiCorrectionsApi.listModels);
const mockCheckModelAvailability = vi.mocked(aiCorrectionsApi.checkModelAvailability);

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

describe('useAICorrections hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProviders', () => {
    it('should fetch available providers', async () => {
      const mockProviders: ProviderInfo[] = [
        { name: 'ollama', available: true },
        { name: 'openrouter', available: true },
      ];

      mockListProviders.mockResolvedValue(mockProviders);

      const { result } = renderHook(() => useProviders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toEqual(mockProviders);
      expect(mockListProviders).toHaveBeenCalledTimes(1);
    });

    it('should handle provider list with mixed availability', async () => {
      const mockProviders: ProviderInfo[] = [
        { name: 'ollama', available: true },
        { name: 'openrouter', available: false },
      ];

      mockListProviders.mockResolvedValue(mockProviders);

      const { result } = renderHook(() => useProviders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      const available = result.current.data?.filter(p => p.available);
      const unavailable = result.current.data?.filter(p => !p.available);

      expect(available).toHaveLength(1);
      expect(unavailable).toHaveLength(1);
    });

    it('should handle empty provider list', async () => {
      mockListProviders.mockResolvedValue([]);

      const { result } = renderHook(() => useProviders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(0);
    });

    it('should handle provider fetch errors', async () => {
      const error = new Error('Failed to fetch providers');
      mockListProviders.mockRejectedValue(error);

      const { result } = renderHook(() => useProviders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useProviderHealth', () => {
    it('should check health of all providers', async () => {
      const mockHealth = {
        ollama: true,
        openrouter: true,
      };

      mockCheckProviderHealth.mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useProviderHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toEqual(mockHealth);
      expect(mockCheckProviderHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle degraded provider health', async () => {
      const mockHealth = {
        ollama: true,
        openrouter: false,
      };

      mockCheckProviderHealth.mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useProviderHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.ollama).toBe(true);
      expect(result.current.data?.openrouter).toBe(false);
    });

    it('should handle all providers down', async () => {
      const mockHealth = {
        ollama: false,
        openrouter: false,
      };

      mockCheckProviderHealth.mockResolvedValue(mockHealth);

      const { result } = renderHook(() => useProviderHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      const allDown = Object.values(result.current.data || {}).every(v => !v);
      expect(allDown).toBe(true);
    });

    it('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      mockCheckProviderHealth.mockRejectedValue(error);

      const { result } = renderHook(() => useProviderHealth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useCorrectSegment', () => {
    it('should correct single segment successfully', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 1,
        original_text: 'This is a test sentnce.',
        corrected_text: 'This is a test sentence.',
        changes: ['sentnce → sentence'],
        confidence: 0.95,
      };

      mockCorrectSegment.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCorrectSegment(), {
        wrapper: createWrapper(),
      });

      const correctedSegment = await result.current.mutateAsync({
        segment_id: 1,
      });

      expect(correctedSegment).toEqual(mockResponse);
      expect(mockCorrectSegment).toHaveBeenCalledWith({ segment_id: 1 });
    });

    it('should correct segment with specific provider', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 2,
        original_text: 'Incorect spelling.',
        corrected_text: 'Incorrect spelling.',
        changes: ['Incorect → Incorrect'],
        confidence: 0.92,
      };

      mockCorrectSegment.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCorrectSegment(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        segment_id: 2,
        provider: 'openrouter',
      });

      expect(mockCorrectSegment).toHaveBeenCalledWith({
        segment_id: 2,
        provider: 'openrouter',
      });
    });

    it('should correct segment with correction type', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 3,
        original_text: 'this lacks capitalization',
        corrected_text: 'This lacks capitalization.',
        changes: ['Added capitalization', 'Added period'],
        confidence: 0.88,
      };

      mockCorrectSegment.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCorrectSegment(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        segment_id: 3,
        correction_type: 'grammar',
      });

      expect(mockCorrectSegment).toHaveBeenCalledWith({
        segment_id: 3,
        correction_type: 'grammar',
      });
    });

    it('should handle no changes needed', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 4,
        original_text: 'This text is perfect.',
        corrected_text: 'This text is perfect.',
        changes: [],
        confidence: 1.0,
      };

      mockCorrectSegment.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCorrectSegment(), {
        wrapper: createWrapper(),
      });

      const corrected = await result.current.mutateAsync({ segment_id: 4 });

      expect(corrected.changes).toHaveLength(0);
      expect(corrected.confidence).toBe(1.0);
    });

    it('should handle correction errors', async () => {
      const error = new Error('Correction service unavailable');
      mockCorrectSegment.mockRejectedValue(error);

      const { result } = renderHook(() => useCorrectSegment(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ segment_id: 999 })
      ).rejects.toThrow('Correction service unavailable');
    });

    it('should handle 404 segment not found', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { detail: 'Segment not found' },
        },
      };
      mockCorrectSegment.mockRejectedValue(notFoundError);

      const { result } = renderHook(() => useCorrectSegment(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ segment_id: 99999 })
      ).rejects.toEqual(notFoundError);
    });
  });

  describe('useCorrectBatch', () => {
    it('should correct multiple segments', async () => {
      const mockResponse: CorrectionResponse[] = [
        {
          segment_id: 1,
          original_text: 'First eror.',
          corrected_text: 'First error.',
          changes: ['eror → error'],
          confidence: 0.95,
        },
        {
          segment_id: 2,
          original_text: 'Second mistak.',
          corrected_text: 'Second mistake.',
          changes: ['mistak → mistake'],
          confidence: 0.93,
        },
      ];

      mockCorrectBatch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCorrectBatch(), {
        wrapper: createWrapper(),
      });

      const results = await result.current.mutateAsync({
        segment_ids: [1, 2],
      });

      expect(results).toHaveLength(2);
      expect(results[0].segment_id).toBe(1);
      expect(results[1].segment_id).toBe(2);
      expect(mockCorrectBatch).toHaveBeenCalledWith({ segment_ids: [1, 2] });
    });

    it('should correct batch with specific provider', async () => {
      const mockResponse: CorrectionResponse[] = [
        {
          segment_id: 3,
          original_text: 'Text one.',
          corrected_text: 'Text one.',
          changes: [],
          confidence: 1.0,
        },
      ];

      mockCorrectBatch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCorrectBatch(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        segment_ids: [3],
        provider: 'ollama',
        correction_type: 'spelling',
      });

      expect(mockCorrectBatch).toHaveBeenCalledWith({
        segment_ids: [3],
        provider: 'ollama',
        correction_type: 'spelling',
      });
    });

    it('should handle empty batch', async () => {
      mockCorrectBatch.mockResolvedValue([]);

      const { result } = renderHook(() => useCorrectBatch(), {
        wrapper: createWrapper(),
      });

      const results = await result.current.mutateAsync({ segment_ids: [] });

      expect(results).toHaveLength(0);
    });

    it('should handle large batches', async () => {
      const segmentIds = Array.from({ length: 50 }, (_, i) => i + 1);
      const mockResponse: CorrectionResponse[] = segmentIds.map(id => ({
        segment_id: id,
        original_text: `Text ${id}`,
        corrected_text: `Text ${id}`,
        changes: [],
        confidence: 0.9,
      }));

      mockCorrectBatch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCorrectBatch(), {
        wrapper: createWrapper(),
      });

      const results = await result.current.mutateAsync({ segment_ids: segmentIds });

      expect(results).toHaveLength(50);
    });

    it('should handle batch errors', async () => {
      const error = new Error('Batch processing failed');
      mockCorrectBatch.mockRejectedValue(error);

      const { result } = renderHook(() => useCorrectBatch(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ segment_ids: [1, 2, 3] })
      ).rejects.toThrow('Batch processing failed');
    });
  });

  describe('useModels', () => {
    it('should list models for ollama provider', async () => {
      const mockModels = ['llama3.2:1b', 'llama3.2:3b', 'mistral:7b'];

      mockListModels.mockResolvedValue(mockModels);

      const { result } = renderHook(() => useModels('ollama'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toEqual(mockModels);
      expect(mockListModels).toHaveBeenCalledWith('ollama');
    });

    it('should list models for openrouter provider', async () => {
      const mockModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'];

      mockListModels.mockResolvedValue(mockModels);

      const { result } = renderHook(() => useModels('openrouter'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toEqual(mockModels);
      expect(mockListModels).toHaveBeenCalledWith('openrouter');
    });

    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() => useModels('ollama', false), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockListModels).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when provider is empty', async () => {
      const { result } = renderHook(() => useModels(''), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockListModels).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle empty model list', async () => {
      mockListModels.mockResolvedValue([]);

      const { result } = renderHook(() => useModels('unknown-provider'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(0);
    });

    it('should handle model list errors', async () => {
      const error = new Error('Provider not found');
      mockListModels.mockRejectedValue(error);

      const { result } = renderHook(() => useModels('invalid'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useModelAvailability', () => {
    it('should check if model is available', async () => {
      mockCheckModelAvailability.mockResolvedValue({ available: true });

      const { result } = renderHook(() => useModelAvailability('ollama', 'llama3.2:1b'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.available).toBe(true);
      expect(mockCheckModelAvailability).toHaveBeenCalledWith('ollama', 'llama3.2:1b');
    });

    it('should check if model is not available', async () => {
      mockCheckModelAvailability.mockResolvedValue({ available: false });

      const { result } = renderHook(() => useModelAvailability('ollama', 'invalid-model'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.available).toBe(false);
    });

    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() => useModelAvailability('ollama', 'llama3.2:1b', false), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockCheckModelAvailability).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when provider is empty', async () => {
      renderHook(() => useModelAvailability('', 'model'), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockCheckModelAvailability).not.toHaveBeenCalled();
    });

    it('should not fetch when model is empty', async () => {
      renderHook(() => useModelAvailability('ollama', ''), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockCheckModelAvailability).not.toHaveBeenCalled();
    });

    it('should handle special characters in model names', async () => {
      mockCheckModelAvailability.mockResolvedValue({ available: true });

      const { result } = renderHook(() => useModelAvailability('ollama', 'llama3.2:1b-q4'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(mockCheckModelAvailability).toHaveBeenCalledWith('ollama', 'llama3.2:1b-q4');
    });

    it('should handle availability check errors', async () => {
      const error = new Error('Model check failed');
      mockCheckModelAvailability.mockRejectedValue(error);

      const { result } = renderHook(() => useModelAvailability('ollama', 'test-model'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('Integration workflows', () => {
    it('should support full correction workflow', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      // 1. Check health
      mockCheckProviderHealth.mockResolvedValueOnce({
        ollama: true,
        openrouter: true,
      });
      const { result: healthResult } = renderHook(() => useProviderHealth(), { wrapper });
      await waitFor(() => expect(healthResult.current.isSuccess).toBe(true), { timeout: 3000 });

      // 2. List providers
      mockListProviders.mockResolvedValueOnce([
        { name: 'ollama', available: true },
        { name: 'openrouter', available: true },
      ]);
      const { result: providersResult } = renderHook(() => useProviders(), { wrapper });
      await waitFor(() => expect(providersResult.current.isSuccess).toBe(true), { timeout: 3000 });

      // 3. List models
      mockListModels.mockResolvedValueOnce(['llama3.2:1b', 'llama3.2:3b']);
      const { result: modelsResult } = renderHook(() => useModels('ollama'), { wrapper });
      await waitFor(() => expect(modelsResult.current.isSuccess).toBe(true), { timeout: 3000 });

      // 4. Check model availability
      mockCheckModelAvailability.mockResolvedValueOnce({ available: true });
      const { result: availResult } = renderHook(
        () => useModelAvailability('ollama', 'llama3.2:1b'),
        { wrapper }
      );
      await waitFor(() => expect(availResult.current.isSuccess).toBe(true), { timeout: 3000 });

      // 5. Correct segment
      mockCorrectSegment.mockResolvedValueOnce({
        segment_id: 1,
        original_text: 'Test eror',
        corrected_text: 'Test error',
        changes: ['eror → error'],
        confidence: 0.95,
      });
      const { result: correctResult } = renderHook(() => useCorrectSegment(), { wrapper });
      const correction = await correctResult.current.mutateAsync({
        segment_id: 1,
        provider: 'ollama',
      });

      expect(correction.corrected_text).toBe('Test error');
    });

    it('should handle provider failover during correction', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      // Check health - ollama down
      mockCheckProviderHealth.mockResolvedValueOnce({
        ollama: false,
        openrouter: true,
      });
      const { result: healthResult } = renderHook(() => useProviderHealth(), { wrapper });
      await waitFor(() => expect(healthResult.current.isSuccess).toBe(true), { timeout: 3000 });

      // Use alternative provider
      if (!healthResult.current.data?.ollama) {
        mockCorrectSegment.mockResolvedValueOnce({
          segment_id: 1,
          original_text: 'Test',
          corrected_text: 'Test',
          changes: [],
          confidence: 1.0,
        });

        const { result: correctResult } = renderHook(() => useCorrectSegment(), { wrapper });
        const result = await correctResult.current.mutateAsync({
          segment_id: 1,
          provider: 'openrouter',
        });

        expect(result).toBeDefined();
      }
    });
  });
});
