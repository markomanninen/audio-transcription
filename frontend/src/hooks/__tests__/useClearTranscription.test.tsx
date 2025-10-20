/**
 * Tests for the useClearTranscription hook
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, expect, test, beforeEach, describe } from 'vitest'
import { useClearTranscription } from '../useTranscription'
import { apiClient } from '../../api/client'

// Mock the API client
vi.mock('../../api/client', () => ({
  apiClient: {
    delete: vi.fn(),
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useClearTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should clear transcription successfully', async () => {
    const mockResponse = {
      data: {
        message: '🧹 CLEARED: Deleted 5 segments and 2 speakers',
        action: 'clear',
        deleted_segments: 5,
        deleted_speakers: 2,
        file_id: 123,
      },
    }

    vi.mocked(apiClient.delete).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useClearTranscription(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      result.current.mutate(123)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.delete).toHaveBeenCalledWith('/api/transcription/123/clear')
    expect(result.current.data).toEqual(mockResponse.data)
  })

  test('should handle clear transcription error', async () => {
    const mockError = new Error('File not found')
    vi.mocked(apiClient.delete).mockRejectedValue(mockError)

    const { result } = renderHook(() => useClearTranscription(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      result.current.mutate(123)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(apiClient.delete).toHaveBeenCalledWith('/api/transcription/123/clear')
    expect(result.current.error).toBe(mockError)
  })

  test('should call correct API endpoint with file ID', async () => {
    const mockResponse = {
      data: {
        message: '🧹 CLEARED: Deleted 0 segments and 0 speakers',
        action: 'clear',
        deleted_segments: 0,
        deleted_speakers: 0,
        file_id: 456,
      },
    }

    vi.mocked(apiClient.delete).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useClearTranscription(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      result.current.mutate(456)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.delete).toHaveBeenCalledWith('/api/transcription/456/clear')
  })

  test('should invalidate related queries on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const mockResponse = {
      data: {
        message: '🧹 CLEARED: Deleted 3 segments and 1 speakers',
        action: 'clear',
        deleted_segments: 3,
        deleted_speakers: 1,
        file_id: 789,
      },
    }

    vi.mocked(apiClient.delete).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useClearTranscription(), { wrapper })

    await waitFor(() => {
      result.current.mutate(789)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should invalidate transcription status, segments, speakers, and files
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['transcription-status', 789, 'v3'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['segments', 789, 'v3'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['speakers', 789] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['files'] })
  })
})