import { useState } from 'react'
import { useSpeakers, useUpdateSpeaker } from '../../hooks/useTranscription'

interface SpeakerManagerProps {
  fileId: number
}

export default function SpeakerManager({ fileId }: SpeakerManagerProps) {
  const { data: speakers, isLoading } = useSpeakers(fileId)
  const updateSpeaker = useUpdateSpeaker()
  const [editingSpeakerId, setEditingSpeakerId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!speakers || speakers.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500 text-sm">
        No speakers identified yet
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Speakers</h3>
      {speakers.map((speaker) => {
        const isEditing = editingSpeakerId === speaker.id

        return (
          <div
            key={speaker.id}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
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
                className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(speaker.id)
                  if (e.key === 'Escape') handleCancelEdit()
                }}
              />
            ) : (
              <span className="flex-1 text-sm font-medium text-gray-900">
                {speaker.display_name}
              </span>
            )}

            {/* Edit/Save/Cancel buttons */}
            {!isEditing ? (
              <button
                onClick={() => handleStartEdit(speaker.id, speaker.display_name)}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                title="Rename speaker"
              >
                ✏️
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(speaker.id)}
                  disabled={updateSpeaker.isPending}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
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
