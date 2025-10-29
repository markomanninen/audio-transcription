import { useState, useEffect, useCallback, useRef } from 'react'
import { useSplitAndBatchTranscribe } from '../../hooks/useTranscription'
import { useToast } from '../../hooks/useToast'

interface SplitBatchDialogProps {
  open: boolean
  fileId: number
  fileName: string
  projectId: number
  onClose: () => void
  onBatchBegin?: (params: { parentId: number; chunks: { fileId: number; originalFilename: string }[] }) => void
}

const MODEL_OPTIONS = [
  { value: '', label: 'Use project default' },
  { value: 'tiny', label: 'tiny (fastest)' },
  { value: 'tiny.en', label: 'tiny.en' },
  { value: 'base', label: 'base' },
  { value: 'base.en', label: 'base.en' },
  { value: 'small', label: 'small' },
  { value: 'small.en', label: 'small.en' },
  { value: 'medium', label: 'medium' },
  { value: 'medium.en', label: 'medium.en' },
  { value: 'turbo', label: 'turbo' },
  { value: 'large', label: 'large' },
  { value: 'large-v1', label: 'large-v1' },
  { value: 'large-v2', label: 'large-v2' },
  { value: 'large-v3', label: 'large-v3' },
]

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Auto detect' },
  { value: 'en', label: 'English' },
  { value: 'fi', label: 'Finnish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
]

export default function SplitBatchDialog({
  open,
  onClose,
  fileId,
  fileName,
  projectId,
  onBatchBegin,
}: SplitBatchDialogProps) {
  const [chunkDurationMinutes, setChunkDurationMinutes] = useState(5)
  const [overlapSeconds, setOverlapSeconds] = useState(10)
  const [language, setLanguage] = useState('')
  const [modelSize, setModelSize] = useState('medium') // Default to medium for better testing
  const [startTranscription, setStartTranscription] = useState(true)
  const [includeDiarization, setIncludeDiarization] = useState(false)

  const splitMutation = useSplitAndBatchTranscribe(projectId)
  const { success, error } = useToast()
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  // Load saved settings from localStorage when dialog opens
  useEffect(() => {
    if (open) {
      try {
        const savedSettings = localStorage.getItem('lastUsedTranscriptionSettings')
        if (savedSettings) {
          const settings = JSON.parse(savedSettings)
          setLanguage(settings.language === 'auto' ? '' : settings.language || '')
          setModelSize(settings.model_size || 'medium')
          setIncludeDiarization(settings.use_diarization || false)
        }
      } catch (error) {
        console.warn('Failed to load saved transcription settings:', error)
      }
    }
  }, [open])

  const handleClose = useCallback(() => {
    if (!splitMutation.isPending) {
      onClose()
    }
  }, [splitMutation.isPending, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        handleClose()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, handleClose])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (chunkDurationMinutes <= 0) {
      error('Invalid chunk duration', 'Chunk duration must be greater than zero.')
      return
    }

    try {
      const response = await splitMutation.mutateAsync({
        fileId,
        chunkDurationSeconds: Math.round(chunkDurationMinutes * 60),
        overlapSeconds: Math.max(overlapSeconds, 0),
        startTranscription,
        includeDiarization,
        modelSize: modelSize.trim() || undefined,
        language: language || null,
      })

      success(
        'Audio split completed',
        `Created ${response.created_files.length} chunk${response.created_files.length === 1 ? '' : 's'} from ${fileName}.`
      )

      if (onBatchBegin && response.created_files.length > 0) {
        onBatchBegin({
          parentId: fileId,
          chunks: response.created_files.map((chunk) => ({
            fileId: chunk.file_id,
            originalFilename: chunk.original_filename,
          })),
        })
      }

      onClose()
    } catch (err: unknown) {
      const error_obj = err as { response?: { data?: { detail?: string } }; message?: string }
      const description =
        error_obj?.response?.data?.detail ||
        error_obj?.message ||
        'Unable to split audio. Please verify the chunk duration and try again.'
      error('Split failed', description)

      // Close modal even on error - files may have been created
      // User can check the file list to see what was created
      onClose()
    }
  }

  if (!open) return null

  const handleBackdropMouseDown = (event: React.MouseEvent) => {
    // Record where the mouse down started
    mouseDownTargetRef.current = event.target
  }

  const handleBackdropMouseUp = (event: React.MouseEvent) => {
    // Only close if both mouse down and mouse up happened on the backdrop
    if (
      event.target === event.currentTarget && 
      mouseDownTargetRef.current === event.currentTarget
    ) {
      handleClose()
    }
    // Reset the ref
    mouseDownTargetRef.current = null
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div 
        className="bg-card rounded-lg p-6 max-w-lg w-full mx-4 border border-border shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-1">Split Audio & Batch Transcribe</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure how to split <span className="font-medium">{fileName}</span> into manageable chunks.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Chunk duration (minutes)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={chunkDurationMinutes}
                onChange={(event) => setChunkDurationMinutes(Number(event.target.value))}
                className="px-3 py-2 border border-border rounded-lg focus-ring bg-input"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Overlap (seconds)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={overlapSeconds}
                onChange={(event) => setOverlapSeconds(Number(event.target.value))}
                className="px-3 py-2 border border-border rounded-lg focus-ring bg-input"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Language override (optional)</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus-ring bg-input"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value || 'auto'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Model override (optional)</span>
              <select
                value={modelSize}
                onChange={(event) => setModelSize(event.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus-ring bg-input"
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value || 'default'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={startTranscription}
                onChange={(event) => setStartTranscription(event.target.checked)}
                className="h-4 w-4 text-primary-600 border-border rounded focus:ring-primary-500"
              />
              <span>Start transcription automatically for each chunk</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
              <input
                type="checkbox"
                checked={includeDiarization}
                disabled={!startTranscription}
                onChange={(event) => setIncludeDiarization(event.target.checked)}
                className="h-4 w-4 text-primary-600 border-border rounded focus:ring-primary-500 disabled:opacity-50"
              />
              <span>Include speaker diarization</span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={splitMutation.isPending}
              className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={splitMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {splitMutation.isPending ? 'Splitting…' : 'Split & Process'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
