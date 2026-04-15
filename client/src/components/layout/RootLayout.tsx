import { useState, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import type { Project, ActionPrefix, DetailKeyword } from '@/lib/api';
import { useProject } from '@/hooks/useProjectContext';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import { useActionRegistry } from '@/hooks/useActionRegistry';
import { useTaskNotification } from '@/hooks/useTaskNotification';
import type { ResolvedAction } from '@/hooks/useActionRegistry';
import type { EventCategory } from '@/lib/event-types';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

export interface RootOutletContext {
  prefixes: ActionPrefix[];
  keywords: DetailKeyword[];
  resolveAction: (action: string | null, type: string) => ResolvedAction;
  resolveCategory: (action: string | null, type: string) => EventCategory;
  resolveIcon: (action: string | null) => string | null;
  refreshRegistry: () => Promise<void>;
  connected: boolean;
  setConnected: (v: boolean) => void;
}

export function RootLayout() {
  const { projects, addProject, updateProject, removeProject } = useProject();
  const selectedProject = useSelectedProject();
  const navigate = useNavigate();
  const location = useLocation();
  const { prefixes, keywords, resolveAction, resolveCategory, resolveIcon, refresh: refreshRegistry } =
    useActionRegistry(selectedProject);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connected, setConnected] = useState(false);
  useTaskNotification(projects);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === selectedProject) ?? null,
    [projects, selectedProject],
  );

  // 현재 경로에서 뷰 세그먼트 추출 (monitor/analysis/registry), 없으면 monitor
  const currentView = useMemo(() => {
    const match = location.pathname.match(/\/projects\/[^/]+\/(monitor|analysis|registry)/);
    return match ? match[1] : 'monitor';
  }, [location.pathname]);

  const handleSelectProject = useCallback(
    (id: string) => {
      navigate(`/projects/${id}/${currentView}`);
    },
    [navigate, currentView],
  );

  const handleProjectCreated = useCallback(
    (project: Project) => {
      addProject(project);
      navigate(`/projects/${project.id}/${currentView}`);
    },
    [addProject, navigate, currentView],
  );

  const handleProjectUpdated = useCallback(
    (project: Project) => {
      updateProject(project);
    },
    [updateProject],
  );

  const handleProjectDeleted = useCallback(
    (id: string) => {
      removeProject(id);
      if (selectedProject === id) {
        navigate('/');
      }
    },
    [removeProject, selectedProject, navigate],
  );

  const outletContext: RootOutletContext = {
    prefixes,
    keywords,
    resolveAction,
    resolveCategory,
    resolveIcon,
    refreshRegistry,
    connected,
    setConnected,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: 접힘 시 w-12 (아이콘 모드), 펼침 시 w-56 */}
      <div
        className={`${sidebarOpen ? 'w-56' : 'w-12'} transition-[width] duration-200 flex-shrink-0`}
      >
        <Sidebar
          projects={projects}
          selectedProject={selectedProject}
          collapsed={!sidebarOpen}
          onSelectProject={handleSelectProject}
          onProjectCreated={handleProjectCreated}
          onProjectUpdated={handleProjectUpdated}
          onProjectDeleted={handleProjectDeleted}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar
          connected={connected}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          currentProject={currentProject}
        />
        <div className="flex-1 min-h-0 flex min-w-0">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
}
