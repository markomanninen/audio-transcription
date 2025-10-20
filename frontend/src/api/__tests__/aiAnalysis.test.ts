import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeProject, applyAnalysis } from '../aiAnalysis';
import type { ProjectAnalysisResponse } from '../aiAnalysis';

// Mock the API client
vi.mock('../client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '../client';
const mockPost = vi.mocked(apiClient.post);

describe('AI Analysis API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeProject', () => {
    it('should analyze project with default provider', async () => {
      const mockResponse: ProjectAnalysisResponse = {
        suggested_content_type: 'interview',
        confidence: 0.85,
        reasoning: 'Detected Q&A format with interviewer and interviewee',
        suggested_description: 'Interview transcription with two speakers',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await analyzeProject(123);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai/analyze/project/123',
        null,
        { params: { provider: 'ollama' } }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should analyze project with custom provider', async () => {
      const mockResponse: ProjectAnalysisResponse = {
        suggested_content_type: 'podcast',
        confidence: 0.92,
        reasoning: 'Multiple speakers discussing topics in conversational format',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await analyzeProject(456, 'openrouter');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai/analyze/project/456',
        null,
        { params: { provider: 'openrouter' } }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle analysis without suggested description', async () => {
      const mockResponse: ProjectAnalysisResponse = {
        suggested_content_type: 'lecture',
        confidence: 0.78,
        reasoning: 'Single speaker presenting educational content',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await analyzeProject(789);

      expect(result.suggested_description).toBeUndefined();
      expect(result.suggested_content_type).toBe('lecture');
    });

    it('should handle high confidence results', async () => {
      const mockResponse: ProjectAnalysisResponse = {
        suggested_content_type: 'meeting',
        confidence: 0.95,
        reasoning: 'Multiple participants in structured discussion with agenda',
        suggested_description: 'Business meeting transcription',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await analyzeProject(100);

      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle low confidence results', async () => {
      const mockResponse: ProjectAnalysisResponse = {
        suggested_content_type: 'general',
        confidence: 0.45,
        reasoning: 'Unable to determine specific content type',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await analyzeProject(200);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.suggested_content_type).toBe('general');
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Analysis service unavailable');
      mockPost.mockRejectedValue(error);

      await expect(analyzeProject(999)).rejects.toThrow(
        'Analysis service unavailable'
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error') as Error & { code?: string };
      networkError.code = 'ERR_NETWORK';
      mockPost.mockRejectedValue(networkError);

      await expect(analyzeProject(888)).rejects.toThrow('Network Error');
    });

    it('should handle 400 validation errors', async () => {
      const validationError = {
        response: {
          status: 400,
          data: { detail: 'Invalid project ID' },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(analyzeProject(-1)).rejects.toEqual(validationError);
    });

    it('should handle 404 project not found errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { detail: 'Project not found' },
        },
      };
      mockPost.mockRejectedValue(notFoundError);

      await expect(analyzeProject(99999)).rejects.toEqual(notFoundError);
    });

    it('should handle 500 internal server errors', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { detail: 'LLM service error' },
        },
      };
      mockPost.mockRejectedValue(serverError);

      await expect(analyzeProject(777)).rejects.toEqual(serverError);
    });
  });

  describe('applyAnalysis', () => {
    it('should apply analysis with content type only', async () => {
      const mockResponse = {
        success: true,
        message: 'Analysis applied successfully',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await applyAnalysis(123, 'interview');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai/analyze/project/123/apply',
        null,
        {
          params: {
            content_type: 'interview',
            description: undefined,
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should apply analysis with content type and description', async () => {
      const mockResponse = {
        success: true,
        message: 'Project updated with AI suggestions',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const result = await applyAnalysis(
        456,
        'podcast',
        'Technology podcast with expert guests'
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai/analyze/project/456/apply',
        null,
        {
          params: {
            content_type: 'podcast',
            description: 'Technology podcast with expert guests',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle empty description as undefined', async () => {
      const mockResponse = { success: true };
      mockPost.mockResolvedValue({ data: mockResponse });

      await applyAnalysis(789, 'meeting', '');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai/analyze/project/789/apply',
        null,
        {
          params: {
            content_type: 'meeting',
            description: undefined,
          },
        }
      );
    });

    it('should handle various content types', async () => {
      const mockResponse = { success: true };
      mockPost.mockResolvedValue({ data: mockResponse });

      const contentTypes = [
        'interview',
        'podcast',
        'meeting',
        'lecture',
        'presentation',
        'conversation',
        'general',
      ];

      for (const contentType of contentTypes) {
        mockPost.mockClear();
        await applyAnalysis(100, contentType);

        expect(mockPost).toHaveBeenCalledWith(
          '/api/ai/analyze/project/100/apply',
          null,
          expect.objectContaining({
            params: expect.objectContaining({
              content_type: contentType,
            }),
          })
        );
      }
    });

    it('should handle API errors when applying analysis', async () => {
      const error = new Error('Failed to update project');
      mockPost.mockRejectedValue(error);

      await expect(applyAnalysis(999, 'interview')).rejects.toThrow(
        'Failed to update project'
      );
    });

    it('should handle 400 validation errors', async () => {
      const validationError = {
        response: {
          status: 400,
          data: { detail: 'Invalid content type' },
        },
      };
      mockPost.mockRejectedValue(validationError);

      await expect(applyAnalysis(123, 'invalid-type')).rejects.toEqual(
        validationError
      );
    });

    it('should handle 404 project not found errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { detail: 'Project not found' },
        },
      };
      mockPost.mockRejectedValue(notFoundError);

      await expect(applyAnalysis(99999, 'interview')).rejects.toEqual(
        notFoundError
      );
    });

    it('should handle long descriptions', async () => {
      const mockResponse = { success: true };
      mockPost.mockResolvedValue({ data: mockResponse });

      const longDescription =
        'This is a very detailed description of the project content that goes on for quite a while to test how the API handles longer text inputs and whether it properly transmits them to the backend service.';

      await applyAnalysis(555, 'lecture', longDescription);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai/analyze/project/555/apply',
        null,
        {
          params: {
            content_type: 'lecture',
            description: longDescription,
          },
        }
      );
    });

    it('should handle special characters in description', async () => {
      const mockResponse = { success: true };
      mockPost.mockResolvedValue({ data: mockResponse });

      const specialDescription = 'Project with émojis 😀 and spëcial çharacters!';

      await applyAnalysis(666, 'interview', specialDescription);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai/analyze/project/666/apply',
        null,
        {
          params: {
            content_type: 'interview',
            description: specialDescription,
          },
        }
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should support analyze then apply workflow', async () => {
      // Step 1: Analyze
      const analysisResponse: ProjectAnalysisResponse = {
        suggested_content_type: 'interview',
        confidence: 0.88,
        reasoning: 'Q&A format detected',
        suggested_description: 'Expert interview on AI',
      };
      mockPost.mockResolvedValueOnce({ data: analysisResponse });

      const analysis = await analyzeProject(123);

      // Step 2: Apply
      const applyResponse = { success: true };
      mockPost.mockResolvedValueOnce({ data: applyResponse });

      const result = await applyAnalysis(
        123,
        analysis.suggested_content_type,
        analysis.suggested_description
      );

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should handle analyze failure gracefully', async () => {
      const error = new Error('Analysis failed');
      mockPost.mockRejectedValue(error);

      await expect(analyzeProject(123)).rejects.toThrow('Analysis failed');

      // Should not attempt to apply if analysis failed
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
});
