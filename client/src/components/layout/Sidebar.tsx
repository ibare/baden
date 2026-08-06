import { useState } from 'react';
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
import { FolderOpen, Plus, PencilSimple, House, Trash, ArrowsLeftRight, ArrowsClockwise } from '@phosphor-icons/react';

interface SidebarProps {
  projects: Project[];
  selectedProject: string;
  collapsed: boolean;
  onSelectProject: (id: string) => void;
  onProjectCreated: (project: Project) => void;
  onProjectUpdated: (project: Project) => void;
  onProjectDeleted: (id: string) => void;
}

export function Sidebar({
  projects,
  selectedProject,
  collapsed,
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
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ projectId: string; text: string } | null>(null);

  const handleSync = async (project: Project) => {
    setSyncingId(project.id);
    try {
      const { sync } = await api.syncRules(project.id);
      const parts: string[] = [];
      if (sync.added.length) parts.push(`추가 ${sync.added.length}`);
      if (sync.updated.length) parts.push(`변경 ${sync.updated.length}`);
      if (sync.renamed.length) parts.push(`이름변경 ${sync.renamed.length}`);
      if (sync.removed.length) parts.push(`삭제 ${sync.removed.length}`);
      if (sync.restored.length) parts.push(`복원 ${sync.restored.length}`);
      setSyncMessage({
        projectId: project.id,
        text: parts.length ? parts.join(' · ') : '변경 없음',
      });
      // 규칙 목록을 들고 있는 화면에 갱신을 알린다
      window.dispatchEvent(new CustomEvent('baden:rules-synced', { detail: { projectId: project.id } }));
    } catch (err) {
      console.error('Failed to sync rules:', err);
      setSyncMessage({ projectId: project.id, text: '재싱크 실패' });
    } finally {
      setSyncingId(null);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

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

  const globalNav = [
    { path: '/', label: 'Home', icon: House },
    { path: '/compare', label: 'Compare', icon: ArrowsLeftRight },
  ];

  return (
    <aside className="flex flex-col h-full border-r border-border bg-card/50">
      {/* 글로벌 네비게이션 */}
      <nav className="px-2 pt-2 pb-1 space-y-0.5">
        {globalNav.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'w-full flex items-center gap-2 rounded-md text-sm transition-colors text-left',
                collapsed ? 'justify-center px-0 py-2' : 'px-2 py-1.5',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={cn(
        'py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t border-border mt-1',
        collapsed ? 'px-0 text-center' : 'px-3',
      )}>
        {collapsed ? '···' : 'Projects'}
      </div>

      {/* 프로젝트 목록 */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {projects.map((p) => {
          const isActive = p.id === selectedProject;
          return (
            <div key={p.id} className="group relative">
              <button
                onClick={() => onSelectProject(p.id)}
                title={collapsed ? p.name : undefined}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md text-sm transition-colors text-left',
                  collapsed ? 'justify-center px-0 py-2' : 'px-2 py-1.5',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {collapsed ? (
                  <span className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <>
                    <FolderOpen size={16} className="flex-shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </>
                )}
              </button>
              {/* 편집/삭제 버튼은 펼침 모드에서만 */}
              {!collapsed && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync(p);
                    }}
                    disabled={syncingId === p.id}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
                    title="규칙 다시 읽기"
                  >
                    <ArrowsClockwise
                      size={14}
                      className={syncingId === p.id ? 'animate-spin' : undefined}
                    />
                  </button>
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
              )}
              {!collapsed && syncMessage?.projectId === p.id && (
                <div className="px-2 pb-1 text-[11px] text-muted-foreground truncate">
                  {syncMessage.text}
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && !collapsed && (
          <div className="text-xs text-muted-foreground text-center py-6">
            No projects
          </div>
        )}
      </nav>

      <div className="p-2 border-t border-border">
        <ProjectDialog onCreated={onProjectCreated}>
          <button
            title={collapsed ? 'Add Project' : undefined}
            className={cn(
              'w-full flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors',
              collapsed ? 'justify-center px-0 py-2' : 'px-2 py-1.5',
            )}
          >
            <Plus size={16} />
            {!collapsed && 'Add Project'}
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
