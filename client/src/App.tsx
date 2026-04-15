import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from '@/hooks/useProjectContext';
import { RootLayout } from '@/components/layout/RootLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { ActionRegistryPage } from '@/pages/ActionRegistryPage';
import { HomeDashboard } from '@/pages/HomeDashboard';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { RuleDetailPage } from '@/pages/RuleDetailPage';
import { ComparePage } from '@/pages/ComparePage';

export default function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/projects/:projectId/monitor" element={<AppLayout />} />
            <Route path="/projects/:projectId/registry" element={<ActionRegistryPage />} />
            <Route path="/projects/:projectId/analysis" element={<AnalysisPage />} />
            <Route path="/projects/:projectId/analysis/rules/:ruleId" element={<RuleDetailPage />} />
          </Route>
        </Routes>
      </ProjectProvider>
    </BrowserRouter>
  );
}
