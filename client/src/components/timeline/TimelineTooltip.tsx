import { memo } from 'react';
import type { PlacedItem } from './lib/types';

interface TimelineTooltipProps {
  item: PlacedItem | null;
  position: { x: number; y: number } | null;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const TimelineTooltip = memo(function TimelineTooltip({
  item,
  position,
}: TimelineTooltipProps) {
  if (!item || !position) return null;

  return (
    <div
      className="absolute z-40 bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs pointer-events-none max-w-xs"
      style={{
        left: position.x + 12,
        top: position.y - 8,
      }}
    >
      <div className="font-medium text-foreground">
        {item.event.action || item.event.type.replace(/_/g, ' ')}
      </div>
      <div className="text-muted-foreground mt-0.5">
        {formatTime(item.startMs)}
        {!item.isInstant && ` - ${formatTime(item.endMs)}`}
      </div>
      {item.event.message && (
        <div className="text-muted-foreground mt-0.5 truncate">{item.event.message}</div>
      )}
      {item.event.file && (
        <div className="text-muted-foreground mt-0.5 font-mono truncate">{item.event.file}</div>
      )}
      {item.event.rule_id && (
        <div className="text-muted-foreground mt-0.5 font-mono truncate">
          rule: {item.event.rule_id}
        </div>
      )}
      {item.event.result && (
        <div className="text-muted-foreground mt-0.5 truncate">{item.event.result}</div>
      )}
    </div>
  );
});
