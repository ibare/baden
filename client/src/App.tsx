import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LiveMonitor } from '@/pages/LiveMonitor';
import { ProjectProvider } from '@/hooks/useProjectContext';

export default function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route path="/" element={<LiveMonitor />} />
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
