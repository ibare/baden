import { useLocation, useNavigate } from 'react-router-dom';
import { List, Monitor, ChartLine, Sliders, CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/api';

interface TopBarProps {
  connected: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  currentProject: Project | null;
}

const PROJECT_TABS = [
  { key: 'monitor', label: 'Monitor', icon: Monitor },
  { key: 'analysis', label: 'Analysis', icon: ChartLine },
  { key: 'registry', label: 'Registry', icon: Sliders },
] as const;

function getActiveTab(pathname: string, projectId: string): string | null {
  const base = `/projects/${projectId}`;
  if (pathname.startsWith(`${base}/analysis`)) return 'analysis';
  if (pathname.startsWith(`${base}/registry`)) return 'registry';
  if (pathname.startsWith(`${base}/monitor`)) return 'monitor';
  return null;
}

export function TopBar({ connected, sidebarOpen, onToggleSidebar, currentProject }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = currentProject ? getActiveTab(location.pathname, currentProject.id) : null;

  return (
    <header className="flex items-center h-11 px-3 border-b border-border bg-card/80 backdrop-blur flex-shrink-0 gap-3">
      {/* 좌측: 사이드바 토글 + 로고 + Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <List size={18} weight="bold" />
        </button>
        <h1 className="text-lg font-bold text-foreground tracking-tight flex-shrink-0">
          <span className="text-primary">B</span>aden
        </h1>

        {/* Breadcrumb */}
        {currentProject && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <CaretRight size={12} className="flex-shrink-0" />
            <span className="truncate font-medium text-foreground">
              {currentProject.name}
            </span>
          </div>
        )}
      </div>

      {/* 중앙: 프로젝트 뷰 탭 */}
      {currentProject && (
        <nav className="flex items-center gap-0.5 ml-4">
          {PROJECT_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(`/projects/${currentProject.id}/${tab.key}`)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* 우측: 연결 상태 */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-xs text-muted-foreground">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </header>
  );
}
