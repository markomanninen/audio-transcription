import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProjects,
  useProject,
  useCreateAudioProject,
  useCreateTextProject,
  useUpdateProject,
  useDeleteProject,
} from '../useProjects';
import { apiClient } from '../../api/client';
import type { Project } from '../../types';

// Mock the API client
vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

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

describe('useProjects hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProjects', () => {
    it('should fetch all projects successfully', async () => {
      const mockProjects: Project[] = [
        {
          id: 1,
          name: 'Project 1',
          description: 'First project',
          project_type: 'audio',
          content_type: 'interview',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Project 2',
          description: 'Second project',
          project_type: 'text',
          content_type: 'general',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockGet.mockResolvedValue({ data: mockProjects });

      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe('Project 1');
      expect(mockGet).toHaveBeenCalledWith('/api/projects/');
    });

    it('should handle empty project list', async () => {
      mockGet.mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toHaveLength(0);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Failed to fetch projects');
      mockGet.mockRejectedValue(error);

      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useProject', () => {
    it('should fetch single project successfully', async () => {
      const mockProject: Project = {
        id: 1,
        name: 'My Project',
        description: 'Test description',
        project_type: 'audio',
        content_type: 'podcast',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockGet.mockResolvedValue({ data: mockProject });

      const { result } = renderHook(() => useProject(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), {
        timeout: 3000,
      });

      expect(result.current.data).toEqual(mockProject);
      expect(mockGet).toHaveBeenCalledWith('/api/projects/1');
    });

    it('should not fetch when projectId is null', async () => {
      const { result } = renderHook(() => useProject(null), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle project not found', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { detail: 'Project not found' },
        },
      };
      mockGet.mockRejectedValue(notFoundError);

      const { result } = renderHook(() => useProject(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 3000,
      });
    });
  });

  describe('useCreateAudioProject', () => {
    it('should create audio project successfully', async () => {
      const mockProject: Project = {
        id: 10,
        name: 'New Audio Project',
        description: 'Test audio project',
        project_type: 'audio',
        content_type: 'interview',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockPost.mockResolvedValue({ data: mockProject });

      const { result } = renderHook(() => useCreateAudioProject(), {
        wrapper: createWrapper(),
      });

      const createdProject = await result.current.mutateAsync({
        name: 'New Audio Project',
        description: 'Test audio project',
        content_type: 'interview',
      });

      expect(createdProject).toEqual(mockProject);
      expect(mockPost).toHaveBeenCalledWith('/api/upload/project', {
        name: 'New Audio Project',
        description: 'Test audio project',
        content_type: 'interview',
      });
    });

    it('should create project without optional fields', async () => {
      const mockProject: Project = {
        id: 11,
        name: 'Minimal Project',
        description: null,
        project_type: 'audio',
        content_type: 'general',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockPost.mockResolvedValue({ data: mockProject });

      const { result } = renderHook(() => useCreateAudioProject(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ name: 'Minimal Project' });

      expect(mockPost).toHaveBeenCalledWith('/api/upload/project', {
        name: 'Minimal Project',
      });
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';

      mockPost.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useCreateAudioProject(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ name: 'Test' })
      ).rejects.toThrow('Create operation timed out');
    });

    it('should invalidate projects cache on success', async () => {
      const mockProject: Project = {
        id: 12,
        name: 'Cache Test',
        project_type: 'audio',
        content_type: 'general',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockPost.mockResolvedValue({ data: mockProject });

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

      const { result } = renderHook(() => useCreateAudioProject(), { wrapper });

      await result.current.mutateAsync({ name: 'Cache Test' });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
      });
    });
  });

  describe('useCreateTextProject', () => {
    it('should create text project successfully', async () => {
      const mockProject: Project = {
        id: 20,
        name: 'New Text Project',
        description: 'Test text project',
        project_type: 'text',
        content_type: 'general',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockPost.mockResolvedValue({ data: mockProject });

      const { result } = renderHook(() => useCreateTextProject(), {
        wrapper: createWrapper(),
      });

      const createdProject = await result.current.mutateAsync({
        name: 'New Text Project',
        description: 'Test text project',
        content: 'Initial content',
      });

      expect(createdProject).toEqual(mockProject);
      expect(mockPost).toHaveBeenCalledWith('/api/projects/text', {
        name: 'New Text Project',
        description: 'Test text project',
        content: 'Initial content',
      });
    });

    it('should create text project with empty content', async () => {
      const mockProject: Project = {
        id: 21,
        name: 'Empty Text Project',
        project_type: 'text',
        content_type: 'general',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockPost.mockResolvedValue({ data: mockProject });

      const { result } = renderHook(() => useCreateTextProject(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        name: 'Empty Text Project',
        content: '',
      });

      expect(mockPost).toHaveBeenCalled();
    });
  });

  describe('useUpdateProject', () => {
    it('should update project successfully', async () => {
      const mockProject: Project = {
        id: 30,
        name: 'Updated Project',
        description: 'Updated description',
        project_type: 'audio',
        content_type: 'lecture',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockPut.mockResolvedValue({ data: mockProject });

      const { result } = renderHook(() => useUpdateProject(), {
        wrapper: createWrapper(),
      });

      const updatedProject = await result.current.mutateAsync({
        projectId: 30,
        data: {
          name: 'Updated Project',
          description: 'Updated description',
          content_type: 'lecture',
        },
      });

      expect(updatedProject).toEqual(mockProject);
      expect(mockPut).toHaveBeenCalledWith('/api/upload/project/30', {
        name: 'Updated Project',
        description: 'Updated description',
        content_type: 'lecture',
      });
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout') as Error & { code?: string };
      timeoutError.code = 'ECONNABORTED';

      mockPut.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useUpdateProject(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          projectId: 1,
          data: { name: 'Test' },
        })
      ).rejects.toThrow('Save operation timed out');
    });

    it('should invalidate both projects list and single project cache', async () => {
      const mockProject: Project = {
        id: 31,
        name: 'Cache Invalidation Test',
        project_type: 'audio',
        content_type: 'general',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockPut.mockResolvedValue({ data: mockProject });

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

      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      await result.current.mutateAsync({
        projectId: 31,
        data: { name: 'Cache Invalidation Test' },
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 31] });
      });
    });
  });

  describe('useDeleteProject', () => {
    it('should delete project successfully', async () => {
      mockDelete.mockResolvedValue({ data: undefined });

      const { result } = renderHook(() => useDeleteProject(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(40);

      expect(mockDelete).toHaveBeenCalledWith('/api/upload/project/40');
    });

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed');
      mockDelete.mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteProject(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync(999)).rejects.toThrow('Delete failed');
    });

    it('should invalidate projects cache on successful delete', async () => {
      mockDelete.mockResolvedValue({ data: undefined });

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

      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      await result.current.mutateAsync(41);

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
      });
    });
  });

  describe('Integration workflows', () => {
    it('should support create → fetch → update → delete workflow', async () => {
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

      // 1. Create
      const createProject: Project = {
        id: 100,
        name: 'Workflow Test',
        project_type: 'audio',
        content_type: 'general',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockPost.mockResolvedValue({ data: createProject });

      const { result: createResult } = renderHook(() => useCreateAudioProject(), { wrapper });
      await createResult.current.mutateAsync({ name: 'Workflow Test' });

      // 2. Fetch
      mockGet.mockResolvedValue({ data: createProject });
      const { result: fetchResult } = renderHook(() => useProject(100), { wrapper });
      await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true), { timeout: 3000 });

      // 3. Update
      const updatedProject = { ...createProject, name: 'Workflow Test Updated' };
      mockPut.mockResolvedValue({ data: updatedProject });

      const { result: updateResult } = renderHook(() => useUpdateProject(), { wrapper });
      await updateResult.current.mutateAsync({
        projectId: 100,
        data: { name: 'Workflow Test Updated' },
      });

      // 4. Delete
      mockDelete.mockResolvedValue({ data: undefined });
      const { result: deleteResult } = renderHook(() => useDeleteProject(), { wrapper });
      await deleteResult.current.mutateAsync(100);

      expect(mockPost).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
