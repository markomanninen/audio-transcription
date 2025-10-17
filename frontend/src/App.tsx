import { Routes, Route } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import DashboardPage from './pages/DashboardPage';
import ExportTemplatesPage from './pages/ExportTemplatesPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/editor/:projectId" element={<EditorPage />} />
      <Route path="/settings/export-templates" element={<ExportTemplatesPage />} />
    </Routes>
  );
}

export default App;