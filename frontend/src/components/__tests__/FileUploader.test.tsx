import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FileUploader from '../Upload/FileUploader'

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

describe('FileUploader', () => {
  it('renders upload area', () => {
    render(<FileUploader projectId={1} />, { wrapper: createWrapper() })

    expect(screen.getByText(/Drop audio file here/i)).toBeInTheDocument()
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument()
  })

  it('displays accepted file formats', () => {
    render(<FileUploader projectId={1} />, { wrapper: createWrapper() })

    expect(screen.getByText(/Supports: MP3, WAV, M4A, WebM, OGG, FLAC/i)).toBeInTheDocument()
  })

  it('handles drag and drop events', () => {
    render(<FileUploader projectId={1} />, { wrapper: createWrapper() })

    const dropZone = screen.getByText(/Drop audio file here/i).closest('div')

    fireEvent.dragEnter(dropZone!)
    expect(dropZone).toHaveClass('border-blue-500')

    fireEvent.dragLeave(dropZone!)
    expect(dropZone).not.toHaveClass('border-blue-500')
  })
})
