import { memo, useMemo } from 'react';
import type { RuleEvent } from '@/lib/api';
import { cn } from '@/lib/utils';

interface RuleStripProps {
  events: RuleEvent[];
  panelOpen: boolean;
  onTogglePanel: () => void;
}

type EventKind = 'check' | 'violation' | 'pass' | 'fix';

const kindConfig: Record<EventKind, { label: string; color: string }> = {
  check: { label: '체크', color: 'bg-blue-500/15 text-blue-600 border-blue-500/40' },
  violation: { label: '위반', color: 'bg-red-500/15 text-red-600 border-red-500/40' },
  pass: { label: '통과', color: 'bg-green-500/15 text-green-600 border-green-500/40' },
  fix: { label: '수정', color: 'bg-amber-500/15 text-amber-600 border-amber-500/40' },
};

const kindOrder: EventKind[] = ['check', 'violation', 'pass', 'fix'];

function classifyEvent(e: RuleEvent): EventKind | null {
  const t = e.type;
  const a = e.action;
  if (t === 'check_rule' || a === 'check_rule') return 'check';
  if (t === 'rule_violation' || t === 'violation_found' || t === 'review_issue' || a === 'rule_violation' || a === 'violation_found' || a === 'review_issue') return 'violation';
  if (t === 'rule_pass' || t === 'review_pass' || a === 'rule_pass' || a === 'review_pass') return 'pass';
  if (t === 'fix_applied' || a === 'fix_applied') return 'fix';
  return null;
}

export const RuleStrip = memo(function RuleStrip({
  events,
  panelOpen,
  onTogglePanel,
}: RuleStripProps) {
  const counts = useMemo(() => {
    const map: Record<EventKind, number> = { check: 0, violation: 0, pass: 0, fix: 0 };
    for (const e of events) {
      const kind = classifyEvent(e);
      if (kind) map[kind]++;
    }
    return map;
  }, [events]);

  const hasAny = kindOrder.some((k) => counts[k] > 0);
  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-1.5">
      {kindOrder.map((kind) => {
        const count = counts[kind];
        if (count === 0) return null;
        const { label, color } = kindConfig[kind];
        return (
          <button
            key={kind}
            onClick={onTogglePanel}
            className={cn(
              'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono border transition-colors',
              color,
              panelOpen && 'ring-1 ring-primary ring-offset-1 ring-offset-background',
            )}
          >
            {label} <span className="ml-0.5 opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
});
