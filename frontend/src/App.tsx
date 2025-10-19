import { Routes, Route } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import AudioDashboardPage from './pages/AudioDashboardPage';
import ExportTemplatesPage from './pages/ExportTemplatesPage';
import HomePage from './pages/HomePage';
import TextProjectsPage from './pages/TextProjectsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/audio" element={<AudioDashboardPage />} />
      <Route path="/text" element={<TextProjectsPage />} />
      <Route path="/editor/:projectId" element={<EditorPage />} />
      <Route path="/settings/export-templates" element={<ExportTemplatesPage />} />
    </Routes>
  );
}

export default App;
