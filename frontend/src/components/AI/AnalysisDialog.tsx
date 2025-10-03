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
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold">🔍 AI Content Analysis</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Detect content type to improve AI correction accuracy
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!analysis ? (
          <div className="space-y-4">
            <div className="p-4 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg space-y-2">
              <p className="text-sm font-medium">
                <strong>Why content type matters:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <strong>Lyrics</strong>: Preserves verse structure, allows poetic license</li>
                <li>• <strong>Academic</strong>: Ensures formal language and proper terminology</li>
                <li>• <strong>Interview</strong>: Keeps conversational tone and natural speech</li>
                <li>• <strong>Other types</strong>: Apply appropriate correction guidelines</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                AI will analyze your transcription and suggest the best content type
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span>Using provider:</span>
              <span className="px-2 py-1 bg-muted rounded font-medium">{currentProvider}</span>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzeProject.isPending}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
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
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
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
              <label className="block text-sm font-medium mb-2">
                Suggested Content Type
              </label>
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                      {CONTENT_TYPE_LABELS[analysis.suggested_content_type] ||
                        analysis.suggested_content_type}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                      Confidence: {Math.round(analysis.confidence * 100)}%
                    </p>
                  </div>
                  <div className="flex-1 max-w-xs ml-4">
                    <div className="bg-muted rounded-full h-2">
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
              <label className="block text-sm font-medium mb-2">Reasoning</label>
              <div className="p-3 bg-muted border border-border rounded-lg">
                <p className="text-sm">{analysis.reasoning}</p>
              </div>
            </div>

            {/* Suggested Description */}
            {analysis.suggested_description && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Suggested Description
                </label>
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-sm">{analysis.suggested_description}</p>
                </div>
              </div>
            )}

            {/* What happens next */}
            <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                <strong>💡 What happens when you apply:</strong>
              </p>
              <ul className="text-xs text-purple-700 dark:text-purple-300 mt-2 space-y-1 ml-4">
                <li>✓ Content type sets AI correction style for this project</li>
                <li>✓ Description helps you organize multiple projects</li>
                <li>✓ Click ✨ on any segment to get style-aware corrections</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setAnalysis(null)}
                className="px-4 py-2 border border-border rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                🔄 Re-analyze
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-border rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applyAnalysis.isPending}
                className="px-6 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg hover:from-primary-700 hover:to-purple-700 disabled:opacity-50 transition-colors font-medium"
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
