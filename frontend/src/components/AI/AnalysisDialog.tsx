/**
 * AI Project Analysis Dialog Component
 * Analyzes project content and suggests content type and description
 */
import React, { useState } from 'react'
import { useAnalyzeProject, useApplyAnalysis } from '../../hooks/useAIAnalysis'
import { ProjectAnalysisResponse } from '../../api/aiAnalysis'

interface AnalysisDialogProps {
  isOpen: boolean
  onClose: () => void
  projectId: number
  currentProvider: string
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  general: 'General Transcription',
  interview: 'Interview / Conversation',
  lyrics: 'Song Lyrics',
  academic: 'Academic / Research',
  literature: 'Book / Literature',
  media: 'Podcast / Show',
  presentation: 'Lecture / Presentation',
}

export const AnalysisDialog: React.FC<AnalysisDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  currentProvider,
}) => {
  const [analysis, setAnalysis] = useState<ProjectAnalysisResponse | null>(null)
  const analyzeProject = useAnalyzeProject()
  const applyAnalysis = useApplyAnalysis()

  const handleAnalyze = async () => {
    try {
      const result = await analyzeProject.mutateAsync({
        projectId,
        provider: currentProvider,
      })
      setAnalysis(result)
    } catch (error) {
      console.error('Analysis failed:', error)
    }
  }

  const handleApply = async () => {
    if (!analysis) return

    try {
      await applyAnalysis.mutateAsync({
        projectId,
        contentType: analysis.suggested_content_type,
        description: analysis.suggested_description,
      })
      onClose()
    } catch (error) {
      console.error('Failed to apply analysis:', error)
    }
  }

  const handleClose = () => {
    setAnalysis(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">🔍 AI Content Analysis</h2>
            <p className="text-sm text-gray-600 mt-1">
              Detect content type to improve AI correction accuracy
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!analysis ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <p className="text-sm text-blue-800">
                <strong>Why content type matters:</strong>
              </p>
              <ul className="text-sm text-blue-700 space-y-1 ml-4">
                <li>• <strong>Lyrics</strong>: Preserves verse structure, allows poetic license</li>
                <li>• <strong>Academic</strong>: Ensures formal language and proper terminology</li>
                <li>• <strong>Interview</strong>: Keeps conversational tone and natural speech</li>
                <li>• <strong>Other types</strong>: Apply appropriate correction guidelines</li>
              </ul>
              <p className="text-xs text-blue-600 mt-2">
                AI will analyze your transcription and suggest the best content type
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Using provider:</span>
              <span className="px-2 py-1 bg-gray-100 rounded font-medium">{currentProvider}</span>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzeProject.isPending}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {analyzeProject.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Analyzing...
                </span>
              ) : (
                '🔍 Analyze Content'
              )}
            </button>

            {analyzeProject.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  Analysis failed. Please make sure you have transcribed content and the LLM provider
                  is available.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Suggested Content Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggested Content Type
              </label>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-green-800">
                      {CONTENT_TYPE_LABELS[analysis.suggested_content_type] ||
                        analysis.suggested_content_type}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Confidence: {Math.round(analysis.confidence * 100)}%
                    </p>
                  </div>
                  <div className="flex-1 max-w-xs ml-4">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${analysis.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reasoning</label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">{analysis.reasoning}</p>
              </div>
            </div>

            {/* Suggested Description */}
            {analysis.suggested_description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suggested Description
                </label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-700">{analysis.suggested_description}</p>
                </div>
              </div>
            )}

            {/* What happens next */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>💡 What happens when you apply:</strong>
              </p>
              <ul className="text-xs text-purple-700 mt-2 space-y-1 ml-4">
                <li>✓ Content type sets AI correction style for this project</li>
                <li>✓ Description helps you organize multiple projects</li>
                <li>✓ Click ✨ on any segment to get style-aware corrections</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setAnalysis(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                🔄 Re-analyze
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applyAnalysis.isPending}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-colors font-medium"
              >
                {applyAnalysis.isPending ? 'Applying...' : '✓ Apply & Use for Corrections'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
