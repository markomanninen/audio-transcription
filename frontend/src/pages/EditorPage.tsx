import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EditorView from '../components/Editor/EditorView';
import { useProject } from '../hooks/useProjects';
import TextEditorTutorial from '../components/Tutorial/TextEditorTutorial';
import LLMLogsViewer from '../components/Debug/LLMLogsViewer';
import ThemeToggle from '../components/ThemeToggle';
import { Button } from '../components/ui/Button';
import { buttonVariants } from '../components/ui/button-variants';

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const numericProjectId = projectId ? parseInt(projectId, 10) : null;

  const [showTutorial, setShowTutorial] = useState(false);
  const [showLLMLogs, setShowLLMLogs] = useState(false);

  // Fetch the project data which includes the text document for text projects
  const { data: project, isLoading } = useProject(numericProjectId);

  const initialText = useMemo(() => {
    if (isLoading) return 'Loading...';
    if (!project) return '';
    if (project.project_type === 'text' && project.text_document) {
      return project.text_document.content;
    }
    return '';
  }, [project, isLoading]);

  if (!numericProjectId) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Invalid Project ID</div>;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {showTutorial && <TextEditorTutorial onComplete={() => setShowTutorial(false)} onSkip={() => setShowTutorial(false)} />}
      {showLLMLogs && <LLMLogsViewer onClose={() => setShowLLMLogs(false)} />}

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/text" className="text-primary-600 hover:text-primary-500">
                ← Back to text projects
              </Link>
            </p>
            <h1 className="mt-1 text-2xl font-bold">AI Text Editor</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setShowTutorial(true)}>
              View Tutorial
            </Button>
            <Button variant="outline" onClick={() => setShowLLMLogs(true)}>
              View LLM Logs
            </Button>
            <ThemeToggle />
            <Link to="/audio" className={buttonVariants({ variant: 'primary' })}>
              Go to Audio Studio
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <EditorView initialText={initialText} projectId={numericProjectId} />
      </main>
    </div>
  );
}
