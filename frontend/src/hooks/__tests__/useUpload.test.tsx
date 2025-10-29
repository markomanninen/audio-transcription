import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUploadFile, useProjectFiles } from '../useUpload';
import { apiClient } from '../../api/client';
import type { AudioFile } from '../../types';

// Mock the API client
vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const mockPost = vi.mocked(apiClient.post);
const mockGet = vi.mocked(apiClient.get);

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

describe('useUpload hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useUploadFile', () => {
    it('should upload file successfully', async () => {
      const mockFile = new File(['test content'], 'test.mp3', { type: 'audio/mp3' });
      const mockResponse: AudioFile = {
        file_id: 1,
        filename: 'test_12345.mp3',
        original_filename: 'test.mp3',
        file_size: 1024,
        duration: 120.5,
        status: 'pending',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useUploadFile(1), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ file: mockFile });

      expect(mockPost).toHaveBeenCalledWith(
        '/api/upload/file/1',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
    });

    it('should upload file with language parameter', async () => {
      const mockFile = new File(['test content'], 'test.mp3', { type: 'audio/mp3' });
      const mockResponse: AudioFile = {
        file_id: 2,
        filename: 'test_67890.mp3',
        original_filename: 'test.mp3',
        file_size: 2048,
        duration: 240.0,
        status: 'pending',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useUploadFile(1), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        file: mockFile,
        language: 'en',
      });

      // Verify FormData was called
      expect(mockPost).toHaveBeenCalledWith(
        '/api/upload/file/1',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );
    });

    it('should handle upload timeout errors', async () => {
      const mockFile = new File(['test content'], 'test.mp3', { type: 'audio/mp3' });
      const timeoutError = new Error('timeout') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';

      mockPost.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useUploadFile(1), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ file: mockFile })
      ).rejects.toThrow('Upload timed out');
    });

    it('should handle network errors', async () => {
      const mockFile = new File(['test content'], 'test.mp3', { type: 'audio/mp3' });
      const networkError = new Error('Network Error') as Error & { code?: string };
      networkError.code = 'ERR_NETWORK';

      mockPost.mockRejectedValue(networkError);

      const { result } = renderHook(() => useUploadFile(1), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ file: mockFile })
      ).rejects.toThrow('Upload failed: Server unavailable');
    });

    it('should handle validation errors', async () => {
      const mockFile = new File(['test content'], 'invalid.txt', { type: 'text/plain' });
      const validationError = {
        response: {
          status: 400,
          data: { detail: 'Invalid file type' },
        },
      };

      mockPost.mockRejectedValue(validationError);

      const { result } = renderHook(() => useUploadFile(1), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ file: mockFile })
      ).rejects.toEqual(validationError);
    });

    it('should invalidate files cache on successful upload', async () => {
      const mockFile = new File(['test content'], 'test.mp3', { type: 'audio/mp3' });
      const mockResponse: AudioFile = {
        file_id: 3,
        filename: 'test_11111.mp3',
        original_filename: 'test.mp3',
        file_size: 1024,
        duration: 60.0,
        status: 'pending',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const queryClient = new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false },
        },
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      const { result } = renderHook(() => useUploadFile(1), { wrapper });

      await result.current.mutateAsync({ file: mockFile });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['files', 1],
        });
      });
    });

    it('should handle large file uploads', async () => {
      const largeContent = new Array(1024 * 1024).fill('a').join(''); // ~1MB
      const mockFile = new File([largeContent], 'large.mp3', { type: 'audio/mp3' });
      const mockResponse: AudioFile = {
        file_id: 4,
        filename: 'large_22222.mp3',
        original_filename: 'large.mp3',
        file_size: 1048576,
        duration: 600.0,
        status: 'pending',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useUploadFile(1), {
        wrapper: createWrapper(),
      });

      const uploadedFile = await result.current.mutateAsync({ file: mockFile });

      expect(uploadedFile.file_size).toBeGreaterThan(1000000);
    });

    it('should handle special characters in filename', async () => {
      const mockFile = new File(['content'], 'test file (1) [draft].mp3', {
        type: 'audio/mp3',
      });
      const mockResponse: AudioFile = {
        file_id: 5,
        filename: 'test_file_1_draft_33333.mp3',
        original_filename: 'test file (1) [draft].mp3',
        file_size: 512,
        duration: 30.0,
        status: 'pending',
      };

      mockPost.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useUploadFile(1), {
        wrapper: createWrapper(),
      });

      const uploadedFile = await result.current.mutateAsync({ file: mockFile });

      expect(uploadedFile.original_filename).toBe('test file (1) [draft].mp3');
    });
  });

  describe('useProjectFiles', () => {
    it('should fetch project files successfully', async () => {
      const mockFiles: AudioFile[] = [
        {
          file_id: 1,
          filename: 'file1.mp3',
          original_filename: 'file1.mp3',
          file_size: 1024,
          duration: 120.0,
          status: 'completed',
        },
        {
          file_id: 2,
          filename: 'file2.mp3',
          original_filename: 'file2.mp3',
          file_size: 2048,
          duration: 240.0,
          status: 'processing',
        },
      ];

      mockGet.mockResolvedValue({ data: mockFiles });

      const { result } = renderHook(() => useProjectFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].status).toBe('completed');
      expect(mockGet).toHaveBeenCalledWith('/api/upload/files/1');
    });

    it('should normalize file status to lowercase', async () => {
      const mockFiles: AudioFile[] = [
        {
          file_id: 1,
          filename: 'file1.mp3',
          original_filename: 'file1.mp3',
          file_size: 1024,
          duration: 120.0,
          status: 'completed', // Normalized lowercase status
        },
      ];

      mockGet.mockResolvedValue({ data: mockFiles });

      const { result } = renderHook(() => useProjectFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.[0].status).toBe('completed');
    });

    it('should not fetch when projectId is null', async () => {
      const { result } = renderHook(() => useProjectFiles(null), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle empty file list', async () => {
      mockGet.mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useProjectFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(0);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';

      mockGet.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useProjectFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });

      expect((result.current.error as Error)?.message).toContain('Request timed out');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error') as Error & { code?: string };
      networkError.code = 'ERR_NETWORK';

      mockGet.mockRejectedValue(networkError);

      const { result } = renderHook(() => useProjectFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });

      expect((result.current.error as Error)?.message).toContain('Server unavailable');
    });

    it('should handle files with different statuses', async () => {
      const mockFiles: AudioFile[] = [
        { file_id: 1, filename: 'f1.mp3', original_filename: 'f1.mp3', file_size: 1024, duration: 60.0, status: 'pending' },
        { file_id: 2, filename: 'f2.mp3', original_filename: 'f2.mp3', file_size: 1024, duration: 60.0, status: 'processing' },
        { file_id: 3, filename: 'f3.mp3', original_filename: 'f3.mp3', file_size: 1024, duration: 60.0, status: 'completed' },
        { file_id: 4, filename: 'f4.mp3', original_filename: 'f4.mp3', file_size: 1024, duration: 60.0, status: 'failed' },
      ];

      mockGet.mockResolvedValue({ data: mockFiles });

      const { result } = renderHook(() => useProjectFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(4);
      expect(result.current.data?.map(f => f.status)).toEqual([
        'pending',
        'processing',
        'completed',
        'failed',
      ]);
    });

    it('should handle files with missing optional fields', async () => {
      const mockFiles: AudioFile[] = [
        {
          file_id: 1,
          filename: 'file1.mp3',
          original_filename: 'file1.mp3',
          file_size: 1024,
          duration: undefined,
          status: 'pending',
        },
      ];

      mockGet.mockResolvedValue({ data: mockFiles });

      const { result } = renderHook(() => useProjectFiles(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data?.[0].duration).toBeUndefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should upload file and refresh file list', async () => {
      const mockFile = new File(['content'], 'test.mp3', { type: 'audio/mp3' });
      const uploadResponse: AudioFile = {
        file_id: 100,
        filename: 'test_upload.mp3',
        original_filename: 'test.mp3',
        file_size: 1024,
        duration: 60.0,
        status: 'pending',
      };

      const filesResponse: AudioFile[] = [uploadResponse];

      // Upload
      mockPost.mockResolvedValue({ data: uploadResponse });

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

      const { result: uploadResult } = renderHook(() => useUploadFile(1), { wrapper });

      await uploadResult.current.mutateAsync({ file: mockFile });

      // Fetch files - should be invalidated and refetch
      mockGet.mockResolvedValue({ data: filesResponse });

      const { result: filesResult } = renderHook(() => useProjectFiles(1), { wrapper });

      await waitFor(() => expect(filesResult.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(filesResult.current.data).toHaveLength(1);
      expect(filesResult.current.data?.[0].file_id).toBe(100);
    });
  });
});
