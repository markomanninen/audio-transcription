import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import ExportDialog from './components/Export/ExportDialog'
import { LLMSettings } from './components/Settings/LLMSettings'
import { AISettingsDialog } from './components/Settings/AISettingsDialog'
import { AnalysisDialog } from './components/AI/AnalysisDialog'
import type { Segment } from './types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function MainApp() {
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

  const handleCreateProject = () => {
    const projectName = prompt('Enter project name:')
    if (!projectName) return

    createProject.mutate(
      { name: projectName },
      {
        onSuccess: (data) => {
          setProjectId(data.id)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto py-4 px-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Audio Transcription
            </h1>
            <div className="flex items-center gap-4">
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
                  <button
                    onClick={() => setShowAnalysisDialog(true)}
                    className="
                      px-3 py-2 text-purple-700 bg-purple-100 rounded-lg
                      hover:bg-purple-200 transition-colors
                    "
                    title="Analyze project with AI"
                  >
                    🔍
                  </button>
                  <button
                    onClick={() => setIsEditingProject(true)}
                    className="
                      px-3 py-2 text-gray-700 bg-gray-100 rounded-lg
                      hover:bg-gray-200 transition-colors
                    "
                    title="Edit project"
                  >
                    ✏️
                  </button>
                </>
              )}
              <button
                onClick={handleCreateProject}
                disabled={createProject.isPending}
                className="
                  px-4 py-2 bg-blue-600 text-white rounded-lg
                  hover:bg-blue-700 disabled:opacity-50
                  transition-colors whitespace-nowrap
                "
              >
                {createProject.isPending ? 'Creating...' : 'New Project'}
              </button>
            </div>
          </div>
          {currentProject && (
            <div className="mt-2 text-sm text-gray-600">
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-6xl">🎙️</div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Welcome to Audio Transcription
              </h2>
              <p className="text-gray-600">
                Create a project to start transcribing your audio interviews
              </p>
              <button
                onClick={handleCreateProject}
                disabled={createProject.isPending}
                className="
                  px-6 py-3 bg-blue-600 text-white rounded-lg
                  hover:bg-blue-700 disabled:opacity-50
                  transition-colors font-medium
                "
              >
                Create New Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Upload & File List */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Upload Audio
                </h2>
                <FileUploader
                  projectId={projectId}
                  onUploadComplete={(fileId) => setSelectedFileId(fileId)}
                />
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <SpeakerManager fileId={selectedFileId} />
                  </div>

                  {/* Transcription Segments */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">
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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <div className="text-gray-400 space-y-2">
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  )
}

export default App
