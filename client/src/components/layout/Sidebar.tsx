import type { Project } from '@/lib/api';
import { CreateProjectDialog } from '@/components/domain/CreateProjectDialog';
import { cn } from '@/lib/utils';
import { FolderOpen, Plus } from '@phosphor-icons/react';

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
  return (
    <aside className="min-w-[14rem] w-56 flex-shrink-0 border-r border-border bg-card/50 flex flex-col h-full">
      <div className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        프로젝트
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
            프로젝트가 없습니다
          </div>
        )}
      </nav>

      <div className="p-2 border-t border-border">
        <CreateProjectDialog onCreated={onProjectCreated}>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <Plus size={16} />
            프로젝트 추가
          </button>
        </CreateProjectDialog>
      </div>
    </aside>
  );
}
