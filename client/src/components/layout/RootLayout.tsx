import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import type { Project, ActionPrefix } from '@/lib/api';
import { useProject } from '@/hooks/useProjectContext';
import { useActionRegistry } from '@/hooks/useActionRegistry';
import type { ResolvedAction } from '@/hooks/useActionRegistry';
import type { EventCategory } from '@/lib/event-types';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

export interface RootOutletContext {
  prefixes: ActionPrefix[];
  resolveAction: (action: string | null, type: string) => ResolvedAction;
  resolveCategory: (action: string | null, type: string) => EventCategory;
  resolveIcon: (action: string | null) => string | null;
  refreshRegistry: () => Promise<void>;
  connected: boolean;
  setConnected: (v: boolean) => void;
}

export function RootLayout() {
  const { projects, selectedProject, setSelectedProject, addProject } = useProject();
  const { prefixes, resolveAction, resolveCategory, resolveIcon, refresh: refreshRegistry } =
    useActionRegistry(selectedProject);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleProjectCreated = useCallback(
    (project: Project) => {
      addProject(project);
      setSelectedProject(project.id);
    },
    [addProject, setSelectedProject],
  );

  const outletContext: RootOutletContext = {
    prefixes,
    resolveAction,
    resolveCategory,
    resolveIcon,
    refreshRegistry,
    connected,
    setConnected,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? 'w-56' : 'w-0'} transition-[width] duration-200 overflow-hidden flex-shrink-0`}
      >
        <Sidebar
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          onProjectCreated={handleProjectCreated}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar
          connected={connected}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <div className="flex-1 min-h-0 flex min-w-0">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
}
