import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCreateAudioProject,
  useCreateTextProject,
  useProject,
  useDeleteProject,
} from '../hooks/useProjects';
import { useProjectFiles } from '../hooks/useUpload';
import { useSegments, useSpeakers } from '../hooks/useTranscription';
import FileUploader from '../components/Upload/FileUploader';
import { FileList } from '../components/Dashboard/FileList';
import TranscriptionProgress from '../components/Dashboard/TranscriptionProgress';
import AudioPlayer from '../components/Player/AudioPlayer';
import SegmentList from '../components/Transcription/SegmentList';
import SpeakerManager from '../components/Transcription/SpeakerManager';
import ProjectSelector from '../components/Dashboard/ProjectSelector';
import ProjectEditor from '../components/Dashboard/ProjectEditor';
import CreateProjectDialog from '../components/Dashboard/CreateProjectDialog';
import DeleteProjectDialog from '../components/Dashboard/DeleteProjectDialog';
import ExportDialog from '../components/Export/ExportDialog';
import { AISettingsDialog } from '../components/Settings/AISettingsDialog';
import { AnalysisDialog } from '../components/AI/AnalysisDialog';
import ThemeToggle from '../components/ThemeToggle';
import SystemStatus from '../components/Dashboard/SystemStatus';
import InteractiveTutorial from '../components/Tutorial/InteractiveTutorial';
import LLMLogsViewer from '../components/Debug/LLMLogsViewer';
import { Button } from '../components/ui/Button';
import { LoadingSplash } from '../components/LoadingSplash';
import type { Segment } from '../types';

export default function AudioDashboardPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedAudioProjectId');
    return saved ? parseInt(saved, 10) : null;
  });
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem('hasSeenAudioTutorial') !== 'true');
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [shouldPlayAudio, setShouldPlayAudio] = useState(false);
  const [shouldPauseAudio, setShouldPauseAudio] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [showLLMLogs, setShowLLMLogs] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [llmProvider, setLlmProvider] = useState(() => localStorage.getItem('llmProvider') || 'ollama');

  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const createAudioProject = useCreateAudioProject();
  const createTextProject = useCreateTextProject();
  const deleteProject = useDeleteProject();
  const { data: currentProject } = useProject(projectId);
  const { data: projectFiles } = useProjectFiles(projectId);
  const { data: segments } = useSegments(selectedFileId);
  const { data: speakers } = useSpeakers(selectedFileId);

  useEffect(() => {
    localStorage.setItem('llmProvider', llmProvider);
  }, [llmProvider]);

  const selectedFile = projectFiles?.find((file) => file.file_id === selectedFileId);

  useEffect(() => {
    if (projectId) {
      localStorage.setItem('selectedAudioProjectId', projectId.toString());
    } else {
      localStorage.removeItem('selectedAudioProjectId');
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && projectFiles && projectFiles.length > 0) {
      const lastSelectedKey = `selectedFileId_${projectId}`;
      const lastSelectedId = localStorage.getItem(lastSelectedKey);
      if (lastSelectedId) {
        const fileExists = projectFiles.find((file) => file.file_id === parseInt(lastSelectedId, 10));
        if (fileExists) {
          setSelectedFileId(parseInt(lastSelectedId, 10));
          return;
        }
      }
      setSelectedFileId(projectFiles[0].file_id);
    } else {
      setSelectedFileId(null);
    }
  }, [projectId, projectFiles]);

  useEffect(() => {
    if (projectId && selectedFileId) {
      localStorage.setItem(`selectedFileId_${projectId}`, selectedFileId.toString());
    }
  }, [projectId, selectedFileId]);

  const handleCreateProject = async (name: string) => {
    createAudioProject.mutate(
      { name },
      {
        onSuccess: async (project) => {
          // Wait for projects query to refetch
          await new Promise(resolve => setTimeout(resolve, 100));
          setProjectId(project.id);
          setShowCreateDialog(false);
        },
      }
    );
  };

  const handleSegmentClick = (segment: Segment) => {
    setAudioCurrentTime(segment.start_time);
    setShouldPlayAudio(true);
    setTimeout(() => setShouldPlayAudio(false), 100);
  };

  const handlePlayRequest = () => {
    setShouldPlayAudio(true);
    setTimeout(() => setShouldPlayAudio(false), 100);
  };

  const handlePauseRequest = () => {
    setShouldPauseAudio(true);
    setTimeout(() => setShouldPauseAudio(false), 100);
  };

  const handleTutorialDismiss = () => {
    localStorage.setItem('hasSeenAudioTutorial', 'true');
    setShowTutorial(false);
  };

  const handleDeleteProject = () => {
    if (!projectId) return;
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        setProjectId(null);
        setShowDeleteDialog(false);
      },
    });
  };

  const handleOpenEditor = () => {
    if (!selectedFileId || !segments || !selectedFile) return;

    // Combine all segments into a single text document
    const segmentTexts = segments.map((segment) => {
      const text = segment.edited_text || segment.original_text;

      // Get speaker name if available
      let speakerName = '';
      if (segment.speaker_id && speakers) {
        const speaker = speakers.find((s) => s.id === segment.speaker_id);
        if (speaker) {
          speakerName = `${speaker.display_name}: `;
        }
      }

      return `${speakerName}${text}`;
    });

    const content = segmentTexts.join('\n\n');
    const projectName = `${selectedFile.original_filename} - Text Edition`;

    // Create a new text project with the transcription content
    createTextProject.mutate(
      {
        name: projectName,
        description: `Text project created from audio transcription: ${selectedFile.original_filename}`,
        content,
      },
      {
        onSuccess: (newProject) => {
          // Navigate to the editor page with the new project
          navigate(`/editor/${newProject.id}`);
        },
        onError: (error) => {
          console.error('Failed to create text project:', error);
          alert('Failed to create text project. Please try again.');
        },
      }
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCreating = createAudioProject.isPending;

  return (
    <LoadingSplash>
      <div className="min-h-screen bg-background text-foreground">
      {showTutorial && <InteractiveTutorial onComplete={handleTutorialDismiss} onSkip={handleTutorialDismiss} />}
      {showLLMLogs && <LLMLogsViewer onClose={() => setShowLLMLogs(false)} />}

      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/" className="text-primary-600 hover:text-primary-500">
                ← Back to home
              </Link>
            </p>
            <h1 className="text-2xl font-bold">Audio Transcription Studio</h1>
          </div>
          <div className="flex items-center gap-3">
            <ProjectSelector
              selectedProjectId={projectId}
              onSelectProject={setProjectId}
              projectTypeFilter="audio"
            />
            <Button onClick={() => setShowCreateDialog(true)} loading={isCreating} className="whitespace-nowrap">
              New Project
            </Button>
            <div ref={toolsMenuRef} className="relative">
              <button
                onClick={() => setShowToolsMenu((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
              >
                Tools {showToolsMenu ? '▲' : '▼'}
              </button>
              {showToolsMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setShowAISettings(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    AI Provider
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingProject(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                    disabled={!currentProject}
                  >
                    Edit Project
                  </button>
                  <button
                    onClick={() => {
                      setShowAnalysisDialog(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    AI Analysis
                  </button>
                  <button
                    onClick={() => {
                      setShowLLMLogs(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    View LLM Logs
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteDialog(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    Delete Project
                  </button>
                  <button
                    onClick={() => {
                      setShowTutorial(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    Show Tutorial
                  </button>
                </div>
              )}
            </div>
            <ThemeToggle />
            <SystemStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {!projectId ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="text-6xl">🎧</div>
              <h2 className="text-3xl font-bold">Create an audio project to begin</h2>
              <p className="text-muted-foreground">
                Organize recordings, run transcriptions, and leverage AI cleanup tools. Your progress saves
                automatically.
              </p>
              <Button variant="primary" size="lg" onClick={() => setShowCreateDialog(true)}>
                Create Audio Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">Upload Audio</h2>
                <FileUploader projectId={projectId} onUploadComplete={(fileId) => setSelectedFileId(fileId)} />
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">Files</h2>
                <FileList
                  projectId={projectId}
                  selectedFileId={selectedFileId ?? undefined}
                  onSelectFile={setSelectedFileId}
                />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {selectedFileId ? (
                <>
                  <TranscriptionProgress fileId={selectedFileId} />
                  <AudioPlayer
                    audioUrl={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/audio/${selectedFileId}`}
                    currentTime={audioCurrentTime}
                    onTimeUpdate={setAudioCurrentTime}
                    shouldPlay={shouldPlayAudio}
                    shouldPause={shouldPauseAudio}
                    onPlayingChange={setIsAudioPlaying}
                  />
                  <div className="rounded-lg border border-border bg-card p-6">
                    <SpeakerManager fileId={selectedFileId} />
                  </div>
                  <div className="rounded-lg border border-border bg-card p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Transcription</h2>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                          Export
                        </Button>
                      </div>
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
                  {showExportDialog && selectedFile && (
                    <ExportDialog
                      fileId={selectedFileId}
                      filename={selectedFile.original_filename}
                      onClose={() => setShowExportDialog(false)}
                    />
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
                  Select an audio file to get started with transcription.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {isEditingProject && currentProject && (
        <ProjectEditor project={currentProject} onClose={() => setIsEditingProject(false)} />
      )}

      <AISettingsDialog
        isOpen={showAISettings}
        onClose={() => setShowAISettings(false)}
        currentProvider={llmProvider}
        onProviderChange={setLlmProvider}
      />

      {projectId && (
        <AnalysisDialog
          isOpen={showAnalysisDialog}
          onClose={() => setShowAnalysisDialog(false)}
          projectId={projectId}
          currentProvider={llmProvider}
        />
      )}

      <CreateProjectDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={(name) => handleCreateProject(name)}
        isCreating={isCreating}
        allowedTypes={['audio']}
        defaultType="audio"
      />

      <DeleteProjectDialog
        isOpen={showDeleteDialog}
        projectName={currentProject?.name || ''}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteProject}
        isDeleting={deleteProject.isPending}
      />
    </div>
    </LoadingSplash>
  );
}
