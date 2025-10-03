import { useState, useEffect } from 'react'
import { apiClient } from '../../api/client'

interface ComponentStatus {
  status: 'up' | 'down' | 'unknown'
  message: string
}

interface HealthResponse {
  status: string
  version: string
  components: Record<string, ComponentStatus>
  critical: string[]
  optional: string[]
}

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await apiClient.get<HealthResponse>('/health')
        setHealth(response.data)
      } catch (error) {
        console.error('Health check failed:', error)
      } finally {
        setLoading(false)
      }
    }

    checkHealth()
    // Refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return '✅'
      case 'down':
        return '❌'
      default:
        return '⚠️'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'text-green-600 dark:text-green-400'
      case 'down':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-yellow-600 dark:text-yellow-400'
    }
  }

  const overallStatusIcon = health?.status === 'healthy' ? '✅' : '⚠️'
  const overallStatusText = health?.status === 'healthy' ? 'System Healthy' : 'System Degraded'

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
        title="System Status"
      >
        <span>{overallStatusIcon}</span>
        <span className="hidden md:inline">{overallStatusText}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-card border border-border rounded-lg shadow-lg z-50 p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">System Status</h3>
                <span className="text-xs text-muted-foreground">v{health?.version}</span>
              </div>

              {/* Critical Components */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Critical Components
                </h4>
                <div className="space-y-2">
                  {health?.critical.map((key) => {
                    const component = health.components[key]
                    return (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5">{getStatusIcon(component.status)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{key}</span>
                            <span className={`text-xs ${getStatusColor(component.status)}`}>
                              {component.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {component.message}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Optional Components */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Optional Components
                </h4>
                <div className="space-y-2">
                  {health?.optional.map((key) => {
                    const component = health.components[key]
                    return (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5">{getStatusIcon(component.status)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{key}</span>
                            <span className={`text-xs ${getStatusColor(component.status)}`}>
                              {component.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {component.message}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                <p>
                  Critical components must be operational for transcription.
                  Optional components enable additional features.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
