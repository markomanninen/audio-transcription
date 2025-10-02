import { useState, useCallback } from 'react'
import { useUploadFile } from '../../hooks/useUpload'

interface FileUploaderProps {
  projectId: number
  onUploadComplete?: (fileId: number) => void
}

export default function FileUploader({ projectId, onUploadComplete }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const uploadMutation = useUploadFile(projectId)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileUpload(files[0])
      }
    },
    [projectId]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFileUpload(files[0])
      }
    },
    [projectId]
  )

  const handleFileUpload = (file: File) => {
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        onUploadComplete?.(data.file_id)
      },
    })
  }

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center
          transition-colors duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploadMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".mp3,.wav,.m4a,.webm,.ogg,.flac"
          onChange={handleFileSelect}
          disabled={uploadMutation.isPending}
        />

        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="space-y-4">
            <div className="text-4xl">🎤</div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                {uploadMutation.isPending ? 'Uploading...' : 'Drop audio file here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Supports: MP3, WAV, M4A, WebM, OGG, FLAC (max 500MB)
            </p>
          </div>
        </label>

        {uploadMutation.isPending && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
            </div>
          </div>
        )}
      </div>

      {uploadMutation.isError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            Upload failed: {uploadMutation.error?.message || 'Unknown error'}
          </p>
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            ✓ File uploaded successfully: {uploadMutation.data.original_filename}
          </p>
        </div>
      )}
    </div>
  )
}
