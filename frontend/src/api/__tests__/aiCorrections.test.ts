import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  correctSegment,
  correctBatch,
  listProviders,
  checkProviderHealth,
  listModels,
  checkModelAvailability,
} from '../aiCorrections';
import type {
  CorrectionRequest,
  BatchCorrectionRequest,
  CorrectionResponse,
  ProviderInfo,
} from '../aiCorrections';

// Mock the API client
vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '../client';
const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('AI Corrections API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('correctSegment', () => {
    it('should correct a single segment with default options', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 1,
        original_text: 'This is a test sentnce with erors.',
        corrected_text: 'This is a test sentence with errors.',
        changes: ['sentnce → sentence', 'erors → errors'],
        confidence: 0.95,
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const request: CorrectionRequest = {
        segment_id: 1,
      };

      const result = await correctSegment(request);

      expect(mockPost).toHaveBeenCalledWith('/api/ai/correct-segment', request);
      expect(result).toEqual(mockResponse);
      expect(result.changes).toHaveLength(2);
    });

    it('should correct segment with specific provider', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 2,
        original_text: 'Incorect spelling here.',
        corrected_text: 'Incorrect spelling here.',
        changes: ['Incorect → Incorrect'],
        confidence: 0.92,
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const request: CorrectionRequest = {
        segment_id: 2,
        provider: 'openrouter',
      };

      const result = await correctSegment(request);

      expect(mockPost).toHaveBeenCalledWith('/api/ai/correct-segment', {
        segment_id: 2,
        provider: 'openrouter',
      });
      expect(result.original_text).toContain('Incorect');
      expect(result.corrected_text).toContain('Incorrect');
    });

    it('should correct segment with correction type', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 3,
        original_text: 'this sentence lacks capitalization and punctuation',
        corrected_text: 'This sentence lacks capitalization and punctuation.',
        changes: ['Added capitalization', 'Added period'],
        confidence: 0.88,
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const request: CorrectionRequest = {
        segment_id: 3,
        correction_type: 'grammar',
      };

      const result = await correctSegment(request);

      expect(result.changes).toContain('Added capitalization');
      expect(result.changes).toContain('Added period');
    });

    it('should handle no changes needed', async () => {
      const mockResponse: CorrectionResponse = {
        segment_id: 4,
        original_text: 'This text is perfect.',
        corrected_text: 'This text is perfect.',
        changes: [],
        confidence: 1.0,
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await correctSegment({ segment_id: 4 });

      expect(result.original_text).toBe(result.corrected_text);
      expect(result.changes).toHaveLength(0);
      expect(result.confidence).toBe(1.0);
    });

    it('should handle API errors', async () => {
      const error = new Error('Correction service unavailable');
      mockPost.mockRejectedValue(error);

      await expect(correctSegment({ segment_id: 999 })).rejects.toThrow(
        'Correction service unavailable'
      );
    });

    it('should handle 404 segment not found', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { detail: 'Segment not found' },
        },
      };
      mockPost.mockRejectedValue(notFoundError);

      await expect(correctSegment({ segment_id: 99999 })).rejects.toEqual(
        notFoundError
      );
    });
  });

  describe('correctBatch', () => {
    it('should correct multiple segments', async () => {
      const mockResponse: CorrectionResponse[] = [
        {
          segment_id: 1,
          original_text: 'First eror here.',
          corrected_text: 'First error here.',
          changes: ['eror → error'],
          confidence: 0.95,
        },
        {
          segment_id: 2,
          original_text: 'Second mistak here.',
          corrected_text: 'Second mistake here.',
          changes: ['mistak → mistake'],
          confidence: 0.93,
        },
      ];

      mockPost.mockResolvedValue({ data: mockResponse });

      const request: BatchCorrectionRequest = {
        segment_ids: [1, 2],
      };

      const result = await correctBatch(request);

      expect(mockPost).toHaveBeenCalledWith('/api/ai/correct-batch', request);
      expect(result).toHaveLength(2);
      expect(result[0].segment_id).toBe(1);
      expect(result[1].segment_id).toBe(2);
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

      mockPost.mockResolvedValue({ data: mockResponse });

      const request: BatchCorrectionRequest = {
        segment_ids: [3],
        provider: 'ollama',
        correction_type: 'spelling',
      };

      const result = await correctBatch(request);

      expect(mockPost).toHaveBeenCalledWith('/api/ai/correct-batch', {
        segment_ids: [3],
        provider: 'ollama',
        correction_type: 'spelling',
      });
      expect(result).toHaveLength(1);
    });

    it('should handle empty batch', async () => {
      const mockResponse: CorrectionResponse[] = [];
      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await correctBatch({ segment_ids: [] });

      expect(result).toHaveLength(0);
    });

    it('should handle large batches', async () => {
      const segmentIds = Array.from({ length: 50 }, (_, i) => i + 1);
      const mockResponse: CorrectionResponse[] = segmentIds.map((id) => ({
        segment_id: id,
        original_text: `Text ${id}`,
        corrected_text: `Text ${id}`,
        changes: [],
        confidence: 0.9,
      }));

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await correctBatch({ segment_ids: segmentIds });

      expect(result).toHaveLength(50);
    });

    it('should handle batch errors', async () => {
      const error = new Error('Batch processing failed');
      mockPost.mockRejectedValue(error);

      await expect(correctBatch({ segment_ids: [1, 2, 3] })).rejects.toThrow(
        'Batch processing failed'
      );
    });
  });

  describe('listProviders', () => {
    it('should list available providers', async () => {
      const mockProviders: ProviderInfo[] = [
        { name: 'ollama', available: true },
        { name: 'openrouter', available: true },
      ];

      mockGet.mockResolvedValue({ data: mockProviders });

      const result = await listProviders();

      expect(mockGet).toHaveBeenCalledWith('/api/ai/providers');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('ollama');
      expect(result[1].name).toBe('openrouter');
    });

    it('should show provider availability status', async () => {
      const mockProviders: ProviderInfo[] = [
        { name: 'ollama', available: true },
        { name: 'openrouter', available: false },
      ];

      mockGet.mockResolvedValue({ data: mockProviders });

      const result = await listProviders();

      const ollama = result.find((p) => p.name === 'ollama');
      const openrouter = result.find((p) => p.name === 'openrouter');

      expect(ollama?.available).toBe(true);
      expect(openrouter?.available).toBe(false);
    });

    it('should handle empty provider list', async () => {
      mockGet.mockResolvedValue({ data: [] });

      const result = await listProviders();

      expect(result).toHaveLength(0);
    });

    it('should handle provider list errors', async () => {
      const error = new Error('Failed to fetch providers');
      mockGet.mockRejectedValue(error);

      await expect(listProviders()).rejects.toThrow('Failed to fetch providers');
    });
  });

  describe('checkProviderHealth', () => {
    it('should check health of all providers', async () => {
      const mockHealth: Record<string, boolean> = {
        ollama: true,
        openrouter: true,
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const result = await checkProviderHealth();

      expect(mockGet).toHaveBeenCalledWith('/api/ai/health');
      expect(result.ollama).toBe(true);
      expect(result.openrouter).toBe(true);
    });

    it('should show degraded provider health', async () => {
      const mockHealth: Record<string, boolean> = {
        ollama: true,
        openrouter: false,
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const result = await checkProviderHealth();

      expect(result.ollama).toBe(true);
      expect(result.openrouter).toBe(false);
    });

    it('should handle all providers down', async () => {
      const mockHealth: Record<string, boolean> = {
        ollama: false,
        openrouter: false,
      };

      mockGet.mockResolvedValue({ data: mockHealth });

      const result = await checkProviderHealth();

      expect(Object.values(result).every((v) => v === false)).toBe(true);
    });

    it('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      mockGet.mockRejectedValue(error);

      await expect(checkProviderHealth()).rejects.toThrow('Health check failed');
    });
  });

  describe('listModels', () => {
    it('should list models for ollama provider', async () => {
      const mockModels = ['llama3.2:1b', 'llama3.2:3b', 'mistral:7b'];

      mockGet.mockResolvedValue({ data: mockModels });

      const result = await listModels('ollama');

      expect(mockGet).toHaveBeenCalledWith('/api/ai/models/ollama');
      expect(result).toHaveLength(3);
      expect(result).toContain('llama3.2:1b');
    });

    it('should list models for openrouter provider', async () => {
      const mockModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'];

      mockGet.mockResolvedValue({ data: mockModels });

      const result = await listModels('openrouter');

      expect(mockGet).toHaveBeenCalledWith('/api/ai/models/openrouter');
      expect(result).toHaveLength(3);
    });

    it('should handle empty model list', async () => {
      mockGet.mockResolvedValue({ data: [] });

      const result = await listModels('unknown-provider');

      expect(result).toHaveLength(0);
    });

    it('should handle model list errors', async () => {
      const error = new Error('Provider not found');
      mockGet.mockRejectedValue(error);

      await expect(listModels('invalid')).rejects.toThrow('Provider not found');
    });
  });

  describe('checkModelAvailability', () => {
    it('should check if model is available', async () => {
      mockGet.mockResolvedValue({ data: { available: true } });

      const result = await checkModelAvailability('ollama', 'llama3.2:1b');

      expect(mockGet).toHaveBeenCalledWith(
        '/api/ai/models/ollama/llama3.2:1b/check'
      );
      expect(result.available).toBe(true);
    });

    it('should check if model is not available', async () => {
      mockGet.mockResolvedValue({ data: { available: false } });

      const result = await checkModelAvailability('ollama', 'invalid-model');

      expect(result.available).toBe(false);
    });

    it('should handle special characters in model names', async () => {
      mockGet.mockResolvedValue({ data: { available: true } });

      await checkModelAvailability('ollama', 'llama3.2:1b-q4');

      expect(mockGet).toHaveBeenCalledWith(
        '/api/ai/models/ollama/llama3.2:1b-q4/check'
      );
    });

    it('should handle availability check errors', async () => {
      const error = new Error('Model check failed');
      mockGet.mockRejectedValue(error);

      await expect(
        checkModelAvailability('ollama', 'test-model')
      ).rejects.toThrow('Model check failed');
    });
  });

  describe('Integration Workflows', () => {
    it('should support full correction workflow', async () => {
      // 1. Check provider health
      mockGet.mockResolvedValueOnce({
        data: { ollama: true, openrouter: true },
      });
      const health = await checkProviderHealth();
      expect(health.ollama).toBe(true);

      // 2. List providers
      mockGet.mockResolvedValueOnce({
        data: [
          { name: 'ollama', available: true },
          { name: 'openrouter', available: true },
        ],
      });
      const providers = await listProviders();
      expect(providers).toHaveLength(2);

      // 3. List models
      mockGet.mockResolvedValueOnce({
        data: ['llama3.2:1b', 'llama3.2:3b'],
      });
      const models = await listModels('ollama');
      expect(models).toHaveLength(2);

      // 4. Correct segment
      mockPost.mockResolvedValueOnce({
        data: {
          segment_id: 1,
          original_text: 'Test eror',
          corrected_text: 'Test error',
          changes: ['eror → error'],
          confidence: 0.95,
        },
      });
      const correction = await correctSegment({
        segment_id: 1,
        provider: 'ollama',
      });
      expect(correction.corrected_text).toBe('Test error');
    });

    it('should handle provider unavailable during correction', async () => {
      // Check health first
      mockGet.mockResolvedValueOnce({
        data: { ollama: false, openrouter: true },
      });
      const health = await checkProviderHealth();

      if (!health.ollama) {
        // Should use alternative provider
        mockPost.mockResolvedValueOnce({
          data: {
            segment_id: 1,
            original_text: 'Test',
            corrected_text: 'Test',
            changes: [],
            confidence: 1.0,
          },
        });

        const result = await correctSegment({
          segment_id: 1,
          provider: 'openrouter',
        });

        expect(result).toBeDefined();
      }
    });
  });
});
