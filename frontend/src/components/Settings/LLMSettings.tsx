/**
 * LLM Provider Settings Component
 * Allows users to select and configure LLM providers
 */
import React, { useState, useEffect } from 'react'
import { useProviders, useProviderHealth } from '../../hooks/useAICorrections'

interface LLMSettingsProps {
  selectedProvider: string
  onProviderChange: (provider: string) => void
}

export const LLMSettings: React.FC<LLMSettingsProps> = ({
  selectedProvider,
  onProviderChange,
}) => {
  const { data: providers, isLoading } = useProviders()
  const { data: health } = useProviderHealth()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500">
        Loading providers...
      </div>
    )
  }

  if (!providers || providers.length === 0) {
    return (
      <div className="text-sm text-red-500">
        No LLM providers available
      </div>
    )
  }

  const currentProvider = providers.find(p => p.name === selectedProvider)
  const isHealthy = health?.[selectedProvider] ?? false

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">
          AI Provider: {currentProvider?.name || 'None'}
        </span>
        <span
          className={`w-2 h-2 rounded-full ${
            isHealthy ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isHealthy ? 'Healthy' : 'Unavailable'}
        />
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
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
          <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Select AI Provider
              </h3>
              <div className="space-y-2">
                {providers.map((provider) => {
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
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            providerHealth ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {provider.name}
                        </span>
                      </div>
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-blue-600"
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

              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />
                  Healthy - Provider available
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />
                  Unavailable - Check configuration
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
