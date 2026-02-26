import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { RuleEvent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { X, ArrowsOutCardinal, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { useDragResize } from '@/hooks/useDragResize';
import { groupVerificationCycles, type VerificationCycle } from '@/lib/rule-status';

interface RuleVerificationPanelProps {
  events: RuleEvent[];
  selectedEventId?: string | null;
  onClose: () => void;
  onSelectEvent?: (event: RuleEvent) => void;
}

const resultIcon: Record<'pass' | 'issue', React.ReactNode> = {
  pass: <CheckCircle size={16} weight="fill" className="text-green-500" />,
  issue: <WarningCircle size={16} weight="fill" className="text-red-500" />,
};

const resultLabel: Record<'pass' | 'issue', string> = {
  pass: 'Pass',
  issue: 'Issue',
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(startTs: string, endTs: string): string {
  const ms = new Date(endTs).getTime() - new Date(startTs).getTime();
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function RuleVerificationPanel({ events, selectedEventId, onClose, onSelectEvent }: RuleVerificationPanelProps) {
  const { rect, onDragStart, onResizeStart } = useDragResize();

  const cycles = useMemo(() => {
    return groupVerificationCycles(events).filter((c) => c.result !== 'open');
  }, [events]);

  const panel = (
    <div
      className="fixed z-[60] flex flex-col rounded-lg border border-border bg-background shadow-xl"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      {/* Title bar — draggable */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={onDragStart}
      >
        <ArrowsOutCardinal size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium flex-1">
          Verification Cycles
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body — cycle list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {cycles.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            검증 사이클이 없습니다
          </div>
        ) : (
          cycles.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />
          ))
        )}
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onPointerDown={onResizeStart}
      >
        <svg className="w-full h-full text-muted-foreground/40" viewBox="0 0 16 16">
          <path d="M14 16L16 14M10 16L16 10M6 16L16 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

function CycleCard({ cycle, selectedEventId, onSelectEvent }: { cycle: VerificationCycle; selectedEventId?: string | null; onSelectEvent?: (event: RuleEvent) => void }) {
  return (
    <div className={cn(
      'rounded-md border border-border p-2 space-y-1.5',
      cycle.result === 'issue' && 'border-red-500/30 bg-red-500/5',
      cycle.result === 'pass' && 'border-green-500/30 bg-green-500/5',
    )}>
      {/* Cycle header */}
      <div className="flex items-center gap-2">
        {resultIcon[cycle.result as 'pass' | 'issue']}
        <span className="text-xs font-medium">{resultLabel[cycle.result as 'pass' | 'issue']}</span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {formatTime(cycle.startTimestamp)}
        </span>
        {cycle.startTimestamp !== cycle.endTimestamp && (
          <span className="text-[10px] text-muted-foreground">
            ({formatDuration(cycle.startTimestamp, cycle.endTimestamp)})
          </span>
        )}
      </div>

      {/* Entries */}
      <div className="space-y-0.5 pl-1">
        {cycle.entries.map((entry, i) => (
          <div
            key={`${entry.event.id}-${i}`}
            className={cn(
              'flex items-center gap-1.5 text-[11px] rounded px-1 -mx-1',
              entry.event.id === selectedEventId && 'bg-primary/10',
              onSelectEvent && 'cursor-pointer hover:bg-muted/30',
            )}
            onClick={() => onSelectEvent?.(entry.event)}
          >
            <span className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              entry.status === 'check' && 'bg-blue-500',
              entry.status === 'pass' && 'bg-green-500',
              entry.status === 'violation' && 'bg-red-500',
              entry.status === 'fix' && 'bg-amber-500',
            )} />
            <span className="font-mono text-muted-foreground shrink-0">
              {formatTime(entry.event.timestamp)}
            </span>
            <span className="font-mono text-foreground/70 shrink-0">{entry.ruleId}</span>
            <span className="truncate text-muted-foreground">
              {entry.event.message || entry.action}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
