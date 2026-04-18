import type { AgentType } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AgentMeta {
  label: string;
  color: string;
}

const AGENT_META: Record<AgentType, AgentMeta> = {
  claude_code: { label: 'Claude Code', color: '#d97757' },
  codex: { label: 'Codex', color: '#10a37f' },
};

function getMeta(agent: AgentType | null | undefined): AgentMeta {
  return AGENT_META[agent ?? 'claude_code'] ?? AGENT_META.claude_code;
}

interface AgentBadgeProps {
  agent: AgentType | null | undefined;
  variant?: 'icon' | 'full';
  className?: string;
}

export function AgentBadge({ agent, variant = 'icon', className }: AgentBadgeProps) {
  const meta = getMeta(agent);

  if (variant === 'icon') {
    return (
      <span
        title={meta.label}
        aria-label={meta.label}
        className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', className)}
        style={{ backgroundColor: meta.color }}
      />
    );
  }

  return (
    <span
      title={meta.label}
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}
