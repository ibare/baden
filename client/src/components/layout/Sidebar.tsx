import { useLocation, useNavigate } from 'react-router-dom';
import type { Project } from '@/lib/api';
import { CreateProjectDialog } from '@/components/domain/CreateProjectDialog';
import { cn } from '@/lib/utils';
import { FolderOpen, Plus, Monitor, Sliders } from '@phosphor-icons/react';

interface SidebarProps {
  projects: Project[];
  selectedProject: string;
  onSelectProject: (id: string) => void;
  onProjectCreated: (project: Project) => void;
}

export function Sidebar({
  projects,
  selectedProject,
  onSelectProject,
  onProjectCreated,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Monitor', icon: Monitor },
    { path: '/registry', label: 'Action Registry', icon: Sliders },
  ];

  return (
    <aside className="min-w-[14rem] w-56 flex-shrink-0 border-r border-border bg-card/50 flex flex-col h-full">
      {/* Navigation */}
      <nav className="px-2 pt-2 pb-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <item.icon size={16} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t border-border mt-1">
        Projects
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {projects.map((p) => {
          const isActive = p.id === selectedProject;
          return (
            <button
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <FolderOpen size={16} className="flex-shrink-0" />
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}

        {projects.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">
            No projects
          </div>
        )}
      </nav>

      <div className="p-2 border-t border-border">
        <CreateProjectDialog onCreated={onProjectCreated}>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <Plus size={16} />
            Add Project
          </button>
        </CreateProjectDialog>
      </div>
    </aside>
  );
}
