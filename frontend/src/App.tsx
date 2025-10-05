import { useState, useEffect, useRef } from 'react'
import { useCreateProject, useProject, useDeleteProject } from './hooks/useProjects'
import { useProjectFiles } from './hooks/useUpload'
import FileUploader from './components/Upload/FileUploader'
import FileList from './components/Dashboard/FileList'
import TranscriptionProgress from './components/Dashboard/TranscriptionProgress'
import AudioPlayer from './components/Player/AudioPlayer'
import SegmentList from './components/Transcription/SegmentList'
import SpeakerManager from './components/Transcription/SpeakerManager'
import ProjectSelector from './components/Dashboard/ProjectSelector'
import ProjectEditor from './components/Dashboard/ProjectEditor'
import CreateProjectDialog from './components/Dashboard/CreateProjectDialog'
import DeleteProjectDialog from './components/Dashboard/DeleteProjectDialog'
import ExportDialog from './components/Export/ExportDialog'
import { LLMSettings } from './components/Settings/LLMSettings'
import { AISettingsDialog } from './components/Settings/AISettingsDialog'
import { AnalysisDialog } from './components/AI/AnalysisDialog'
import ThemeToggle from './components/ThemeToggle'
import SystemStatus from './components/Dashboard/SystemStatus'
import InteractiveTutorial from './components/Tutorial/InteractiveTutorial'
import LLMLogsViewer from './components/Debug/LLMLogsViewer'
import EditorView from './components/Editor/EditorView'
import { Button } from './components/ui/Button'
import type { Segment } from './types'

function App() {
  // Load from localStorage on mount
  const [projectId, setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedProjectId')
    return saved ? parseInt(saved) : null
  })
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial')
    return hasSeenTutorial !== 'true'
  })
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [shouldPlayAudio, setShouldPlayAudio] = useState(false)
  const [shouldPauseAudio, setShouldPauseAudio] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showAISettings, setShowAISettings] = useState(false)
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false)
  const [showLLMLogs, setShowLLMLogs] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const [llmProvider, setLlmProvider] = useState<string>(() => {
    return localStorage.getItem('llmProvider') || 'ollama'
  })
  const projectMenuRef = useRef<HTMLDivElement>(null)
  const toolsMenuRef = useRef<HTMLDivElement>(null)
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const { data: currentProject } = useProject(projectId)
  const { data: projectFiles } = useProjectFiles(projectId)
  const { data: segments } = useSegments(selectedFileId)

  // Save LLM provider preference
  useEffect(() => {
    localStorage.setItem('llmProvider', llmProvider)
  }, [llmProvider])

  // Get current selected file
  const selectedFile = projectFiles?.find(f => f.file_id === selectedFileId)

  // Save to localStorage when projectId changes
  useEffect(() => {
    if (projectId) {
      localStorage.setItem('selectedProjectId', projectId.toString())
    } else {
      localStorage.removeItem('selectedProjectId')
    }
  }, [projectId])

  // Auto-select file when project changes or files load
  useEffect(() => {
    if (!projectId || !projectFiles || projectFiles.length === 0) {
      setSelectedFileId(null)
      return
    }

    // Try to restore last selected file for this project
    const lastSelectedKey = `selectedFileId_${projectId}`
    const lastSelectedId = localStorage.getItem(lastSelectedKey)

    if (lastSelectedId) {
      const fileExists = projectFiles.find(f => f.file_id === parseInt(lastSelectedId))
      if (fileExists) {
        setSelectedFileId(parseInt(lastSelectedId))
        return
      }
    }

    // Otherwise, auto-select the most recent file (first in the list)
    if (projectFiles.length > 0) {
      setSelectedFileId(projectFiles[0].file_id)
    }
  }, [projectId, projectFiles])

  // Save selected file to localStorage
  useEffect(() => {
    if (projectId && selectedFileId) {
      localStorage.setItem(`selectedFileId_${projectId}`, selectedFileId.toString())
    }
  }, [projectId, selectedFileId])

  const handleCreateProject = (name: string) => {
    createProject.mutate(
      { name },
      {
        onSuccess: (data) => {
          setProjectId(data.id)
          setShowCreateDialog(false)
        },
      }
    )
  }

  const handleSegmentClick = (segment: Segment) => {
    setAudioCurrentTime(segment.start_time)
    setShouldPlayAudio(true)
    // Reset shouldPlay after a brief moment so it doesn't interfere with future updates
    setTimeout(() => setShouldPlayAudio(false), 100)
  }

  const handlePlayRequest = () => {
    setShouldPlayAudio(true)
    setTimeout(() => setShouldPlayAudio(false), 100)
  }

  const handlePauseRequest = () => {
    setShouldPauseAudio(true)
    setTimeout(() => setShouldPauseAudio(false), 100)
  }

  const handleTutorialComplete = () => {
    localStorage.setItem('hasSeenTutorial', 'true')
    setShowTutorial(false)
  }

  const handleTutorialSkip = () => {
    localStorage.setItem('hasSeenTutorial', 'true')
    setShowTutorial(false)
  }

  const handleDeleteProject = () => {
    if (!projectId) return
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        setProjectId(null)
        setShowDeleteDialog(false)
        setShowProjectMenu(false)
      }
    })
  }

  const handleOpenEditor = () => {
    setShowEditor(true)
  }

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false)
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Interactive Tutorial */}
      {showTutorial && (
        <InteractiveTutorial
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
      )}

      {/* LLM Logs Viewer */}
      {showLLMLogs && (
        <LLMLogsViewer onClose={() => setShowLLMLogs(false)} />
      )}

      {/* AI Editor View */}
      {showEditor && segments && projectId && (
        <EditorView
          initialText={segments.map(seg => seg.edited_text || seg.original_text).join('\n\n')}
          onClose={() => setShowEditor(false)}
          projectId={projectId}
        />
      )}

      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto py-4 px-6">
          <div className="flex items-center justify-between gap-4">
            <h1
              className="text-2xl font-bold cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              onClick={() => setProjectId(null)}
              title="Go to home page"
            >
              Audio Transcription
            </h1>
            <div className="flex items-center gap-3">
              {/* Project Selector */}
              <div className="w-48 md:w-64">
                <ProjectSelector
                  selectedProjectId={projectId}
                  onSelectProject={setProjectId}
                />
              </div>

              {/* Project Menu - Only when project selected */}
              {projectId && (
                <div className="relative" ref={projectMenuRef}>
                  <button
                    onClick={() => setShowProjectMenu(!showProjectMenu)}
                    className="px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors flex items-center gap-2 border border-border"
                  >
                    <span>Project</span>
                    <span>{showProjectMenu ? '▲' : '▼'}</span>
                  </button>
                  {showProjectMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                      <button
                        onClick={() => {
                          setIsEditingProject(true)
                          setShowProjectMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <span>✏️</span>
                        <span>Edit Project</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowAnalysisDialog(true)
                          setShowProjectMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <span>🔍</span>
                        <span>AI Analysis</span>
                      </button>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          setShowDeleteDialog(true)
                          setShowProjectMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors flex items-center gap-2"
                      >
                        <span>🗑️</span>
                        <span>Delete Project</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* AI Settings */}
              <LLMSettings
                selectedProvider={llmProvider}
                onProviderChange={setLlmProvider}
                onOpenSettings={() => setShowAISettings(true)}
              />

              {/* Tools Menu */}
              <div className="relative" ref={toolsMenuRef}>
                <button
                  onClick={() => setShowToolsMenu(!showToolsMenu)}
                  className="px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors flex items-center gap-2 border border-border"
                >
                  <span>Tools</span>
                  <span>{showToolsMenu ? '▲' : '▼'}</span>
                </button>
                {showToolsMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => {
                        setShowTutorial(true)
                        setShowToolsMenu(false)
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <span>📖</span>
                      <span>Tutorial</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowLLMLogs(true)
                        setShowToolsMenu(false)
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <span>📊</span>
                      <span>LLM Logs</span>
                    </button>
                    <div className="border-t border-border my-1" />
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-sm">Theme</span>
                      <ThemeToggle />
                    </div>
                  </div>
                )}
              </div>

              {/* System Status */}
              <SystemStatus />

              {/* New Project Button */}
              <Button
                variant="primary"
                onClick={() => setShowCreateDialog(true)}
                loading={createProject.isPending}
              >
                New Project
              </Button>
            </div>
          </div>
          {currentProject && (
            <div className="mt-2 text-sm text-muted-foreground">
              {currentProject.description}
            </div>
          )}
          {isEditingProject && currentProject && (
            <ProjectEditor
              project={currentProject}
              onClose={() => setIsEditingProject(false)}
            />
          )}
        </div>
      </header>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateProject}
        isCreating={createProject.isPending}
      />

      {/* Delete Project Dialog */}
      <DeleteProjectDialog
        isOpen={showDeleteDialog}
        projectName={currentProject?.name || ''}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteProject}
        isDeleting={deleteProject.isPending}
      />

      {/* AI Settings Dialog */}
      <AISettingsDialog
        isOpen={showAISettings}
        onClose={() => setShowAISettings(false)}
        currentProvider={llmProvider}
        onProviderChange={setLlmProvider}
      />

      {/* AI Analysis Dialog */}
      {projectId && (
        <AnalysisDialog
          isOpen={showAnalysisDialog}
          onClose={() => setShowAnalysisDialog(false)}
          projectId={projectId}
          currentProvider={llmProvider}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-6">
        {!projectId ? (
          <div className="bg-card rounded-lg shadow-sm border border-border p-12">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Hero Section */}
              <div className="text-center space-y-4">
                <div className="text-6xl">🎙️</div>
                <h2 className="text-3xl font-bold">
                  Welcome to Audio Transcription
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  AI-powered transcription with speaker recognition, multi-language support,
                  and intelligent editing for interviews, podcasts, meetings, and more.
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl">🌍</div>
                  <h3 className="font-semibold">22+ Languages</h3>
                  <p className="text-sm text-muted-foreground">
                    Auto-detect or manually select from Finnish, Swedish, English, and more
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-3xl">👥</div>
                  <h3 className="font-semibold">Speaker Recognition</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatic diarization identifies and labels different speakers
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-3xl">✨</div>
                  <h3 className="font-semibold">AI Editing</h3>
                  <p className="text-sm text-muted-foreground">
                    Smart corrections with context-aware suggestions
                  </p>
                </div>
              </div>

              {/* Quick Start Steps */}
              <div className="bg-primary-50 dark:bg-primary-950/20 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-lg">Quick Start Guide:</h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-3">
                    <span className="font-bold text-primary-600 dark:text-primary-400 min-w-[1.5rem]">1.</span>
                    <span>Create a project to organize your transcriptions</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary-600 dark:text-primary-400 min-w-[1.5rem]">2.</span>
                    <span>Upload audio files (MP3, WAV, M4A, WebM, OGG, FLAC - max 500MB)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary-600 dark:text-primary-400 min-w-[1.5rem]">3.</span>
                    <span>Choose language or use auto-detect</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary-600 dark:text-primary-400 min-w-[1.5rem]">4.</span>
                    <span>Click "Transcribe" and wait (typically 1-3 minutes for a 3-minute audio)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary-600 dark:text-primary-400 min-w-[1.5rem]">5.</span>
                    <span>Edit, refine with AI, and export to SRT, HTML, or TXT</span>
                  </li>
                </ol>
              </div>

              {/* CTA */}
              <div className="text-center space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowCreateDialog(true)}
                  loading={createProject.isPending}
                >
                  🚀 Create Your First Project
                </Button>
                <div>
                  <button
                    onClick={() => setShowTutorial(true)}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    📖 Show interactive tutorial again
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Free to use • No signup required • All processing happens locally
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Upload & File List */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Upload Audio
                </h2>
                <FileUploader
                  projectId={projectId}
                  onUploadComplete={(fileId) => setSelectedFileId(fileId)}
                />
              </div>

              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Files
                </h2>
                <FileList
                  projectId={projectId}
                  selectedFileId={selectedFileId ?? undefined}
                  onSelectFile={setSelectedFileId}
                />
              </div>
            </div>

            {/* Right Column - Player & Transcription */}
            <div className="lg:col-span-2 space-y-6">
              {selectedFileId ? (
                <>
                  {/* Transcription Progress */}
                  <TranscriptionProgress fileId={selectedFileId} />

                  {/* Audio Player */}
                  <AudioPlayer
                    audioUrl={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/audio/${selectedFileId}`}
                    currentTime={audioCurrentTime}
                    onTimeUpdate={setAudioCurrentTime}
                    shouldPlay={shouldPlayAudio}
                    shouldPause={shouldPauseAudio}
                    onPlayingChange={setIsAudioPlaying}
                  />

                  {/* Speaker Management */}
                  <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                    <SpeakerManager fileId={selectedFileId} />
                  </div>

                  {/* Transcription Segments */}
                  <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">
                        Transcription
                      </h2>
                      <button
                        onClick={() => setShowExportDialog(true)}
                        className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                      >
                        <span>📥</span>
                        <span>Export</span>
                      </button>
                    </div>
                    <SegmentList
                      fileId={selectedFileId}
                      currentTime={audioCurrentTime}
                      isPlaying={isAudioPlaying}
                      onSegmentClick={handleSegmentClick}
                      onPlayRequest={handlePlayRequest}
                      onPauseRequest={handlePauseRequest}
                      llmProvider={llmProvider}
                      onOpenEditor={handleOpenEditor}
                    />
                  </div>

                  {/* Export Dialog */}
                  {showExportDialog && selectedFile && (
                    <ExportDialog
                      fileId={selectedFileId}
                      filename={selectedFile.original_filename}
                      onClose={() => setShowExportDialog(false)}
                    />
                  )}
                </>
              ) : (
                <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center">
                  <div className="text-muted-foreground space-y-2">
                    <div className="text-4xl">📝</div>
                    <p className="text-lg">Select a file to view transcription</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
