import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectProvider } from '@/hooks/useProjectContext';

export default function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route path="/" element={<AppLayout />} />
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
