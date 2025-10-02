/**
 * AI Correction Dialog Component
 * Shows correction suggestions and allows user to accept/reject
 */
import React, { useState, useEffect } from 'react'
import { CorrectionResponse } from '../../api/aiCorrections'
import { useUpdateSegment } from '../../hooks/useTranscription'

interface CorrectionDialogProps {
  correction: CorrectionResponse | null
  onClose: () => void
  onAccept?: () => void
}

export const CorrectionDialog: React.FC<CorrectionDialogProps> = ({
  correction,
  onClose,
  onAccept,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const updateSegment = useUpdateSegment()

  useEffect(() => {
    setIsVisible(!!correction)
  }, [correction])

  if (!correction) return null

  const hasChanges = correction.original_text !== correction.corrected_text

  const handleAccept = async () => {
    if (hasChanges) {
      try {
        await updateSegment.mutateAsync({
          segmentId: correction.segment_id,
          editedText: correction.corrected_text,
        })
        onAccept?.()
      } catch (error) {
        console.error('Failed to apply correction:', error)
      }
    }
    handleClose()
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 200) // Wait for animation
  }

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl transition-transform duration-200 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-gray-800">AI Correction Suggestion</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!hasChanges ? (
          <div className="mb-6">
            <p className="text-green-600 font-medium mb-2">✓ No corrections needed</p>
            <p className="text-gray-600">The text looks good!</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Original:</label>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-gray-800">
                {correction.original_text}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Suggested:</label>
              <div className="bg-green-50 border border-green-200 rounded p-3 text-gray-800">
                {correction.corrected_text}
              </div>
            </div>

            {correction.changes.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">Changes:</label>
                <ul className="bg-blue-50 border border-blue-200 rounded p-3 space-y-1">
                  {correction.changes.map((change, idx) => (
                    <li key={idx} className="text-sm text-gray-700">
                      • {change}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Confidence:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${correction.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {Math.round(correction.confidence * 100)}%
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {hasChanges ? 'Reject' : 'Close'}
          </button>
          {hasChanges && (
            <button
              onClick={handleAccept}
              disabled={updateSegment.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateSegment.isPending ? 'Applying...' : 'Accept'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
