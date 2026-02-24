import { useState } from 'react';
import { api } from '@/lib/api';
import type { Project } from '@/lib/api';
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
import { Plus } from 'lucide-react';

interface CreateProjectDialogProps {
  onCreated: (project: Project) => void;
  children?: React.ReactNode;
}

export function CreateProjectDialog({ onCreated, children }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rulesPath, setRulesPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setDescription('');
    setRulesPath('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rulesPath.trim()) return;

    setLoading(true);
    setError('');
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        rulesPath: rulesPath.trim(),
      });
      reset();
      setOpen(false);
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로젝트 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="icon-sm">
            <Plus />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 프로젝트</DialogTitle>
          <DialogDescription>모니터링할 프로젝트를 등록합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">이름 *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">설명</Label>
            <Input
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="프로젝트 설명 (선택)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-rules">규칙 경로 *</Label>
            <Input
              id="project-rules"
              value={rulesPath}
              onChange={(e) => setRulesPath(e.target.value)}
              placeholder="/path/to/.cursor/rules"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !rulesPath.trim()}>
              {loading ? '생성 중...' : '등록'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
