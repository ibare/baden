import type { Project } from '@/lib/api';

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
      <h2 className="text-base font-semibold text-foreground truncate">
        {project.name}
      </h2>
      {project.description && (
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
          {project.description}
        </p>
      )}
    </div>
  );
}
