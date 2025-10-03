import { useState, useEffect } from 'react'
import apiClient from '../../api/client'

interface LLMLog {
  id: number
  provider: string
  model: string
  operation: string
  prompt: string
  original_text: string | null
  context: string | null
  response: string
  corrected_text: string | null
  status: string
  error_message: string | null
  duration_ms: number | null
  segment_id: number | null
  project_id: number | null
  created_at: string
}

interface LLMLogsViewerProps {
  onClose: () => void
}

export default function LLMLogsViewer({ onClose }: LLMLogsViewerProps) {
  const [logs, setLogs] = useState<LLMLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    provider: '',
    status: '',
    operation: '',
  })
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    fetchLogs()
  }, [filters, limit])

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.provider) params.append('provider', filters.provider)
      if (filters.status) params.append('status', filters.status)
      if (filters.operation) params.append('operation', filters.operation)
      params.append('limit', limit.toString())

      const response = await apiClient.get<LLMLog[]>(`/api/llm/logs?${params.toString()}`)
      setLogs(response.data)
    } catch (error) {
      console.error('Failed to fetch LLM logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTimestamp = (timestamp: string) => {
    // Backend stores UTC timestamps, ensure they're parsed as UTC
    const date = new Date(timestamp + (timestamp.includes('Z') ? '' : 'Z'))
    return date.toLocaleString()
  }

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold text-primary">LLM Request Logs</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-primary transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-border flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">Provider:</label>
            <select
              value={filters.provider}
              onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
              className="px-3 py-1 border border-border rounded bg-surface text-primary"
            >
              <option value="">All</option>
              <option value="ollama">Ollama</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">Status:</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-1 border border-border rounded bg-surface text-primary"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">Operation:</label>
            <select
              value={filters.operation}
              onChange={(e) => setFilters({ ...filters, operation: e.target.value })}
              className="px-3 py-1 border border-border rounded bg-surface text-primary"
            >
              <option value="">All</option>
              <option value="correct_text">Correct Text</option>
              <option value="analyze_content">Analyze Content</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">Limit:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-1 border border-border rounded bg-surface text-primary"
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="500">500</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            className="ml-auto px-4 py-1 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              No logs found
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border border-border rounded-lg overflow-hidden bg-surface"
                >
                  {/* Log Header */}
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="p-3 cursor-pointer hover:bg-background/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {log.status}
                        </span>
                        <span className="text-sm font-medium text-primary">
                          {log.provider} / {log.model}
                        </span>
                        <span className="text-sm text-text-secondary">
                          {log.operation}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-secondary">
                        <span>{formatDuration(log.duration_ms)}</span>
                        <span>{formatTimestamp(log.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === log.id && (
                    <div className="p-4 border-t border-border bg-background/30 space-y-3">
                      {log.original_text && (
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-1">Original Text:</h4>
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto text-text-secondary whitespace-pre-wrap">
                            {log.original_text}
                          </pre>
                        </div>
                      )}

                      {log.context && (
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-1">Context:</h4>
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto text-text-secondary whitespace-pre-wrap">
                            {log.context}
                          </pre>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-semibold text-primary mb-1">Prompt:</h4>
                        <pre className="text-xs bg-background p-2 rounded overflow-x-auto text-text-secondary whitespace-pre-wrap max-h-32">
                          {log.prompt}
                        </pre>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-primary mb-1">Response:</h4>
                        <pre className="text-xs bg-background p-2 rounded overflow-x-auto text-text-secondary whitespace-pre-wrap max-h-32">
                          {log.response}
                        </pre>
                      </div>

                      {log.corrected_text && (
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-1">Corrected Text:</h4>
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto text-text-secondary whitespace-pre-wrap">
                            {log.corrected_text}
                          </pre>
                        </div>
                      )}

                      {log.error_message && (
                        <div>
                          <h4 className="text-sm font-semibold text-red-600 mb-1">Error:</h4>
                          <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto text-red-800 dark:text-red-200 whitespace-pre-wrap">
                            {log.error_message}
                          </pre>
                        </div>
                      )}

                      <div className="flex gap-4 text-xs text-text-secondary">
                        {log.segment_id && <span>Segment ID: {log.segment_id}</span>}
                        {log.project_id && <span>Project ID: {log.project_id}</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
