import { useState, useEffect, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useSegments,
  useSpeakers,
  useUpdateSegment,
  useBulkUpdateSegmentPassive,
  useJoinSegments,
  useDeleteSegment,
  useInsertSegment,
} from '../../hooks/useTranscription'
import { useCorrectSegment } from '../../hooks/useAICorrections'
import { CorrectionDialog } from '../AI/CorrectionDialog'
import { resetCircuitBreaker } from '../../api/client'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import type { Segment } from '../../types'
import { areSegmentsConsecutive } from '../../utils/segments'
import type { CorrectionResponse } from '../../api/aiCorrections'

interface SegmentListProps {
  fileId: number
  onSegmentClick?: (segment: Segment) => void
  onPlayRequest?: () => void
  onPauseRequest?: () => void
  currentTime?: number
  isPlaying?: boolean
  llmProvider?: string
  onOpenEditor?: () => void
  exportButton?: React.ReactNode
}

export default function SegmentList({
  fileId,
  onSegmentClick,
  onPlayRequest,
  onPauseRequest,
  currentTime = 0,
  isPlaying = false,
  llmProvider = 'ollama',
  onOpenEditor,
  exportButton
}: SegmentListProps) {
  const queryClient = useQueryClient()
  const { data: segments, isLoading: segmentsLoading, error: segmentsError } = useSegments(fileId)
  const { data: speakers } = useSpeakers(fileId)
  const updateSegment = useUpdateSegment()
  const correctSegment = useCorrectSegment()
  const bulkPassive = useBulkUpdateSegmentPassive()
  const joinSegments = useJoinSegments()
  const deleteSegmentMutation = useDeleteSegment()
  const insertSegmentMutation = useInsertSegment()
  const { success: toastSuccess, error: toastError } = useToast()
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null)
  const [correctingSegmentId, setCorrectingSegmentId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null)
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<number[]>([])
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const prevFileId = useRef<number | null>(null)

  const selectedSegments = useMemo(() => {
    if (!segments) return []
    return segments.filter((segment) => selectedSegmentIds.includes(segment.id))
  }, [segments, selectedSegmentIds])

  const hasSelection = selectedSegmentIds.length > 0
  const allSelectedPassive = hasSelection && selectedSegments.every((segment) => segment.is_passive)
  const canJoinSelected = hasSelection && segments ? areSegmentsConsecutive(selectedSegmentIds, segments) : false

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
      setSelectedSegmentIds([])

      // Remove old file queries from cache
      queryClient.removeQueries({ queryKey: ['segments', previousFileId, 'v3'] })
      queryClient.removeQueries({ queryKey: ['speakers', previousFileId, 'v3'] })
    }

    prevFileId.current = fileId
  }, [fileId, queryClient])

  if (import.meta.env.DEV) {
    console.log('SegmentList render:', { fileId, segments: segments?.length, isLoading: segmentsLoading, error: segmentsError })
  }

  useEffect(() => {
    if (!segments) return
    setSelectedSegmentIds((prev) => prev.filter((id) => segments.some((segment) => segment.id === id)))
  }, [segments])

  useEffect(() => {
    const handleGlobalClick = () => setOpenMenuId(null)
    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [])

  const getSpeakerInfo = (speakerId?: number) => {
    if (!speakerId || !speakers) return null
    return speakers.find((s) => s.id === speakerId)
  }

  const handleSelectSegment = (segmentId: number, isSelected: boolean) => {
    setSelectedSegmentIds((prev) => {
      if (isSelected) {
        if (prev.includes(segmentId)) return prev
        return [...prev, segmentId]
      }
      return prev.filter((id) => id !== segmentId)
    })
  }

  const clearSelection = () => {
    setSelectedSegmentIds([])
    setOpenMenuId(null)
  }

  const handleTogglePassiveSelection = async (makePassive: boolean) => {
    if (!hasSelection) return
    try {
      const selectedIds = [...selectedSegmentIds]
      const updatedSegments = await bulkPassive.mutateAsync({ segmentIds: selectedIds, isPassive: makePassive })

      queryClient.setQueryData<Segment[]>(['segments', fileId, 'v3'], (current) => {
        if (!current) return current
        const replacements = new Map(updatedSegments.map((segment) => [segment.id, segment]))
        return current.map((segment) => replacements.get(segment.id) ?? segment)
      })

      toastSuccess(
        makePassive ? 'Segments passivated' : 'Segments reactivated',
        `${selectedIds.length} segment${selectedIds.length === 1 ? '' : 's'} updated.`
      )
      clearSelection()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      const description = error?.response?.data?.detail ?? error?.message ?? 'Unable to update segment status.'
      toastError('Update failed', description)
    }
  }

  const handleJoinSelected = async () => {
    if (!canJoinSelected || !segments) return
    try {
      const idsToJoin = [...selectedSegmentIds]
      const orderedIds = [...selectedSegmentIds]
      orderedIds.sort((a, b) => {
        if (!segments) return a - b
        const segA = segments.find((seg) => seg.id === a)
        const segB = segments.find((seg) => seg.id === b)
        if (!segA || !segB) return a - b
        return segA.sequence - segB.sequence
      })

      const merged = await joinSegments.mutateAsync({ segmentIds: orderedIds, maxGapSeconds: 2 })

      queryClient.setQueryData<Segment[]>(['segments', fileId, 'v3'], (current) => {
        if (!current) return current
        const filtered = current.filter((segment) => !idsToJoin.includes(segment.id))

        const insertIndex = filtered.findIndex((segment) => segment.sequence > merged.sequence)
        if (insertIndex === -1) {
          return [...filtered, merged]
        }
        const next = [...filtered]
        next.splice(insertIndex, 0, merged)
        return next
      })

      toastSuccess('Segments joined', 'Selected segments combined into one.')
      setSelectedSegmentIds([merged.id])
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      const description = error?.response?.data?.detail ?? error?.message ?? 'Unable to join selected segments.'
      toastError('Join failed', description)
    }
  }

  const handleDeleteSegment = async (segment: Segment) => {
    try {
      setOpenMenuId(null)
      const updated = await deleteSegmentMutation.mutateAsync(segment.id)
      queryClient.setQueryData(['segments', fileId, 'v3'], updated)
      setSelectedSegmentIds((prev) => prev.filter((id) => id !== segment.id))
      toastSuccess('Segment removed', 'Segment deleted successfully.')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      const description = error?.response?.data?.detail ?? error?.message ?? 'Unable to delete segment.'
      toastError('Delete failed', description)
    }
  }

  const handleInsertSegment = async (segment: Segment, direction: 'above' | 'below') => {
    try {
      setOpenMenuId(null)
      const inserted = await insertSegmentMutation.mutateAsync({ segmentId: segment.id, direction })
      queryClient.setQueriesData<Segment[] | undefined>({ queryKey: ['segments', fileId, 'v3'] }, (current) => {
        if (!current) return current
        const existing = current.filter((item) => item.id !== inserted.id)
        const insertIndex = existing.findIndex((item) => item.sequence >= inserted.sequence)
        const next = [...existing]
        if (insertIndex === -1) {
          next.push(inserted)
        } else {
          next.splice(insertIndex, 0, inserted)
        }
        return next.map((item, index) => ({ ...item, sequence: index }))
      })
      setSelectedSegmentIds([inserted.id])
      toastSuccess('Segment inserted', `Added new segment ${direction} the current one.`)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      const description = error?.response?.data?.detail ?? error?.message ?? 'Unable to insert segment.'
      toastError('Insert failed', description)
    }
  }

  const handleTogglePassiveSingle = async (segment: Segment) => {
    try {
      setOpenMenuId(null)
      const updated = await updateSegment.mutateAsync({ segmentId: segment.id, isPassive: !segment.is_passive })
      queryClient.setQueryData<Segment[]>(['segments', fileId, 'v3'], (current) => {
        if (!current) return current
        return current.map((item) => (item.id === updated.id ? updated : item))
      })
      toastSuccess(
        segment.is_passive ? 'Segment activated' : 'Segment passivated',
        `Segment marked as ${segment.is_passive ? 'active' : 'passive'}.`
      )
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      const description = error?.response?.data?.detail ?? error?.message ?? 'Unable to update segment.'
      toastError('Update failed', description)
    }
  }

  const isSegmentActive = (segment: Segment): boolean => {
    return currentTime >= segment.start_time && currentTime < segment.end_time
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Validate and constrain time input values
  const handleTimeInput = (value: string, type: 'start' | 'end', segmentId: number) => {
    const bounds = getSegmentTimeBounds(segmentId)
    const segment = segments?.find((s) => s.id === segmentId)
    if (!segment) return

    // Allow empty values during editing
    if (value === '' || value === '-') {
      if (type === 'start') setEditStart(value)
      else setEditEnd(value)
      return
    }

    const numericValue = parseFloat(value)
    
    // If not a valid number, reject the input
    if (isNaN(numericValue)) {
      return // Don't update state with invalid values
    }

    if (type === 'start') {
      const currentEnd = parseFloat(editEnd) || segment.end_time
      const minStart = bounds.minStart
      const maxStart = currentEnd - 0.01 // Must be less than end time
      
      // Constrain the value to valid bounds
      const constrainedValue = Math.max(minStart, Math.min(maxStart, numericValue))
      setEditStart(constrainedValue.toString())
      
      // Show warning if value was constrained
      if (constrainedValue !== numericValue) {
        if (numericValue < minStart) {
          toastError('Invalid start time', `Minimum start time is ${minStart.toFixed(2)}s`)
        } else if (numericValue >= currentEnd) {
          toastError('Invalid start time', `Start time must be less than end time (${currentEnd.toFixed(2)}s)`)
        }
      }
    } else {
      const currentStart = parseFloat(editStart) || segment.start_time
      const minEnd = currentStart + 0.01 // Must be greater than start time
      const maxEnd = bounds.maxEnd !== Infinity ? bounds.maxEnd : 999999
      
      // Constrain the value to valid bounds
      const constrainedValue = Math.max(minEnd, Math.min(maxEnd, numericValue))
      setEditEnd(constrainedValue.toString())
      
      // Show warning if value was constrained
      if (constrainedValue !== numericValue) {
        if (numericValue <= currentStart) {
          toastError('Invalid end time', `End time must be greater than start time (${currentStart.toFixed(2)}s)`)
        } else if (numericValue > maxEnd) {
          toastError('Invalid end time', `Maximum end time is ${maxEnd.toFixed(2)}s`)
        }
      }
    }
  }

  const handleStartEdit = (segment: Segment) => {
    setOpenMenuId(null)
    setEditingSegmentId(segment.id)
    setEditText(segment.edited_text || segment.original_text)
    setEditStart(segment.start_time.toString())
    setEditEnd(segment.end_time.toString())
  }

  // Get valid time bounds for the currently editing segment
  const getSegmentTimeBounds = (segmentId: number) => {
    if (!segments) return { minStart: 0, maxEnd: Infinity }

    const currentIndex = segments.findIndex((s) => s.id === segmentId)
    if (currentIndex === -1) return { minStart: 0, maxEnd: Infinity }

    const prevSegment = currentIndex > 0 ? segments[currentIndex - 1] : null
    const nextSegment = currentIndex < segments.length - 1 ? segments[currentIndex + 1] : null

    const minStart = prevSegment ? prevSegment.end_time : 0
    const maxEnd = nextSegment ? nextSegment.start_time : Infinity

    return { minStart, maxEnd }
  }

  const handleSaveEdit = async (segmentId: number) => {
    const segment = segments?.find((item) => item.id === segmentId)
    if (!segment) return

    const payload: {
      segmentId: number
      editedText?: string
      startTime?: number
      endTime?: number
    } = { segmentId }

    const trimmed = editText.trim()
    payload.editedText = trimmed

    const parsedStart = parseFloat(editStart)
    const parsedEnd = parseFloat(editEnd)

    // Client-side validation for time values
    if (!Number.isNaN(parsedStart) || !Number.isNaN(parsedEnd)) {
      const newStart = !Number.isNaN(parsedStart) ? parsedStart : segment.start_time
      const newEnd = !Number.isNaN(parsedEnd) ? parsedEnd : segment.end_time

      // Check if end > start
      if (newEnd <= newStart) {
        toastError('Invalid time range', 'End time must be greater than start time.')
        return
      }

      // Check bounds against neighboring segments
      const bounds = getSegmentTimeBounds(segmentId)

      if (newStart < bounds.minStart) {
        toastError(
          'Invalid start time',
          `Start time (${newStart.toFixed(2)}s) overlaps with previous segment. Minimum allowed: ${bounds.minStart.toFixed(2)}s`
        )
        return
      }

      if (newEnd > bounds.maxEnd) {
        toastError(
          'Invalid end time',
          `End time (${newEnd.toFixed(2)}s) overlaps with next segment. Maximum allowed: ${bounds.maxEnd.toFixed(2)}s`
        )
        return
      }

      // Add to payload if changed
      if (newStart !== segment.start_time) {
        payload.startTime = newStart
      }
      if (newEnd !== segment.end_time) {
        payload.endTime = newEnd
      }
    }

    try {
      await updateSegment.mutateAsync(payload)
      setEditingSegmentId(null)
      setEditText('')
      setEditStart('')
      setEditEnd('')
      setOpenMenuId(null)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } }; message?: string }
      const message = err?.response?.data?.detail ?? err?.message ?? 'Unable to update segment.'
      toastError('Update failed', message)
    }
  }

  const handleCancelEdit = () => {
    setEditingSegmentId(null)
    setEditText('')
    setEditStart('')
    setEditEnd('')
    setOpenMenuId(null)
  }

  const handleAICorrect = async (segment: Segment) => {
    if (segment.is_passive) {
      toastError('Segment inactive', 'Reactivate the segment before requesting AI corrections.')
      return
    }
    try {
      setCorrectingSegmentId(segment.id)
      const result = await correctSegment.mutateAsync({
        segment_id: segment.id,
        provider: llmProvider,
        correction_type: 'all'
      })
      setCorrection(result)
    } catch (err: unknown) {
      console.error('AI correction failed:', err)
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      const description = error?.response?.data?.detail ?? error?.message ?? 'Unable to correct the segment.'
      toastError('AI correction failed', description)
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
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          {exportButton}
          <div className="text-sm text-muted-foreground">
            {segments.length} segments
          </div>
        </div>
        {onOpenEditor && (
          <button
            onClick={onOpenEditor}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Open in Editor
          </button>
        )}
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
        const isSelected = selectedSegmentIds.includes(segment.id)

        return (
          <div
            key={segment.id}
            className={`
              border rounded-lg p-4 transition-all ${segment.is_passive ? 'bg-muted/60' : 'bg-card'}
              ${isActive ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-border'}
              ${isEditing ? 'border-green-500 dark:border-green-600 ring-2 ring-green-500/20' : ''}
              ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}
              ${segment.is_passive ? 'border-dashed opacity-90' : ''}
            `}
            aria-selected={isSelected}
          >
            <div className="flex items-start gap-3">
              <div className="flex items-stretch gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary-600"
                  checked={isSelected}
                  onChange={(event) => {
                    event.stopPropagation()
                    handleSelectSegment(segment.id, event.target.checked)
                  }}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Select segment ${segment.id}`}
                />
              </div>

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
                    {segment.is_passive && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                        Passive
                      </span>
                    )}
                  </div>

                  {/* Playback and Edit controls */}
                  {!isEditing ? (
                    <div className="flex items-center gap-1">
                      {isPlaying && isActive ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            onPauseRequest?.()
                          }}
                          className="px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-muted rounded transition-colors"
                          title="Pause"
                        >
                          ⏸
                        </button>
                      ) : (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            if (isActive) {
                              onPlayRequest?.()
                            } else {
                              onSegmentClick?.(segment)
                            }
                          }}
                          className="px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-muted rounded transition-colors"
                          title={isActive ? 'Play' : 'Jump to segment'}
                        >
                          ▶
                        </button>
                      )}

                      {/* Replay button - restart segment from beginning */}
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          // Seek to segment start and play
                          onSegmentClick?.(segment)
                          // Small delay to ensure seek completes before playing
                          setTimeout(() => onPlayRequest?.(), 50)
                        }}
                        className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
                        title="Replay segment from start"
                      >
                        ↻
                      </button>

                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          handleStartEdit(segment)
                        }}
                        className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
                        title="Edit segment"
                      >
                        Edit
                      </button>

                      <div className="relative">
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenMenuId((current) => (current === segment.id ? null : segment.id))
                          }}
                          className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
                          title="More actions"
                        >
                          ⋯
                        </button>
                        {openMenuId === segment.id && (
                          <div
                            className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-20"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-muted transition-colors"
                              onClick={() => handleAICorrect(segment)}
                              disabled={segment.is_passive || correctingSegmentId === segment.id || correctSegment.isPending}
                            >
                              <span>AI Correct</span>
                              {correctingSegmentId === segment.id ? <span className="animate-spin">⏳</span> : <span>✨</span>}
                            </button>
                            <button
                              className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-muted transition-colors"
                              onClick={() => handleTogglePassiveSingle(segment)}
                            >
                              <span>{segment.is_passive ? 'Mark Active' : 'Mark Passive'}</span>
                              <span>{segment.is_passive ? '▶' : '⏸'}</span>
                            </button>
                            <button
                              className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-muted transition-colors"
                              onClick={() => handleInsertSegment(segment, 'above')}
                            >
                              <span>Insert Above</span>
                              <span>↑</span>
                            </button>
                            <button
                              className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-muted transition-colors"
                              onClick={() => handleInsertSegment(segment, 'below')}
                            >
                              <span>Insert Below</span>
                              <span>↓</span>
                            </button>
                            <button
                              className="flex w-full items-center justify-between px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              onClick={() => handleDeleteSegment(segment)}
                            >
                              <span>Delete Segment</span>
                              <span>🗑️</span>
                            </button>
                          </div>
                        )}
                      </div>
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
                  <>
                    {(() => {
                      const bounds = getSegmentTimeBounds(segment.id)
                      const maxEndDisplay = bounds.maxEnd === Infinity ? '∞' : bounds.maxEnd.toFixed(2)

                      // Parse current input values for dynamic validation
                      const currentStart = parseFloat(editStart) || segment.start_time
                      const currentEnd = parseFloat(editEnd) || segment.end_time

                      // Start time constraints:
                      // - Must be >= previous segment's end (bounds.minStart)
                      // - Must be < current end time (cannot exceed own end)
                      const startMin = bounds.minStart
                      const startMax = currentEnd - 0.1 // Leave 0.1s minimum gap

                      // End time constraints:
                      // - Must be > current start time (cannot be less than own start)
                      // - Must be <= next segment's start (bounds.maxEnd)
                      const endMin = currentStart + 0.1 // Leave 0.1s minimum gap
                      const endMax = bounds.maxEnd !== Infinity ? bounds.maxEnd : undefined

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <label className="flex flex-col text-xs font-medium">
                            <span className="mb-1 text-muted-foreground uppercase tracking-wide">
                              Start (s)
                              <span className="ml-1 text-xs opacity-75">
                                {startMin.toFixed(2)} - {startMax.toFixed(2)}
                              </span>
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min={startMin}
                              max={startMax}
                              value={editStart}
                              onChange={(event) => handleTimeInput(event.target.value, 'start', segment.id)}
                              className="px-3 py-2 border border-border rounded focus-ring bg-input"
                              title={`Must be >= ${startMin.toFixed(2)}s and < ${startMax.toFixed(2)}s`}
                            />
                          </label>
                          <label className="flex flex-col text-xs font-medium">
                            <span className="mb-1 text-muted-foreground uppercase tracking-wide">
                              End (s)
                              <span className="ml-1 text-xs opacity-75">
                                {endMin.toFixed(2)} - {maxEndDisplay}
                              </span>
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min={endMin}
                              max={endMax}
                              value={editEnd}
                              onChange={(event) => handleTimeInput(event.target.value, 'end', segment.id)}
                              className="px-3 py-2 border border-border rounded focus-ring bg-input"
                              title={
                                endMax !== undefined
                                  ? `Must be > ${endMin.toFixed(2)}s and <= ${endMax.toFixed(2)}s`
                                  : `Must be > ${endMin.toFixed(2)}s`
                              }
                            />
                          </label>
                        </div>
                      )
                    })()}
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      className="w-full p-2 border border-border rounded focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
                      rows={3}
                      autoFocus
                    />
                  </>
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

      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92vw] max-w-xl md:right-6 md:left-auto md:translate-x-0 z-40 pointer-events-none">
          <div className="pointer-events-auto bg-card border border-border rounded-lg shadow-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm font-medium">
              {selectedSegmentIds.length} segment{selectedSegmentIds.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTogglePassiveSelection(!allSelectedPassive)}
                disabled={bulkPassive.isPending}
              >
                {allSelectedPassive ? 'Mark Active' : 'Mark Passive'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleJoinSelected}
                disabled={!canJoinSelected || joinSegments.isPending}
              >
                Join Selected
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      <CorrectionDialog
        correction={correction}
        onClose={() => setCorrection(null)}
        onAccept={() => setCorrection(null)}
      />
    </>
  )
}
