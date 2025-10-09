import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSegments, useSpeakers, useUpdateSegment } from '../../hooks/useTranscription'
import { useCorrectSegment } from '../../hooks/useAICorrections'
import { CorrectionDialog } from '../AI/CorrectionDialog'
import { resetCircuitBreaker } from '../../api/client'
import { Button } from '../ui/Button'
import type { Segment } from '../../types'
import type { CorrectionResponse } from '../../api/aiCorrections'

interface SegmentListProps {
  fileId: number
  onSegmentClick?: (segment: Segment) => void
  onPlayRequest?: () => void
  onPauseRequest?: () => void
  currentTime?: number
  isPlaying?: boolean
  llmProvider?: string
}

export default function SegmentList({
  fileId,
  onSegmentClick,
  onPlayRequest,
  onPauseRequest,
  currentTime = 0,
  isPlaying = false,
  llmProvider = 'ollama'
}: SegmentListProps) {
  const queryClient = useQueryClient()
  const { data: segments, isLoading: segmentsLoading, error: segmentsError } = useSegments(fileId)
  const { data: speakers } = useSpeakers(fileId)
  const updateSegment = useUpdateSegment()
  const correctSegment = useCorrectSegment()
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null)
  const [correctingSegmentId, setCorrectingSegmentId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null)
  const prevFileId = useRef<number | null>(null)

  // Detect file ID changes and clear state
  useEffect(() => {
    const previousFileId = prevFileId.current

    if (previousFileId !== null && previousFileId !== fileId) {
      if (import.meta.env.DEV) {
        console.log(`[SegmentList] File ID changed from ${previousFileId} to ${fileId} - clearing state`)
      }

      // Clear editing state when file changes
      setEditingSegmentId(null)
      setCorrectingSegmentId(null)
      setEditText('')
      setCorrection(null)

      // Remove old file queries from cache
      queryClient.removeQueries({ queryKey: ['segments', previousFileId, 'v3'] })
      queryClient.removeQueries({ queryKey: ['speakers', previousFileId, 'v3'] })
    }

    prevFileId.current = fileId
  }, [fileId, queryClient])

  if (import.meta.env.DEV) {
    console.log('SegmentList render:', { fileId, segments: segments?.length, isLoading: segmentsLoading, error: segmentsError })
  }

  const getSpeakerInfo = (speakerId?: number) => {
    if (!speakerId || !speakers) return null
    return speakers.find((s) => s.id === speakerId)
  }

  const isSegmentActive = (segment: Segment): boolean => {
    return currentTime >= segment.start_time && currentTime < segment.end_time
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartEdit = (segment: Segment) => {
    setEditingSegmentId(segment.id)
    setEditText(segment.edited_text || segment.original_text)
  }

  const handleSaveEdit = async (segmentId: number) => {
    if (editText.trim()) {
      await updateSegment.mutateAsync({ segmentId, editedText: editText.trim() })
      setEditingSegmentId(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingSegmentId(null)
    setEditText('')
  }

  const handleAICorrect = async (segment: Segment) => {
    try {
      setCorrectingSegmentId(segment.id)
      const result = await correctSegment.mutateAsync({
        segment_id: segment.id,
        provider: llmProvider,
        correction_type: 'all'
      })
      setCorrection(result)
    } catch (error) {
      console.error('AI correction failed:', error)
    } finally {
      setCorrectingSegmentId(null)
    }
  }

  if (segmentsLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-muted-foreground">Loading segments...</span>
      </div>
    )
  }

  if (segmentsError) {
    const isCircuitBreakerError = segmentsError.message?.includes('circuit breaker')
    
    return (
      <div className="text-center p-8">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <p>Error loading segments: {segmentsError.message}</p>
        </div>
        {isCircuitBreakerError && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The backend is under heavy load during transcription. Please wait a moment.
            </p>
            <Button
              onClick={() => {
                resetCircuitBreaker()
                window.location.reload()
              }}
              variant="outline"
              size="sm"
            >
              Reset Connection
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (!segments || segments.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>No transcription segments available yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 text-sm text-muted-foreground">
        {segments.length} segments
      </div>
      <div
        className="space-y-2"
        data-component="segment-list"
        data-file-id={fileId}
        data-segment-count={segments.length}
        data-testid={`segment-list-${fileId}`}
      >
        {segments.map((segment) => {
        const speaker = getSpeakerInfo(segment.speaker_id)
        const isActive = isSegmentActive(segment)
        const isEditing = editingSegmentId === segment.id

        return (
          <div
            key={segment.id}
            className={`
              border rounded-lg p-4 transition-all bg-card
              ${isActive ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-border'}
              ${isEditing ? 'border-green-500 dark:border-green-600 ring-2 ring-green-500/20' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              {/* Speaker indicator */}
              {speaker && (
                <div
                  className="w-1 h-full rounded-full"
                  style={{ backgroundColor: speaker.color }}
                />
              )}

              <div className="flex-1 min-w-0">
                {/* Header with speaker and time */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {speaker && (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${speaker.color}20`,
                          color: speaker.color,
                        }}
                      >
                        {speaker.display_name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                    </span>
                  </div>

                  {/* Playback and Edit controls */}
                  {!isEditing ? (
                    <div className="flex gap-1">
                      {/* Play/Pause button */}
                      {isPlaying && isActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onPauseRequest?.()
                          }}
                          className="px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-muted rounded transition-colors"
                          title="Pause"
                        >
                          ⏸
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // If active segment, just resume playing from current position
                            // If not active, seek to this segment's start
                            if (isActive) {
                              onPlayRequest?.()
                            } else {
                              onSegmentClick?.(segment)
                            }
                          }}
                          className="px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-muted rounded transition-colors"
                          title={isActive ? "Play" : "Jump to segment"}
                        >
                          ▶
                        </button>
                      )}

                      {/* Replay button - only show if this segment is active */}
                      {isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Always seek to start of segment
                            onSegmentClick?.(segment)
                          }}
                          className="px-2 py-1 text-xs hover:bg-muted rounded transition-colors"
                          title="Replay segment from start"
                        >
                          ↻
                        </button>
                      )}

                      <button
                        onClick={() => handleAICorrect(segment)}
                        disabled={correctingSegmentId === segment.id}
                        className="px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-muted rounded transition-colors disabled:opacity-50 relative"
                        title="AI Correct"
                      >
                        {correctingSegmentId === segment.id ? (
                          <span className="inline-block animate-spin">⏳</span>
                        ) : (
                          '✨'
                        )}
                      </button>
                      <button
                        onClick={() => handleStartEdit(segment)}
                        className="px-2 py-1 text-xs hover:bg-muted rounded transition-colors"
                        title="Edit"
                      >
                        ✏️
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(segment.id)}
                        disabled={updateSegment.isPending}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-xs bg-muted rounded hover:bg-muted/80"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Text content - editable or display */}
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-2 border border-border rounded focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
                    rows={3}
                    autoFocus
                  />
                ) : (
                  <>
                    <p className="text-foreground">
                      {segment.edited_text || segment.original_text}
                    </p>

                    {/* Show if edited */}
                    {segment.edited_text && (
                      <div className="mt-2 text-xs text-muted-foreground italic">
                        Original: {segment.original_text}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
        })}
      </div>

      <CorrectionDialog
        correction={correction}
        onClose={() => setCorrection(null)}
        onAccept={() => setCorrection(null)}
      />
    </>
  )
}
