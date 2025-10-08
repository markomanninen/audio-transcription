import { useState, useCallback } from 'react'
import { useUploadFile } from '../../hooks/useUpload'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../../constants/languages'

interface FileUploaderProps {
  projectId: number
  onUploadComplete?: (fileId: number) => void
}

export default function FileUploader({ projectId, onUploadComplete }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE)
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
    uploadMutation.mutate(
      {
        file,
        language: selectedLanguage || undefined,
      },
      {
        onSuccess: (data) => {
          onUploadComplete?.(data.file_id)
        },
      }
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Language Selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="language-select" className="text-sm font-medium">
          Transcription Language:
        </label>
        <select
          id="language-select"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="h-11 px-3 border border-border rounded-lg focus-ring bg-input text-input-foreground"
          disabled={uploadMutation.isPending}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {selectedLanguage ? 'Selected language will be used for transcription' : 'Language will be auto-detected'}
        </span>
      </div>

      {/* File Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center bg-card
          transition-colors duration-200
          ${isDragging ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-border hover:border-primary-400'}
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
          accept=".mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac"
          onChange={handleFileSelect}
          disabled={uploadMutation.isPending}
        />

        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="space-y-4">
            <div className="text-4xl">🎤</div>
            <div>
              <p className="text-lg font-medium">
                {uploadMutation.isPending ? 'Uploading...' : 'Drop audio file here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports: MP3, WAV, M4A, MP4, WebM, OGG, FLAC (max 500MB)
            </p>
          </div>
        </label>

        {uploadMutation.isPending && (
          <div className="mt-4">
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full animate-pulse w-1/2"></div>
            </div>
          </div>
        )}
      </div>

      {uploadMutation.isError && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            Upload failed: {uploadMutation.error?.message || 'Unknown error'}
          </p>
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✓ File uploaded successfully: {uploadMutation.data.original_filename}
          </p>
        </div>
      )}
    </div>
  )
}
