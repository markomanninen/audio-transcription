import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  semanticReconstruction,
  styleGeneration,
  nlpAnalysis,
  factChecking,
  technicalCheck,
  StyleGenerationRequest,
  FactCheckingRequest,
  TechnicalCheckRequest,
} from '../aiEditor';

// Mock the API client
vi.mock('../client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

// Import after mocking
import { apiClient } from '../client';

const mockPost = vi.mocked(apiClient.post);

describe('AI Editor API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('semanticReconstruction', () => {
    it('should call the correct endpoint with proper data', async () => {
      const mockResponse = { data: { result: 'Reconstructed text here' } };
      mockPost.mockResolvedValue(mockResponse);

      const request = {
        text: 'Original text',
        project_id: 123,
        provider: 'ollama',
      };

      const result = await semanticReconstruction(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai_editor/semantic-reconstruction',
        request
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockPost.mockRejectedValue(error);

      const request = {
        text: 'Original text',
        project_id: 123,
      };

      await expect(semanticReconstruction(request)).rejects.toThrow('API Error');
    });
  });

  describe('styleGeneration', () => {
    it('should call the correct endpoint with style parameter', async () => {
      const mockResponse = { data: { result: 'Academic style text here' } };
      mockPost.mockResolvedValue(mockResponse);

      const request: StyleGenerationRequest = {
        text: 'Original text',
        project_id: 123,
        target_style: 'academic',
        provider: 'ollama',
      };

      const result = await styleGeneration(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai_editor/style-generation',
        request
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('nlpAnalysis', () => {
    it('should call the correct endpoint and return structured data', async () => {
      const mockResponse = {
        data: {
          result: {
            summary: 'This is a summary',
            themes: ['theme1', 'theme2'],
            structure: 'Q&A format'
          }
        }
      };
      mockPost.mockResolvedValue(mockResponse);

      const request = {
        text: 'Text to analyze',
        project_id: 123,
      };

      const result = await nlpAnalysis(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai_editor/nlp-analysis',
        request
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('factChecking', () => {
    it('should call the correct endpoint with domain parameter', async () => {
      const mockResponse = {
        data: {
          result: {
            verifications: [
              {
                original_statement: 'Test statement',
                is_accurate: true,
                verification_details: 'Confirmed accurate.'
              }
            ]
          }
        }
      };
      mockPost.mockResolvedValue(mockResponse);

      const request: FactCheckingRequest = {
        text: 'Text to fact-check',
        project_id: 123,
        domain: 'history',
      };

      const result = await factChecking(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai_editor/fact-checking',
        request
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('technicalCheck', () => {
    it('should call the correct endpoint with metadata and format', async () => {
      const mockResponse = {
        data: {
          result: '1\n00:00:01,000 --> 00:00:05,000\nTest subtitle\n'
        }
      };
      mockPost.mockResolvedValue(mockResponse);

      const request: TechnicalCheckRequest = {
        text_with_metadata: '[00:01] Speaker: Test text',
        project_id: 123,
        target_format: 'SRT',
      };

      const result = await technicalCheck(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/ai_editor/technical-check',
        request
      );
      expect(result).toEqual(mockResponse.data);
    });
  });
});