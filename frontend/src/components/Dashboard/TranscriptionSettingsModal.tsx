import React, { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface TranscriptionSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onStartTranscription: (settings: TranscriptionSettings) => void
  fileId: number | null
  fileName: string
  isLoading?: boolean
}

export interface TranscriptionSettings {
  model_size: string
  language: string | null
  include_diarization: boolean
}

const WHISPER_MODELS = [
  { value: 'tiny', label: 'Tiny (Fastest)', description: '~39 MB, fastest, least accurate' },
  { value: 'base', label: 'Base (Fast)', description: '~74 MB, fast, good for quick drafts' },
  { value: 'small', label: 'Small (Balanced)', description: '~244 MB, balanced speed/quality' },
  { value: 'medium', label: 'Medium (Better)', description: '~769 MB, slower but more accurate' },
  { value: 'large', label: 'Large (Best Quality)', description: '~1550 MB, best quality, slowest' }
]

const LANGUAGES = [
  { value: null, label: 'Auto Detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'fi', label: 'Finnish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'no', label: 'Norwegian' },
  { value: 'da', label: 'Danish' }
]

export function TranscriptionSettingsModal({ 
  isOpen, 
  onClose, 
  onStartTranscription, 
  fileId,
  fileName,
  isLoading = false 
}: TranscriptionSettingsModalProps) {
  console.log('TranscriptionSettingsModal render:', { isOpen, fileId, fileName, isLoading })
  
  // Default fallback settings
  const getDefaultSettings = (): TranscriptionSettings => ({
    model_size: 'large',
    language: null,
    include_diarization: true
  })

  const [settings, setSettings] = useState<TranscriptionSettings>(getDefaultSettings())

  // Load appropriate settings when modal opens or file changes
  useEffect(() => {
    if (isOpen) {
      console.log('Modal opening with fileId:', fileId)
      
      try {
        if (fileId === null) {
          // This is for setting default settings - load from defaultTranscriptionSettings
          console.log('Loading default settings for fileId=null')
          const saved = localStorage.getItem('defaultTranscriptionSettings')
          console.log('defaultTranscriptionSettings from localStorage:', saved)
          if (saved) {
            setSettings(JSON.parse(saved))
            return
          }
        } else {
          // This is for starting transcription - load from lastUsedTranscriptionSettings
          console.log('Loading last used settings for fileId=', fileId)
          const lastUsed = localStorage.getItem('lastUsedTranscriptionSettings')
          console.log('lastUsedTranscriptionSettings from localStorage:', lastUsed)
          if (lastUsed) {
            console.log('Loading last used settings:', lastUsed)
            const parsedSettings = JSON.parse(lastUsed)
            console.log('Parsed last used settings:', parsedSettings)
            setSettings(parsedSettings)
            return
          }
          // Fallback to default settings if no last used settings
          const defaultSettings = localStorage.getItem('defaultTranscriptionSettings')
          console.log('Fallback to defaultTranscriptionSettings:', defaultSettings)
          if (defaultSettings) {
            console.log('Loading default settings as fallback:', defaultSettings)
            setSettings(JSON.parse(defaultSettings))
            return
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      }
      // Use fallback if all else fails
      console.log('Using hardcoded fallback settings')
      setSettings(getDefaultSettings())
    }
  }, [isOpen, fileId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onStartTranscription(settings)
  }

  const selectedModel = WHISPER_MODELS.find(m => m.value === settings.model_size)
  const isDefaultSettings = fileId === null

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isDefaultSettings ? "Default Transcription Settings" : "Transcription Settings"}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Info */}
        {!isDefaultSettings && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">File to Transcribe</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              📄 {fileName}
            </p>
          </div>
        )}
        
        {isDefaultSettings && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Default Settings</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              These settings will be used as defaults for new transcriptions.
            </p>
          </div>
        )}

        {/* Whisper Model Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Whisper Model
          </label>
          <div className="space-y-2">
            {WHISPER_MODELS.map((model) => (
              <label
                key={model.value}
                className={`
                  relative flex items-start p-3 border rounded-lg cursor-pointer
                  transition-colors hover:border-blue-300 dark:hover:border-blue-600
                  ${settings.model_size === model.value 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                    : 'border-gray-200 dark:border-gray-700'
                  }
                `}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.value}
                  checked={settings.model_size === model.value}
                  onChange={(e) => setSettings(prev => ({ ...prev, model_size: e.target.value }))}
                  className="mt-1 sr-only"
                />
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className={`
                      w-4 h-4 border-2 rounded-full mr-3 flex-shrink-0
                      ${settings.model_size === model.value 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300 dark:border-gray-600'
                      }
                    `}>
                      {settings.model_size === model.value && (
                        <span className="block w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
                      )}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {model.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ml-7">
                    {model.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {selectedModel && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start">
                <span className="text-amber-600 dark:text-amber-400 text-lg mr-2">⚡</span>
                <div className="text-sm">
                  <p className="text-amber-800 dark:text-amber-200 font-medium">
                    Selected: {selectedModel.label}
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    {selectedModel.description}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Language Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Language
          </label>
          <select
            value={settings.language || ''}
            onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value || null }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value || 'auto'} value={lang.value || ''}>
                {lang.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Auto-detect works well for most cases. Specify a language for better accuracy.
          </p>
        </div>

        {/* Speaker Diarization */}
        <div>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.include_diarization}
              onChange={(e) => setSettings(prev => ({ ...prev, include_diarization: e.target.checked }))}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded 
                       focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Speaker Diarization
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Automatically identify and separate different speakers in the audio.
                This may increase processing time but provides better organization for multi-speaker content.
              </p>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                {isDefaultSettings ? 'Saving...' : 'Starting Transcription...'}
              </>
            ) : (
              isDefaultSettings ? 'Save Default Settings' : 'Start Transcription'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}