/**
 * LLM Provider Settings Component
 * Allows users to select and configure LLM providers
 */
import { useState } from 'react'
import { useProviders, useProviderHealth } from '../../hooks/useAICorrections'
import { ProviderInfo } from '../../api/aiCorrections'

interface LLMSettingsProps {
  selectedProvider: string
  onProviderChange: (provider: string) => void
  onOpenSettings?: () => void
}

export const LLMSettings: React.FC<LLMSettingsProps> = ({
  selectedProvider,
  onProviderChange,
  onOpenSettings,
}) => {
  const { data: providers, isLoading } = useProviders()
  const { data: health } = useProviderHealth()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading providers...
      </div>
    )
  }

  if (!providers || providers.length === 0) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400">
        No LLM providers available
      </div>
    )
  }

  const currentProvider = providers.find((p: ProviderInfo) => p.name === selectedProvider)
  const isHealthy = health?.[selectedProvider] ?? false

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-input border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <span className="text-sm font-medium">
          AI Provider: {currentProvider?.name || 'None'}
        </span>
        <span
          className={`w-2 h-2 rounded-full ${
            isHealthy ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isHealthy ? 'Healthy' : 'Unavailable'}
        />
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-20">
            <div className="p-3">
              <h3 className="text-sm font-semibold mb-2">
                Select AI Provider
              </h3>
              <div className="space-y-2">
                {providers.map((provider: ProviderInfo) => {
                  const providerHealth = health?.[provider.name] ?? false
                  const isSelected = provider.name === selectedProvider

                  return (
                    <button
                      key={provider.name}
                      onClick={() => {
                        onProviderChange(provider.name)
                        setIsOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded transition-colors ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            providerHealth ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-sm font-medium">
                          {provider.name}
                        </span>
                      </div>
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-primary-600 dark:text-primary-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />
                  Healthy - Provider available
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />
                  Unavailable - Check configuration
                </p>

                {onOpenSettings && (
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      onOpenSettings()
                    }}
                    className="w-full mt-3 px-3 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition-colors"
                  >
                    ⚙️ Advanced Settings
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
