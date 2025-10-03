import { useState, useEffect } from 'react'
import { useCreateProject, useProject } from './hooks/useProjects'
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
import ExportDialog from './components/Export/ExportDialog'
import { LLMSettings } from './components/Settings/LLMSettings'
import { AISettingsDialog } from './components/Settings/AISettingsDialog'
import { AnalysisDialog } from './components/AI/AnalysisDialog'
import ThemeToggle from './components/ThemeToggle'
import { Button } from './components/ui/Button'
import type { Segment } from './types'

function App() {
  // Load from localStorage on mount
  const [projectId, setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedProjectId')
    return saved ? parseInt(saved) : null
  })
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [shouldPlayAudio, setShouldPlayAudio] = useState(false)
  const [shouldPauseAudio, setShouldPauseAudio] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showAISettings, setShowAISettings] = useState(false)
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false)
  const [llmProvider, setLlmProvider] = useState<string>(() => {
    return localStorage.getItem('llmProvider') || 'ollama'
  })
  const createProject = useCreateProject()
  const { data: currentProject } = useProject(projectId)
  const { data: projectFiles } = useProjectFiles(projectId)

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
    // Clear selected file when project changes
    setSelectedFileId(null)
  }, [projectId])

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto py-4 px-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">
              Audio Transcription
            </h1>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LLMSettings
                selectedProvider={llmProvider}
                onProviderChange={setLlmProvider}
                onOpenSettings={() => setShowAISettings(true)}
              />
              <div className="w-64">
                <ProjectSelector
                  selectedProjectId={projectId}
                  onSelectProject={setProjectId}
                />
              </div>
              {projectId && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAnalysisDialog(true)}
                    title="Analyze project with AI"
                  >
                    🔍
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProject(true)}
                    title="Edit project"
                  >
                    ✏️
                  </Button>
                </>
              )}
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
          <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-6xl">🎙️</div>
              <h2 className="text-2xl font-semibold">
                Welcome to Audio Transcription
              </h2>
              <p className="text-muted-foreground">
                Create a project to start transcribing your audio interviews
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreateProject}
                loading={createProject.isPending}
              >
                Create New Project
              </Button>
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
