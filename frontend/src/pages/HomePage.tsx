import { Link } from 'react-router-dom';
import { buttonVariants } from '../components/ui/button-variants';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-3xl font-bold">AI Workspace</h1>
          <p className="mt-2 text-muted-foreground">
            Choose a workspace to get started with audio transcription or the AI text editor.
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <section className="grid gap-8 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card/80 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="text-5xl">🎙️</div>
            <h2 className="mt-4 text-2xl font-semibold">Audio Transcription</h2>
            <p className="mt-2 text-muted-foreground">
              Upload recordings, manage speaker diarization, and review AI-assisted transcripts with export-ready
              formats.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link to="/audio" className={buttonVariants({ variant: 'primary' })}>
                Open Transcription Studio
              </Link>
              <Link to="/audio?tutorial=true" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                View tutorial →
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card/80 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="text-5xl">✍️</div>
            <h2 className="mt-4 text-2xl font-semibold">AI Text Editor</h2>
            <p className="mt-2 text-muted-foreground">
              Craft and refine long-form content with AI reconstructions, style transformations, and export templates.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link to="/text" className={buttonVariants({ variant: 'primary' })}>
                Open Text Editor
              </Link>
              <Link to="/text?tutorial=true" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                View tutorial →
              </Link>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
