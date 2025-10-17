import { useParams } from 'react-router-dom';
import EditorView from '../components/Editor/EditorView';
import { useSegments } from '../hooks/useTranscription';

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const numericProjectId = projectId ? parseInt(projectId, 10) : null;

  // This is a placeholder for fetching the initial text.
  // In the current structure, segments are tied to a fileId, not a projectId.
  // This will need to be adjusted based on the new data model for text projects.
  // For now, we'll simulate fetching text for the project.
  // We'll need to find a file associated with the project.
  // This is a simplification and will be addressed in later steps.
  const { data: segments } = useSegments(numericProjectId);

  if (!numericProjectId) {
    return <div>Invalid Project ID</div>;
  }

  const initialText = segments ? segments.map(seg => seg.edited_text || seg.original_text).join('\n\n') : "Loading...";

  return (
    <div className="h-screen w-screen">
      <EditorView initialText={initialText} projectId={numericProjectId} />
    </div>
  );
}