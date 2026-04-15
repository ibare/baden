import { useState } from 'react';
import type { ViolationStory } from '@/lib/api';

const PHASE_COLORS: Record<string, string> = {
  receive: '#94a3b8',
  plan: '#818cf8',
  explore: '#38bdf8',
  rule_check: '#f59e0b',
  implement: '#34d399',
  verify: '#a78bfa',
  complete: '#6366f1',
  other: '#64748b',
};

const KIND_INDICATORS: Record<string, { color: string; label: string }> = {
  violation: { color: '#ef4444', label: 'V' },
  fix: { color: '#22c55e', label: 'F' },
  match: { color: '#3b82f6', label: 'M' },
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

interface Props {
  data: ViolationStory[];
}

export function ViolationStories({ data }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No violation stories found.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((story) => (
        <div key={story.taskId} className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === story.taskId ? null : story.taskId)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${story.resolved ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
              {story.taskId.slice(0, 8)}
            </span>
            {/* Phase flow minimap */}
            <div className="flex-1 flex items-center gap-px h-3 min-w-0">
              {story.steps.slice(0, 40).map((step, i) => (
                <div
                  key={i}
                  className="h-full flex-1 min-w-[2px] max-w-[6px] rounded-[1px]"
                  style={{
                    backgroundColor: step.kind
                      ? KIND_INDICATORS[step.kind]?.color ?? PHASE_COLORS[step.phase]
                      : PHASE_COLORS[step.phase] ?? '#64748b',
                    opacity: step.kind ? 1 : 0.5,
                  }}
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">
              {story.violationCount}V
            </span>
            <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">
              {formatDuration(story.durationSec)}
            </span>
          </button>

          {expanded === story.taskId && (
            <div className="border-t border-border px-3 py-2 space-y-1 bg-muted/10 max-h-[300px] overflow-y-auto">
              {story.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground tabular-nums w-16 flex-shrink-0">
                    {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PHASE_COLORS[step.phase] ?? '#64748b' }}
                  />
                  <span className="truncate flex-1 min-w-0 text-foreground">
                    {step.action}
                  </span>
                  {step.kind && (
                    <span
                      className="text-[10px] font-bold px-1 rounded flex-shrink-0"
                      style={{ color: KIND_INDICATORS[step.kind]?.color }}
                    >
                      {KIND_INDICATORS[step.kind]?.label}
                    </span>
                  )}
                  {step.ruleId && (
                    <span className="text-muted-foreground font-mono truncate max-w-[80px] flex-shrink-0">
                      {step.ruleId}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
