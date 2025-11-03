import { useState, useRef } from 'react'
import { API_BASE_URL } from '../../api/client'

interface ProjectImportDialogProps {
  onClose: () => void
  onImportSuccess: (projectId: number) => void
}

interface ImportResult {
  success: boolean
  project_id?: number
  errors: string[]
  warnings: string[]
  import_stats: {
    project_created?: boolean
    audio_files_imported?: number
    segments_imported?: number
    speakers_imported?: number
    edits_imported?: number
    audio_files_copied?: number
  }
}

interface ValidationResult {
  is_valid: boolean
  errors: string[]
  warnings: string[]
  project_info?: {
    name: string
    description?: string
    type: string
    export_version: string
    export_time: string
  }
  file_info?: {
    audio_files: number
    segments: number
    speakers: number
    edits: number
  }
}

export default function ProjectImportDialog({ onClose, onImportSuccess }: ProjectImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setValidation(null)
    setImportResult(null)
    
    // Auto-set project name from filename if not set
    if (!projectName) {
      const nameFromFile = file.name.replace('.zip', '').replace(/_export_.*/, '')
      setProjectName(nameFromFile)
    }

    // Validate the file
    await validateFile(file)
  }

  const validateFile = async (file: File) => {
    setIsValidating(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/upload/project/import/validate`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`)
      }

      const result: ValidationResult = await response.json()
      setValidation(result)

      // Update project info from validation if available
      if (result.project_info && !projectName) {
        setProjectName(result.project_info.name)
      }
      if (result.project_info && !projectDescription) {
        setProjectDescription(result.project_info.description || '')
      }

    } catch (error) {
      console.error('Validation failed:', error)
      setValidation({
        is_valid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !validation?.is_valid) return

    setIsImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      
      if (projectName.trim()) {
        formData.append('project_name', projectName.trim())
      }
      if (projectDescription.trim()) {
        formData.append('project_description', projectDescription.trim())
      }

      const response = await fetch(`${API_BASE_URL}/api/upload/project/import`, {
        method: 'POST',
        body: formData,
      })

      const result: ImportResult = await response.json()
      setImportResult(result)

      if (result.success && result.project_id) {
        // Show success message briefly, then close and navigate
        setTimeout(() => {
          onImportSuccess(result.project_id!)
          onClose()
        }, 2000)
      }

    } catch (error) {
      console.error('Import failed:', error)
      setImportResult({
        success: false,
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        import_stats: {}
      })
    } finally {
      setIsImporting(false)
    }
  }

  const resetDialog = () => {
    setSelectedFile(null)
    setValidation(null)
    setImportResult(null)
    setProjectName('')
    setProjectDescription('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg border border-border max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Import Project</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          
          {/* File Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Select Project File</h3>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              {!selectedFile ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    Choose ZIP File
                  </button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Select a project export ZIP file to import
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={resetDialog}
                    className="mt-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Choose different file
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Validation Status */}
          {selectedFile && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Validation</h3>
              {isValidating ? (
                <div className="text-sm text-muted-foreground">Validating file...</div>
              ) : validation ? (
                <div className="space-y-2">
                  {validation.is_valid ? (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      ✅ File is valid and ready to import
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      ❌ File validation failed
                    </div>
                  )}
                  
                  {validation.project_info && (
                    <div className="bg-muted p-3 rounded text-sm">
                      <div><strong>Project:</strong> {validation.project_info.name}</div>
                      {validation.project_info.description && (
                        <div><strong>Description:</strong> {validation.project_info.description}</div>
                      )}
                      <div><strong>Type:</strong> {validation.project_info.type}</div>
                      <div><strong>Export Version:</strong> {validation.project_info.export_version}</div>
                    </div>
                  )}

                  {validation.file_info && (
                    <div className="bg-muted p-3 rounded text-sm">
                      <div><strong>Content:</strong></div>
                      <div>• {validation.file_info.audio_files} audio files</div>
                      <div>• {validation.file_info.segments} segments</div>
                      <div>• {validation.file_info.speakers} speakers</div>
                      <div>• {validation.file_info.edits} edits</div>
                    </div>
                  )}

                  {validation.errors.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">Errors:</div>
                      {validation.errors.map((error, i) => (
                        <div key={i} className="text-sm text-red-600 dark:text-red-400">• {error}</div>
                      ))}
                    </div>
                  )}

                  {validation.warnings.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Warnings:</div>
                      {validation.warnings.map((warning, i) => (
                        <div key={i} className="text-sm text-yellow-600 dark:text-yellow-400">• {warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Project Details */}
          {validation?.is_valid && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Project Details</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="projectName" className="block text-sm font-medium mb-1">
                    Project Name
                  </label>
                  <input
                    id="projectName"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-input"
                    placeholder="Enter project name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="projectDescription" className="block text-sm font-medium mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="projectDescription"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-input"
                    placeholder="Enter project description"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Import Result</h3>
              {importResult.success ? (
                <div className="space-y-2">
                  <div className="text-sm text-green-600 dark:text-green-400">
                    ✅ Project imported successfully!
                  </div>
                  {importResult.import_stats && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm">
                      <div><strong>Import Summary:</strong></div>
                      <div>• Audio files: {importResult.import_stats.audio_files_imported}</div>
                      <div>• Segments: {importResult.import_stats.segments_imported}</div>
                      <div>• Speakers: {importResult.import_stats.speakers_imported}</div>
                      <div>• Edits: {importResult.import_stats.edits_imported}</div>
                      <div>• Audio files copied: {importResult.import_stats.audio_files_copied}</div>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Redirecting to project...
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-red-600 dark:text-red-400">
                    ❌ Import failed
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1">
                      {importResult.errors.map((error, i) => (
                        <div key={i} className="text-sm text-red-600 dark:text-red-400">• {error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            disabled={isImporting}
          >
            {importResult?.success ? 'Close' : 'Cancel'}
          </button>
          
          {validation?.is_valid && !importResult?.success && (
            <button
              onClick={handleImport}
              disabled={isImporting || !projectName.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isImporting ? 'Importing...' : 'Import Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}