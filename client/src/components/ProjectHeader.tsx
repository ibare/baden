import type { Project } from '@/lib/api';
import { AgentBadge } from '@/components/domain/AgentBadge';

interface ProjectHeaderProps {
  project: Project | null;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  if (!project) {
    return (
      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm text-muted-foreground">
          Select a project from the sidebar
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 border-b border-border">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-foreground truncate">
          {project.name}
        </h2>
        <AgentBadge agent={project.agent} variant="full" className="flex-shrink-0" />
      </div>
      {project.description && (
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
          {project.description}
        </p>
      )}
    </div>
  );
}
