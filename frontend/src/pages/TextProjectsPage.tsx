import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProjects, useCreateTextProject, useDeleteProject } from '../hooks/useProjects';
import CreateProjectDialog from '../components/Dashboard/CreateProjectDialog';
import TextEditorTutorial from '../components/Tutorial/TextEditorTutorial';
import { Button } from '../components/ui/Button';

export default function TextProjectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projects, isLoading } = useProjects();
  const createTextProject = useCreateTextProject();
  const deleteProject = useDeleteProject();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    // Show tutorial if URL param is set OR if user hasn't seen it
    return searchParams.get('tutorial') === 'true' || localStorage.getItem('hasSeenTextTutorial') !== 'true';
  });

  const textProjects = useMemo(
    () => (projects ?? []).filter((project) => project.project_type === 'text'),
    [projects]
  );

  useEffect(() => {
    if (!showTutorial) {
      localStorage.setItem('hasSeenTextTutorial', 'true');
      // Remove tutorial parameter from URL if present
      if (searchParams.get('tutorial') === 'true') {
        searchParams.delete('tutorial');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [showTutorial, searchParams, setSearchParams]);

  const handleCreateTextProject = (name: string, _type: 'audio' | 'text', content?: string) => {
    createTextProject.mutate(
      { name, content },
      {
        onSuccess: (project) => {
          setShowCreateDialog(false);
          navigate(`/editor/${project.id}`);
        },
      }
    );
  };

  const handleDeleteProject = (projectId: number) => {
    deleteProject.mutate(projectId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showTutorial && (
        <TextEditorTutorial onComplete={() => setShowTutorial(false)} onSkip={() => setShowTutorial(false)} />
      )}

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/" className="text-primary-600 hover:text-primary-500">
                ← Back to home
              </Link>
            </p>
            <h1 className="mt-2 text-3xl font-bold">AI Text Editor</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => setShowTutorial(true)}>
              View Tutorial
            </Button>
            <Button variant="primary" onClick={() => setShowCreateDialog(true)} loading={createTextProject.isPending}>
              New Text Project
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            Loading projects…
          </div>
        ) : textProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/60 p-12 text-center">
            <div className="text-5xl">✍️</div>
            <h2 className="mt-4 text-2xl font-semibold">Start your first text project</h2>
            <p className="mt-2 text-muted-foreground">
              Use the New Text Project button above to begin drafting with AI assistance.
            </p>
            <Button className="mt-6" variant="primary" onClick={() => setShowCreateDialog(true)}>
              Create Text Project
            </Button>
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {textProjects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                data-testid="text-project-card"
                data-project-id={project.id}
              >
                <div className="text-sm text-muted-foreground" data-project-type="text">
                  Text Project
                </div>
                <h3 className="mt-2 text-xl font-semibold">{project.name}</h3>
                {project.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/editor/${project.id}`)}
                    data-testid={`open-editor-${project.id}`}
                  >
                    Open Editor
                  </Button>
                  <Button variant="ghost" onClick={() => handleDeleteProject(project.id)} disabled={deleteProject.isPending}>
                    Delete
                  </Button>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  Updated {project.updated_at ? new Date(project.updated_at).toLocaleString() : 'recently'}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      <CreateProjectDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateTextProject}
        isCreating={createTextProject.isPending}
        allowedTypes={['text']}
        defaultType="text"
      />
    </div>
  );
}
