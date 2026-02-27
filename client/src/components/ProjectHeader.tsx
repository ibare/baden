import { useState } from 'react';
import type { Project } from '@/lib/api';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ClipboardText, Check } from '@phosphor-icons/react';

interface ProjectHeaderProps {
  project: Project | null;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const [copied, setCopied] = useState(false);

  if (!project) {
    return (
      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm text-muted-foreground">
          Select a project from the sidebar
        </p>
      </div>
    );
  }

  const handleCopy = async () => {
    const text = await api.getInstruction(project.id);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground truncate">
          {project.name}
        </h2>
        {project.description && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {project.description}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="gap-1.5 flex-shrink-0"
      >
        {copied ? (
          <Check size={14} />
        ) : (
          <ClipboardText size={14} />
        )}
        {copied ? 'Copied' : 'Copy Protocol'}
      </Button>
    </div>
  );
}
