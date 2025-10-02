import { useSegments, useSpeakers } from '../../hooks/useTranscription'
import type { Segment } from '../../types'

interface SegmentListProps {
  fileId: number
  onSegmentClick?: (segment: Segment) => void
  currentTime?: number
}

export default function SegmentList({ fileId, onSegmentClick, currentTime = 0 }: SegmentListProps) {
  const { data: segments, isLoading: segmentsLoading, error: segmentsError } = useSegments(fileId)
  const { data: speakers } = useSpeakers(fileId)

  console.log('SegmentList render:', { fileId, segments, isLoading: segmentsLoading, error: segmentsError })

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

  if (segmentsLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading segments...</span>
      </div>
    )
  }

  if (segmentsError) {
    return (
      <div className="text-center p-8 text-red-600">
        <p>Error loading segments: {segmentsError.message}</p>
      </div>
    )
  }

  if (!segments || segments.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>No transcription segments available yet.</p>
        <p className="text-xs mt-2">Transcription may still be in progress.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {segments.map((segment) => {
        const speaker = getSpeakerInfo(segment.speaker_id)
        const isActive = isSegmentActive(segment)

        return (
          <div
            key={segment.id}
            onClick={() => onSegmentClick?.(segment)}
            className={`
              border rounded-lg p-4 cursor-pointer transition-all
              ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
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
                <div className="flex items-center gap-2 mb-2">
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
                  <span className="text-xs text-gray-500">
                    {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                  </span>
                </div>

                {/* Text content */}
                <p className="text-gray-900">
                  {segment.edited_text || segment.original_text}
                </p>

                {/* Show if edited */}
                {segment.edited_text && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    Original: {segment.original_text}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
