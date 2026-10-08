import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { AgentType, Project } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderOpen, Plus } from '@phosphor-icons/react';

const AGENT_OPTIONS: { value: AgentType; label: string }[] = [
  { value: 'claude_code', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
];

interface ProjectDialogProps {
  /** 수정 모드: 기존 프로젝트 전달 시 편집 모드 */
  project?: Project;
  onCreated?: (project: Project) => void;
  onUpdated?: (project: Project) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function ProjectDialog({
  project,
  onCreated,
  onUpdated,
  open: controlledOpen,
  onOpenChange,
  children,
}: ProjectDialogProps) {
  const isEdit = !!project;
  const isControlled = controlledOpen !== undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rulesPath, setRulesPath] = useState('');
  const [agent, setAgent] = useState<AgentType>('claude_code');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [rulesWarning, setRulesWarning] = useState('');

  // 수정 모드: 다이얼로그 열릴 때 기존 값으로 초기화
  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description ?? '');
      setRulesPath(project.rules_path ?? '');
      setAgent(project.agent ?? 'claude_code');
      setError('');
      setRulesWarning('');
    } else if (open && !project) {
      setName('');
      setDescription('');
      setRulesPath('');
      setAgent('claude_code');
      setError('');
      setRulesWarning('');
    }
  }, [open, project]);

  // 브라우저는 폴더의 절대 경로를 주지 않으므로 서버가 macOS 선택창을 띄운다
  const handleBrowse = async () => {
    setPicking(true);
    setError('');
    try {
      const result = await api.pickDirectory(rulesPath.trim() || undefined);
      if (result.status === 'selected') {
        setRulesPath(result.path);
        setRulesWarning(result.hasIndex ? '' : 'INDEX.yaml not found in this folder.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder picker');
    } finally {
      setPicking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        const updated = await api.updateProject(project.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          rulesPath: rulesPath.trim() || undefined,
          agent,
        });
        setOpen(false);
        onUpdated?.(updated);
      } else {
        const created = await api.createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          rulesPath: rulesPath.trim() || undefined,
          agent,
        });
        setOpen(false);
        onCreated?.(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} project`);
    } finally {
      setLoading(false);
    }
  };

  const dialogContent = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Project' : 'New Project'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update project settings.' : 'Register a project to monitor.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Name *</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-project"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-desc">Description</Label>
          <Input
            id="project-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Project description (optional)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-rules">Rules Path</Label>
          <div className="flex gap-2">
            <Input
              id="project-rules"
              className="min-w-0 flex-1"
              value={rulesPath}
              onChange={(e) => {
                setRulesPath(e.target.value);
                setRulesWarning('');
              }}
              placeholder="/path/to/project/rules (optional)"
            />
            <Button type="button" variant="outline" onClick={handleBrowse} disabled={picking}>
              <FolderOpen />
              {picking ? 'Choosing...' : 'Browse'}
            </Button>
          </div>
          {rulesWarning && (
            <p className="text-xs text-amber-600">{rulesWarning}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-agent">AI Agent</Label>
          <Select value={agent} onValueChange={(v) => setAgent(v as AgentType)}>
            <SelectTrigger id="project-agent" className="w-full">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {AGENT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save' : 'Create')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  // 외부 제어 모드 (수정 모드에서 trigger 없이 open/close 제어)
  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  // 내부 제어 모드 (생성 모드 - trigger 포함)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="icon-sm">
            <Plus />
          </Button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
