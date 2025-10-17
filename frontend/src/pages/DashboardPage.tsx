import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreateAudioProject, useCreateTextProject, useProject, useDeleteProject } from '../hooks/useProjects';
import { useProjectFiles } from '../hooks/useUpload';
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
import { LLMSettings } from '../components/Settings/LLMSettings';
import { AISettingsDialog } from '../components/Settings/AISettingsDialog';
import { AnalysisDialog } from '../components/AI/AnalysisDialog';
import ThemeToggle from '../components/ThemeToggle';
import SystemStatus from '../components/Dashboard/SystemStatus';
import InteractiveTutorial from '../components/Tutorial/InteractiveTutorial';
import LLMLogsViewer from '../components/Debug/LLMLogsViewer';
import { Button } from '../components/ui/Button';
import type { Segment } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedProjectId');
    return saved ? parseInt(saved) : null;
  });
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    return hasSeenTutorial !== 'true';
  });
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
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [llmProvider, setLlmProvider] = useState<string>(() => {
    return localStorage.getItem('llmProvider') || 'ollama';
  });
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const createAudioProject = useCreateAudioProject();
  const createTextProject = useCreateTextProject();
  const deleteProject = useDeleteProject();
  const { data: currentProject } = useProject(projectId);
  const { data: projectFiles } = useProjectFiles(projectId);

  useEffect(() => {
    localStorage.setItem('llmProvider', llmProvider);
  }, [llmProvider]);

  const selectedFile = projectFiles?.find(f => f.file_id === selectedFileId);

  useEffect(() => {
    if (projectId) {
      localStorage.setItem('selectedProjectId', projectId.toString());
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  }, [projectId]);

  useEffect(() => {
    if (currentProject && currentProject.project_type === 'text') {
      setSelectedFileId(null);
    } else if (projectId && projectFiles && projectFiles.length > 0) {
      const lastSelectedKey = `selectedFileId_${projectId}`;
      const lastSelectedId = localStorage.getItem(lastSelectedKey);
      if (lastSelectedId) {
        const fileExists = projectFiles.find(f => f.file_id === parseInt(lastSelectedId));
        if (fileExists) {
          setSelectedFileId(parseInt(lastSelectedId));
          return;
        }
      }
      if (projectFiles.length > 0) {
        setSelectedFileId(projectFiles[0].file_id);
      }
    } else {
      setSelectedFileId(null);
    }
  }, [projectId, projectFiles, currentProject]);

  useEffect(() => {
    if (projectId && selectedFileId) {
      localStorage.setItem(`selectedFileId_${projectId}`, selectedFileId.toString());
    }
  }, [projectId, selectedFileId]);

  const handleCreateProject = (name: string, type: 'audio' | 'text', content?: string) => {
    const mutation = type === 'audio' ? createAudioProject : createTextProject;
    const payload = type === 'audio' ? { name } : { name, content };

    mutation.mutate(payload, {
      onSuccess: (data) => {
        setProjectId(data.id);
        setShowCreateDialog(false);
        if (type === 'text') {
          navigate(`/editor/${data.id}`);
        }
      },
    });
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

  const handleTutorialComplete = () => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
  };

  const handleTutorialSkip = () => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
  };

  const handleDeleteProject = () => {
    if (!projectId) return;
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        setProjectId(null);
        setShowDeleteDialog(false);
        setShowProjectMenu(false);
      },
    });
  };

  const handleOpenEditor = () => {
    if (projectId) {
      navigate(`/editor/${projectId}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCreating = createAudioProject.isPending || createTextProject.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showTutorial && <InteractiveTutorial onComplete={handleTutorialComplete} onSkip={handleTutorialSkip} />}
      {showLLMLogs && <LLMLogsViewer onClose={() => setShowLLMLogs(false)} />}

      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto py-4 px-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors" onClick={() => setProjectId(null)} title="Go to home page">
              AI Editor
            </h1>
            <div className="flex items-center gap-3">
              <ProjectSelector selectedProjectId={projectId} onSelectProject={setProjectId} />
              {projectId && (
                <div className="relative" ref={projectMenuRef}>
                  <button onClick={() => setShowProjectMenu(!showProjectMenu)} className="px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors flex items-center gap-2 border border-border">
                    <span>Project</span>
                    <span>{showProjectMenu ? '▲' : '▼'}</span>
                  </button>
                  {showProjectMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                      <button onClick={() => { setIsEditingProject(true); setShowProjectMenu(false); }} className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2">
                        <span>✏️</span><span>Edit Project</span>
                      </button>
                      <button onClick={() => { setShowAnalysisDialog(true); setShowProjectMenu(false); }} className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2">
                        <span>🔍</span><span>AI Analysis</span>
                      </button>
                      <div className="border-t border-border my-1" />
                      <button onClick={() => { setShowDeleteDialog(true); setShowProjectMenu(false); }} className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors flex items-center gap-2">
                        <span>🗑️</span><span>Delete Project</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <LLMSettings selectedProvider={llmProvider} onProviderChange={setLlmProvider} onOpenSettings={() => setShowAISettings(true)} />
              <div className="relative" ref={toolsMenuRef}>
                <button onClick={() => setShowToolsMenu(!showToolsMenu)} className="px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors flex items-center gap-2 border border-border">
                  <span>Tools</span>
                  <span>{showToolsMenu ? '▲' : '▼'}</span>
                </button>
                {showToolsMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                    <button onClick={() => { setShowTutorial(true); setShowToolsMenu(false); }} className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2">
                      <span>📖</span><span>Tutorial</span>
                    </button>
                    <button onClick={() => { setShowLLMLogs(true); setShowToolsMenu(false); }} className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2">
                      <span>📊</span><span>LLM Logs</span>
                    </button>
                    <Link
                      to="/settings/export-templates"
                      onClick={() => setShowToolsMenu(false)}
                      className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <span>📄</span>
                      <span>Export Templates</span>
                    </Link>
                    <div className="border-t border-border my-1" />
                    <div className="px-4 py-2 flex items-center justify-between"><span className="text-sm">Theme</span><ThemeToggle /></div>
                  </div>
                )}
              </div>
              <SystemStatus />
              <Button variant="primary" onClick={() => setShowCreateDialog(true)} loading={isCreating}>New Project</Button>
            </div>
          </div>
          {currentProject && <div className="mt-2 text-sm text-muted-foreground">{currentProject.description}</div>}
          {isEditingProject && currentProject && <ProjectEditor project={currentProject} onClose={() => setIsEditingProject(false)} />}
        </div>
      </header>

      <CreateProjectDialog isOpen={showCreateDialog} onClose={() => setShowCreateDialog(false)} onCreate={handleCreateProject} isCreating={isCreating} />
      <DeleteProjectDialog isOpen={showDeleteDialog} projectName={currentProject?.name || ''} onClose={() => setShowDeleteDialog(false)} onConfirm={handleDeleteProject} isDeleting={deleteProject.isPending} />
      <AISettingsDialog isOpen={showAISettings} onClose={() => setShowAISettings(false)} currentProvider={llmProvider} onProviderChange={setLlmProvider} />
      {projectId && <AnalysisDialog isOpen={showAnalysisDialog} onClose={() => setShowAnalysisDialog(false)} projectId={projectId} currentProvider={llmProvider} />}

      <main className="max-w-7xl mx-auto py-6 px-6">
        {!projectId ? (
          <div className="bg-card rounded-lg shadow-sm border border-border p-12"><div className="max-w-4xl mx-auto space-y-8"><div className="text-center space-y-4"><div className="text-6xl">📝</div><h2 className="text-3xl font-bold">Welcome to the AI Editor</h2><p className="text-lg text-muted-foreground max-w-2xl mx-auto">Create a new project to start editing with AI-powered suggestions, history tracking, and more.</p></div><div className="text-center space-y-3"><Button variant="primary" size="lg" onClick={() => setShowCreateDialog(true)} loading={isCreating}>🚀 Create Your First Project</Button></div></div></div>
        ) : currentProject?.project_type === 'text' ? (
            <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center">
                <div className="text-muted-foreground space-y-4">
                    <div className="text-6xl">✍️</div>
                    <p className="text-lg font-semibold">Text Project: {currentProject.name}</p>
                    <p>This is a text-only project. Open the editor to start writing and editing.</p>
                    <Button size="lg" variant="primary" onClick={handleOpenEditor}>Open Editor</Button>
                </div>
            </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-card rounded-lg shadow-sm border border-border p-6"><h2 className="text-lg font-semibold mb-4">Upload Audio</h2><FileUploader projectId={projectId} onUploadComplete={(fileId) => setSelectedFileId(fileId)} /></div>
              <div className="bg-card rounded-lg shadow-sm border border-border p-6"><h2 className="text-lg font-semibold mb-4">Files</h2><FileList projectId={projectId} selectedFileId={selectedFileId ?? undefined} onSelectFile={setSelectedFileId} /></div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              {selectedFileId ? (
                <>
                  <TranscriptionProgress fileId={selectedFileId} />
                  <AudioPlayer audioUrl={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/audio/${selectedFileId}`} currentTime={audioCurrentTime} onTimeUpdate={setAudioCurrentTime} shouldPlay={shouldPlayAudio} shouldPause={shouldPauseAudio} onPlayingChange={setIsAudioPlaying} />
                  <div className="bg-card rounded-lg shadow-sm border border-border p-6"><SpeakerManager fileId={selectedFileId} /></div>
                  <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Transcription</h2>
                      <div className="flex gap-2">
                        <button onClick={handleOpenEditor} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"><span>✏️</span><span>Open Editor</span></button>
                        <button onClick={() => setShowExportDialog(true)} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"><span>📥</span><span>Export</span></button>
                      </div>
                    </div>
                    <SegmentList fileId={selectedFileId} currentTime={audioCurrentTime} isPlaying={isAudioPlaying} onSegmentClick={handleSegmentClick} onPlayRequest={handlePlayRequest} onPauseRequest={handlePauseRequest} llmProvider={llmProvider} onOpenEditor={handleOpenEditor} />
                  </div>
                  {showExportDialog && selectedFile && <ExportDialog fileId={selectedFileId} filename={selectedFile.original_filename} onClose={() => setShowExportDialog(false)} />}
                </>
              ) : (
                <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center"><div className="text-muted-foreground space-y-2"><div className="text-4xl">📝</div><p className="text-lg">Select a file to view transcription</p></div></div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}