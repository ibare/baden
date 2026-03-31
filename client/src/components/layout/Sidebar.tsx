import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Project } from '@/lib/api';
import { api } from '@/lib/api';
import { ProjectDialog } from '@/components/domain/ProjectDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { FolderOpen, Plus, Monitor, Sliders, PencilSimple, House, Trash } from '@phosphor-icons/react';

interface SidebarProps {
  projects: Project[];
  selectedProject: string;
  onSelectProject: (id: string) => void;
  onProjectCreated: (project: Project) => void;
  onProjectUpdated: (project: Project) => void;
  onProjectDeleted: (id: string) => void;
}

export function Sidebar({
  projects,
  selectedProject,
  onSelectProject,
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingProject) return;
    setDeleting(true);
    try {
      await api.deleteProject(deletingProject.id);
      onProjectDeleted(deletingProject.id);
      setDeletingProject(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setDeleting(false);
    }
  };

  const navItems = useMemo(() => {
    const items = [
      { path: '/', label: 'Home', icon: House },
    ];
    if (selectedProject) {
      items.push(
        { path: `/projects/${selectedProject}/monitor`, label: 'Monitor', icon: Monitor },
        { path: `/projects/${selectedProject}/registry`, label: 'Action Registry', icon: Sliders },
      );
    }
    return items;
  }, [selectedProject]);

  return (
    <aside className="min-w-[14rem] w-56 flex-shrink-0 border-r border-border bg-card/50 flex flex-col h-full">
      {/* Navigation */}
      <nav className="px-2 pt-2 pb-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
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
            <div key={p.id} className="group relative">
              <button
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
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProject(p);
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Edit project"
                >
                  <PencilSimple size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingProject(p);
                  }}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete project"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">
            No projects
          </div>
        )}
      </nav>

      <div className="p-2 border-t border-border">
        <ProjectDialog onCreated={onProjectCreated}>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <Plus size={16} />
            Add Project
          </button>
        </ProjectDialog>
      </div>

      {/* Edit project dialog */}
      {editingProject && (
        <ProjectDialog
          project={editingProject}
          open={!!editingProject}
          onOpenChange={(open) => { if (!open) setEditingProject(null); }}
          onUpdated={(updated) => {
            onProjectUpdated(updated);
            setEditingProject(null);
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingProject} onOpenChange={(open) => { if (!open) setDeletingProject(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Project "{deletingProject?.name}" and all associated data (events, rules, etc.) will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
