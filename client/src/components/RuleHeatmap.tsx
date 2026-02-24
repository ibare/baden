import { useMemo } from 'react';
import type { RuleEvent, Rule } from '@/lib/api';
import { cn } from '@/lib/utils';

interface RuleHeatmapProps {
  rules: Rule[];
  events: RuleEvent[];
  selectedRuleId: string | null;
  onSelectRule: (rule: Rule, eventCount: number) => void;
}

type RuleStatus = 'idle' | 'matched' | 'violated' | 'fixed';

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 0) return '방금';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const STATUS_LABEL: Record<RuleStatus, string> = {
  idle: '대기',
  matched: '매칭',
  violated: '위반',
  fixed: '수정',
};

const DOT_STYLE: Record<RuleStatus, string> = {
  idle: 'border border-muted-foreground/40 bg-transparent',
  matched: 'bg-blue-500',
  violated: 'bg-red-500',
  fixed: 'bg-green-500',
};

const LABEL_COLOR: Record<RuleStatus, string> = {
  idle: 'text-muted-foreground',
  matched: 'text-blue-600',
  violated: 'text-red-600',
  fixed: 'text-green-600',
};

export function RuleHeatmap({ rules, events, selectedRuleId, onSelectRule }: RuleHeatmapProps) {
  const { countMap, statusMap, lastEventMap } = useMemo(() => {
    const countMap = new Map<string, number>();
    const statusMap = new Map<string, RuleStatus>();
    const lastEventMap = new Map<string, string>();

    // Track per-rule flags in a single pass
    const hasViolation = new Set<string>();
    const hasFix = new Set<string>();
    const seen = new Set<string>();

    for (const e of events) {
      const rid = e.rule_id;
      if (!rid) continue;

      countMap.set(rid, (countMap.get(rid) || 0) + 1);
      seen.add(rid);

      // Track latest timestamp
      const prev = lastEventMap.get(rid);
      if (!prev || e.timestamp > prev) {
        lastEventMap.set(rid, e.timestamp);
      }

      if (e.type === 'violation_found') hasViolation.add(rid);
      if (e.type === 'fix_applied') hasFix.add(rid);
    }

    for (const rid of seen) {
      if (hasFix.has(rid)) statusMap.set(rid, 'fixed');
      else if (hasViolation.has(rid)) statusMap.set(rid, 'violated');
      else statusMap.set(rid, 'matched');
    }

    return { countMap, statusMap, lastEventMap };
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable rule list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1 pt-2">
        <div className="flex flex-col">
          {rules.map((rule) => {
            const status: RuleStatus = statusMap.get(rule.id) ?? 'idle';
            const count = countMap.get(rule.id) || 0;
            const lastTs = lastEventMap.get(rule.id);
            const isSelected = rule.id === selectedRuleId;

            return (
              <div
                key={`${rule.project_id}-${rule.id}`}
                onClick={() => onSelectRule(rule, count)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors rounded-sm',
                  'hover:bg-muted/50',
                  status === 'violated' && 'bg-red-500/5',
                  isSelected && 'ring-1 ring-primary bg-muted/30',
                )}
              >
                {/* Status dot */}
                <span
                  className={cn('w-2 h-2 rounded-full shrink-0', DOT_STYLE[status])}
                />
                {/* Rule ID */}
                <span className="w-20 font-mono text-xs truncate text-foreground/80">
                  {rule.id}
                </span>
                {/* Description */}
                <span className="flex-1 text-xs truncate text-muted-foreground">
                  {rule.description ?? rule.file_path}
                </span>
                {/* Status label */}
                <span className={cn('w-8 text-xs text-center shrink-0', LABEL_COLOR[status])}>
                  {STATUS_LABEL[status]}
                </span>
                {/* Relative time */}
                <span className="w-8 text-xs text-right text-muted-foreground shrink-0">
                  {lastTs ? formatRelativeTime(lastTs) : '-'}
                </span>
              </div>
            );
          })}
        </div>

        {rules.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">규칙 없음</div>
        )}
      </div>

      {/* Legend — pinned to bottom */}
      <div className="flex-shrink-0 flex gap-2.5 px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-muted-foreground/40" /> 대기
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> 매칭
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> 위반
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> 수정
        </span>
      </div>
    </div>
  );
}
