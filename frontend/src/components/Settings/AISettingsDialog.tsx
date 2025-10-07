/**
 * A  onC  onClose: () => void
  currentProvider: string
  onProviderChange: (provider: string) => void
}

export default function AISettingsDialog({void
  currentProvider: string
  onProviderChange: (provider: string) => void
}

export default function AISettingsDialog({ialog Component
 * Comprehensive LLM provider, model, and API key configuration
 */
import { useState } from 'react'
import { useProviders, useProviderHealth } from '../../hooks/useAICorrections'

interface AISettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  currentProvider: string
  onProviderChange: (provider: string) => void
}

export const AISettingsDialog = ({
  isOpen,
  onClose,
  currentProvider,
  onProviderChange,
}: AISettingsDialogProps) => {
  const { data: providers } = useProviders()
  const { data: health } = useProviderHealth()

  // Load configurations from localStorage
  const [ollamaModel, setOllamaModel] = useState(() =>
    localStorage.getItem('ollama_model') || 'llama3.2:1b'
  )
  const [ollamaUrl, setOllamaUrl] = useState(() =>
    localStorage.getItem('ollama_url') || 'http://localhost:11434'
  )
  const [openrouterModel, setOpenrouterModel] = useState(() =>
    localStorage.getItem('openrouter_model') || 'anthropic/claude-3-haiku'
  )
  const [openrouterKey, setOpenrouterKey] = useState(() =>
    localStorage.getItem('openrouter_key') || ''
  )

  const handleSave = () => {
    // Save to localStorage (in production, should be saved to backend)
    localStorage.setItem('ollama_model', ollamaModel)
    localStorage.setItem('ollama_url', ollamaUrl)
    localStorage.setItem('openrouter_model', openrouterModel)
    localStorage.setItem('openrouter_key', openrouterKey)

    onClose()
  }

  if (!isOpen) return null

  const OLLAMA_MODELS = [
    'llama3.2:1b',
    'llama3.2:3b',
    'llama3.1:8b',
    'mistral:7b',
    'phi3:mini',
    'gemma2:2b',
  ]

  const OPENROUTER_MODELS = [
    'anthropic/claude-3-haiku',
    'anthropic/claude-3-sonnet',
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'google/gemini-pro',
    'meta-llama/llama-3.1-8b-instruct',
  ]

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold">AI Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure LLM providers, models, and API keys
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Current Provider Selection */}
        <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg">
          <label className="block text-sm font-medium mb-2">
            Active Provider
          </label>
          <div className="flex gap-4">
            {providers?.map((provider: any) => {
              const isHealthy = health?.[provider.name] ?? false
              const isActive = provider.name === currentProvider

              return (
                <button
                  key={provider.name}
                  onClick={() => onProviderChange(provider.name)}
                  className={`flex-1 flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-card border border-border hover:bg-muted'
                  }`}
                >
                  <span className="font-medium">{provider.name}</span>
                  <span
                    className={`w-3 h-3 rounded-full ${
                      isHealthy ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {/* Ollama Configuration */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>Ollama</span>
            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-200 rounded">Local</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Ollama URL
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL of your local Ollama instance
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Model
              </label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground"
              >
                {OLLAMA_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Pull models with: <code className="bg-muted px-1 rounded">ollama pull {ollamaModel}</code>
              </p>
            </div>
          </div>
        </div>

        {/* OpenRouter Configuration */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>OpenRouter</span>
            <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-200 rounded">Cloud</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                API Key
              </label>
              <input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  openrouter.ai/keys
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Model
              </label>
              <select
                value={openrouterModel}
                onChange={(e) => setOpenrouterModel(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground"
              >
                {OPENROUTER_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                See pricing and models at{' '}
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  openrouter.ai/models
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Note</h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Settings are currently stored in browser localStorage. For production use, configure
            providers in <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">backend/.env</code> file.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
