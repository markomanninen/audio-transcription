import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAIEditor } from '../useAIEditor';
import * as aiEditorApi from '../../api/aiEditor';
import React from 'react';

// Mock the API module
vi.mock('../../api/aiEditor', () => ({
  semanticReconstruction: vi.fn(),
  styleGeneration: vi.fn(),
  nlpAnalysis: vi.fn(),
  factChecking: vi.fn(),
  technicalCheck: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ children }: any) => React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useAIEditor Hook', () => {
  const projectId = 123;
  const mockSemanticReconstruction = vi.mocked(aiEditorApi.semanticReconstruction);
  const mockStyleGeneration = vi.mocked(aiEditorApi.styleGeneration);
  const mockNlpAnalysis = vi.mocked(aiEditorApi.nlpAnalysis);
  const mockFactChecking = vi.mocked(aiEditorApi.factChecking);
  const mockTechnicalCheck = vi.mocked(aiEditorApi.technicalCheck);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('semanticReconstruction', () => {
    it('should successfully call semantic reconstruction', async () => {
      const mockResponse = { result: 'Reconstructed text' };
      mockSemanticReconstruction.mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      
      // Get the actual mutation hook
      const { result: semanticResult } = renderHook(() => result.current.useSemanticReconstruction(), { wrapper });

      semanticResult.current.mutate('Original text');

      await waitFor(() => {
        expect(semanticResult.current.isSuccess).toBe(true);
      });

      expect(mockSemanticReconstruction).toHaveBeenCalledWith({
        text: 'Original text',
        project_id: projectId,
      });
      expect(semanticResult.current.data).toEqual(mockResponse);
    });

    it('should handle semantic reconstruction errors', async () => {
      const error = new Error('Reconstruction failed');
      mockSemanticReconstruction.mockRejectedValue(error);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: semanticResult } = renderHook(() => result.current.useSemanticReconstruction(), { wrapper });

      semanticResult.current.mutate('Original text');

      await waitFor(() => {
        expect(semanticResult.current.isError).toBe(true);
      });

      expect(semanticResult.current.error).toEqual(error);
    });
  });

  describe('styleGeneration', () => {
    it('should successfully call style generation', async () => {
      const mockResponse = { result: 'Academic style text' };
      mockStyleGeneration.mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: styleResult } = renderHook(() => result.current.useStyleGeneration(), { wrapper });

      const request = {
        text: 'Original text',
        target_style: 'academic' as const,
        provider: 'ollama' as const,
      };

      styleResult.current.mutate(request);

      await waitFor(() => {
        expect(styleResult.current.isSuccess).toBe(true);
      });

      expect(mockStyleGeneration).toHaveBeenCalledWith({
        ...request,
        project_id: projectId,
      });
      expect(styleResult.current.data).toEqual(mockResponse);
    });
  });

  describe('nlpAnalysis', () => {
    it('should successfully call NLP analysis', async () => {
      const mockResponse = {
        result: {
          summary: 'Text summary',
          themes: ['theme1', 'theme2'],
          structure: 'Q&A format'
        }
      };
      mockNlpAnalysis.mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: nlpResult } = renderHook(() => result.current.useNlpAnalysis(), { wrapper });

      nlpResult.current.mutate('Text to analyze');

      await waitFor(() => {
        expect(nlpResult.current.isSuccess).toBe(true);
      });

      expect(mockNlpAnalysis).toHaveBeenCalledWith({
        text: 'Text to analyze',
        project_id: projectId,
      });
      expect(nlpResult.current.data).toEqual(mockResponse);
    });
  });

  describe('factChecking', () => {
    it('should successfully call fact checking', async () => {
      const mockResponse = {
        result: {
          verifications: [
            {
              original_statement: 'Test statement',
              is_accurate: true,
              verification_details: 'Confirmed accurate.'
            }
          ]
        }
      };
      mockFactChecking.mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: factResult } = renderHook(() => result.current.useFactChecking(), { wrapper });

      const request = {
        text: 'Text to fact-check',
        domain: 'history' as const,
      };

      factResult.current.mutate(request);

      await waitFor(() => {
        expect(factResult.current.isSuccess).toBe(true);
      });

      expect(mockFactChecking).toHaveBeenCalledWith({
        ...request,
        project_id: projectId,
      });
      expect(factResult.current.data).toEqual(mockResponse);
    });
  });

  describe('technicalCheck', () => {
    it('should successfully call technical check', async () => {
      const mockResponse = {
        result: '1\n00:00:01,000 --> 00:00:05,000\nTest subtitle\n'
      };
      mockTechnicalCheck.mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: techResult } = renderHook(() => result.current.useTechnicalCheck(), { wrapper });

      const request = {
        text_with_metadata: '[00:01] Speaker: Test text',
        target_format: 'SRT' as const,
      };

      techResult.current.mutate(request);

      await waitFor(() => {
        expect(techResult.current.isSuccess).toBe(true);
      });

      expect(mockTechnicalCheck).toHaveBeenCalledWith({
        ...request,
        project_id: projectId,
      });
      expect(techResult.current.data).toEqual(mockResponse);
    });
  });

  describe('loading states', () => {
    it('should track loading states correctly', async () => {
      // Make the mock take some time to resolve
      mockSemanticReconstruction.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ result: 'test' }), 100))
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: semanticResult } = renderHook(() => result.current.useSemanticReconstruction(), { wrapper });

      expect(semanticResult.current.isPending).toBe(false);

      semanticResult.current.mutate('test');

      // Wait for pending state to become true
      await waitFor(() => {
        expect(semanticResult.current.isPending).toBe(true);
      });

      await waitFor(() => {
        expect(semanticResult.current.isPending).toBe(false);
      });

      expect(semanticResult.current.isSuccess).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should log errors when mutations fail', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('API failed');
      mockSemanticReconstruction.mockRejectedValue(error);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: semanticResult } = renderHook(() => result.current.useSemanticReconstruction(), { wrapper });

      semanticResult.current.mutate('test');

      await waitFor(() => {
        expect(semanticResult.current.isError).toBe(true);
      });

      expect(consoleSpy).toHaveBeenCalledWith('AI Editor task failed:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('reset functionality', () => {
    it('should reset mutation states', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAIEditor(projectId), { wrapper });
      const { result: semanticResult } = renderHook(() => result.current.useSemanticReconstruction(), { wrapper });

      // Trigger a mutation first
      mockSemanticReconstruction.mockResolvedValue({ result: 'test' });
      semanticResult.current.mutate('test');

      await waitFor(() => {
        expect(semanticResult.current.isSuccess).toBe(true);
      });

      // Reset and verify
      semanticResult.current.reset();

      // Wait for the reset to take effect
      await waitFor(() => {
        expect(semanticResult.current.isIdle).toBe(true);
      });
      
      expect(semanticResult.current.data).toBeUndefined();
      expect(semanticResult.current.error).toBeNull();
    });
  });
});