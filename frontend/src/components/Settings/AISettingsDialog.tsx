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
import { useProviders, useProviderHealth, useModels, useModelAvailability } from '../../hooks/useAICorrections'

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
  const [ollamaTimeout, setOllamaTimeout] = useState(() =>
    localStorage.getItem('ollama_timeout') || '30'
  )
  const [ollamaApiKey, setOllamaApiKey] = useState(() =>
    localStorage.getItem('ollama_api_key') || ''
  )
  const [ollamaExternal, setOllamaExternal] = useState(() =>
    localStorage.getItem('ollama_external') === 'true'
  )
  const [ollamaVerifySSL, setOllamaVerifySSL] = useState(() =>
    localStorage.getItem('ollama_verify_ssl') !== 'false' // Default to true
  )
  
  // Query available Ollama models when the dialog is open
  const { data: availableOllamaModels, isLoading: modelsLoading } = useModels('ollama', isOpen)
  
  // Check if current model is available
  const { data: modelAvailability } = useModelAvailability('ollama', ollamaModel, isOpen && !!ollamaModel)
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
    localStorage.setItem('ollama_timeout', ollamaTimeout)
    localStorage.setItem('ollama_api_key', ollamaApiKey)
    localStorage.setItem('ollama_external', ollamaExternal.toString())
    localStorage.setItem('ollama_verify_ssl', ollamaVerifySSL.toString())
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
            <span className={`text-xs px-2 py-1 rounded ${
              ollamaExternal 
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-200'
                : 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-200'
            }`}>
              {ollamaExternal ? 'External' : 'Local'}
            </span>
          </h3>

          <div className="space-y-4">
            {/* External Service Toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <input
                type="checkbox"
                id="ollama-external"
                checked={ollamaExternal}
                onChange={(e) => setOllamaExternal(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-border rounded focus-ring"
              />
              <label htmlFor="ollama-external" className="flex-1">
                <span className="font-medium">Use External Ollama Service</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect to a remote Ollama instance instead of the local Docker service
                </p>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Ollama URL
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder={ollamaExternal ? "https://your-ollama-service.com" : "http://localhost:11434"}
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {ollamaExternal 
                  ? "URL of your external Ollama service (include https:// for secure connections)"
                  : "URL of your local Ollama instance"
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Timeout (seconds)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={ollamaTimeout}
                onChange={(e) => setOllamaTimeout(e.target.value)}
                placeholder="30"
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                How long to wait for responses from Ollama (5-300 seconds)
              </p>
            </div>

            {/* External Service Settings */}
            {ollamaExternal && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={ollamaApiKey}
                    onChange={(e) => setOllamaApiKey(e.target.value)}
                    placeholder="Bearer token for authenticated access"
                    className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Required if your external Ollama service uses authentication
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ollama-verify-ssl"
                    checked={ollamaVerifySSL}
                    onChange={(e) => setOllamaVerifySSL(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-border rounded focus-ring"
                  />
                  <label htmlFor="ollama-verify-ssl" className="flex-1">
                    <span className="font-medium">Verify SSL Certificate</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Disable only for self-signed certificates in development
                    </p>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Model
                {modelsLoading && (
                  <span className="text-xs text-muted-foreground ml-2">(Loading...)</span>
                )}
                {modelAvailability !== undefined && (
                  <span className={`text-xs ml-2 ${
                    modelAvailability.available 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {modelAvailability.available ? '✓ Available' : '✗ Not Available'}
                  </span>
                )}
              </label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground"
              >
                {/* Show available models first */}
                {availableOllamaModels && availableOllamaModels.length > 0 && (
                  <optgroup label="Available Models">
                    {availableOllamaModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </optgroup>
                )}
                
                {/* Show common models as fallback */}
                <optgroup label="Common Models">
                  {OLLAMA_MODELS.filter(model => 
                    !availableOllamaModels?.includes(model)
                  ).map((model) => (
                    <option key={model} value={model}>
                      {model} {availableOllamaModels ? '(not installed)' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {ollamaExternal 
                  ? "Ensure this model is available on your external Ollama service"
                  : availableOllamaModels && !availableOllamaModels.includes(ollamaModel)
                    ? `Pull model with: ollama pull ${ollamaModel}`
                    : `Pull models with: `
                }{!ollamaExternal && availableOllamaModels && availableOllamaModels.includes(ollamaModel) && (
                  <span className="text-green-600 dark:text-green-400">Model is ready to use</span>
                )}{!ollamaExternal && (!availableOllamaModels || !availableOllamaModels.includes(ollamaModel)) && (
                  <code className="bg-muted px-1 rounded">ollama pull {ollamaModel}</code>
                )}
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
