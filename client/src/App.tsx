import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from '@/hooks/useProjectContext';
import { RootLayout } from '@/components/layout/RootLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { ActionRegistryPage } from '@/pages/ActionRegistryPage';

export default function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<AppLayout />} />
            <Route path="/registry" element={<ActionRegistryPage />} />
          </Route>
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
