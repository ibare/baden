import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from '@/hooks/useProjectContext';
import { RootLayout } from '@/components/layout/RootLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { ActionRegistryPage } from '@/pages/ActionRegistryPage';
import { HomeDashboard } from '@/pages/HomeDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/projects/:projectId/monitor" element={<AppLayout />} />
            <Route path="/projects/:projectId/registry" element={<ActionRegistryPage />} />
          </Route>
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
