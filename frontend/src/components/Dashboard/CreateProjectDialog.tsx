import { type FormEvent, useState } from 'react'

interface CreateProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, type: 'audio' | 'text', content?: string) => void
  isCreating?: boolean
  allowedTypes?: Array<'audio' | 'text'>
  defaultType?: 'audio' | 'text'
}

export default function CreateProjectDialog({
  isOpen,
  onClose,
  onCreate,
  isCreating = false,
  allowedTypes = ['audio', 'text'] as Array<'audio' | 'text'>,
  defaultType,
}: CreateProjectDialogProps) {
  const fallbackTypes = ['audio', 'text'] as const
  const availableTypes: Array<'audio' | 'text'> =
    allowedTypes.length > 0 ? allowedTypes : [...fallbackTypes]
  const resolvedDefaultType: 'audio' | 'text' =
    defaultType ?? availableTypes[0] ?? fallbackTypes[0]

  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState<'audio' | 'text'>(resolvedDefaultType)
  const [textContent, setTextContent] = useState('')

  const resetForm = () => {
    setProjectName('')
    setProjectType(resolvedDefaultType)
    setTextContent('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (projectName.trim()) {
      onCreate(projectName.trim(), projectType, textContent)
      resetForm()
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border">
        <h2 className="text-xl font-semibold mb-4">Create New Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {availableTypes.length > 1 ? (
            <div>
              <label
                htmlFor="projectType"
                className="block text-sm font-medium mb-1"
              >
                Project Type
              </label>
              <select
                id="projectType"
                name="projectType"
                value={projectType}
                onChange={(event) =>
                  setProjectType(event.target.value as 'audio' | 'text')
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground"
              >
                {availableTypes.includes('audio') && (
                  <option value="audio">Audio Project</option>
                )}
                {availableTypes.includes('text') && (
                  <option value="text">Text Project</option>
                )}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">
                Project Type
              </label>
              <div className="px-3 py-2 border border-border rounded-lg bg-muted text-sm">
                {availableTypes[0] === 'audio' ? 'Audio Project' : 'Text Project'}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="projectName" className="block text-sm font-medium mb-1">
              Project Name
            </label>
            <input
              type="text"
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground placeholder:text-muted-foreground"
              placeholder="Enter project name..."
              autoFocus
              required
            />
          </div>

          {projectType === 'text' && (
            <div>
              <label htmlFor="textContent" className="block text-sm font-medium mb-1">
                Initial Content (Optional)
              </label>
              <textarea
                id="textContent"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full h-32 px-3 py-2 border border-border rounded-lg focus-ring bg-input text-input-foreground placeholder:text-muted-foreground resize-y"
                placeholder="Paste or write your text here..."
              />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !projectName.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
