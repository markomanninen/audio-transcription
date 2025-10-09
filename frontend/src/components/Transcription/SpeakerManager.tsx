import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSpeakers, useUpdateSpeaker } from '../../hooks/useTranscription'

interface SpeakerManagerProps {
  fileId: number
}

export default function SpeakerManager({ fileId }: SpeakerManagerProps) {
  const queryClient = useQueryClient()
  const { data: speakers, isLoading } = useSpeakers(fileId)
  const updateSpeaker = useUpdateSpeaker()
  const [editingSpeakerId, setEditingSpeakerId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const prevFileId = useRef<number | null>(null)

  // Detect file ID changes and clear state
  useEffect(() => {
    const previousFileId = prevFileId.current

    if (previousFileId !== null && previousFileId !== fileId) {
      if (import.meta.env.DEV) {
        console.log(`[SpeakerManager] File ID changed from ${previousFileId} to ${fileId} - clearing state`)
      }

      // Clear editing state when file changes
      setEditingSpeakerId(null)
      setEditName('')

      // Remove old file queries from cache
      queryClient.removeQueries({ queryKey: ['speakers', previousFileId, 'v3'] })
    }

    prevFileId.current = fileId
  }, [fileId, queryClient])

  const handleStartEdit = (speakerId: number, currentName: string) => {
    setEditingSpeakerId(speakerId)
    setEditName(currentName)
  }

  const handleSaveEdit = async (speakerId: number) => {
    if (editName.trim()) {
      await updateSpeaker.mutateAsync({ speakerId, displayName: editName.trim() })
      setEditingSpeakerId(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingSpeakerId(null)
    setEditName('')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!speakers || speakers.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground text-sm">
        No speakers identified yet
      </div>
    )
  }

  return (
    <div
      className="space-y-2"
      data-component="speaker-manager"
      data-file-id={fileId}
      data-speaker-count={speakers.length}
      data-testid={`speaker-manager-${fileId}`}
    >
      <h3 className="text-sm font-semibold mb-3">Speakers</h3>
      {speakers.map((speaker) => {
        const isEditing = editingSpeakerId === speaker.id

        return (
          <div
            key={speaker.id}
            className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card"
          >
            {/* Color indicator */}
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: speaker.color }}
            />

            {/* Speaker name - editable or display */}
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-2 py-1 border border-border rounded focus-ring text-sm bg-input text-input-foreground placeholder:text-muted-foreground"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(speaker.id)
                  if (e.key === 'Escape') handleCancelEdit()
                }}
              />
            ) : (
              <span className="flex-1 text-sm font-medium">
                {speaker.display_name}
              </span>
            )}

            {/* Edit/Save/Cancel buttons */}
            {!isEditing ? (
              <button
                onClick={() => handleStartEdit(speaker.id, speaker.display_name)}
                className="px-2 py-1 text-xs hover:bg-muted rounded"
                title="Rename speaker"
              >
                ✏️
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(speaker.id)}
                  disabled={updateSpeaker.isPending}
                  className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
