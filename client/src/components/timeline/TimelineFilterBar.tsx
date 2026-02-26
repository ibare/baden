import { memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CaretLeft, CaretRight, Crosshair, MagnifyingGlass, MagnifyingGlassPlus, MagnifyingGlassMinus, Rows } from '@phosphor-icons/react';
import type { RuleEvent } from '@/lib/api';
import type { ExpandLevel } from './lib/constants';
import { SLIDER_MIN_SEC, SLIDER_MAX_SEC, SLIDER_STEP_SEC } from './lib/constants';
import { RuleStrip } from './RuleStrip';

interface TimelineFilterBarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  isToday: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  events: RuleEvent[];
  panelOpen: boolean;
  onTogglePanel: () => void;
  expandLevel: ExpandLevel;
  onCycleExpand: () => void;
  zoomSec: number;
  onZoomChange: (sec: number) => void;
  autoFollow: boolean;
  onToggleAutoFollow: () => void;
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export const TimelineFilterBar = memo(function TimelineFilterBar({
  selectedDate,
  onDateChange,
  isToday,
  search,
  onSearchChange,
  events,
  panelOpen,
  onTogglePanel,
  expandLevel,
  onCycleExpand,
  zoomSec,
  onZoomChange,
  autoFollow,
  onToggleAutoFollow,
}: TimelineFilterBarProps) {
  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onZoomChange(parseFloat(e.target.value));
    },
    [onZoomChange],
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border flex-shrink-0">
      {/* Date navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <CaretLeft size={16} />
        </button>
        <span
          className={cn(
            'text-sm font-mono px-2 py-0.5 rounded min-w-[7rem] text-center',
            isToday && 'text-primary',
          )}
        >
          {formatDateDisplay(selectedDate)}
        </span>
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, 1))}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <CaretRight size={16} />
        </button>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Search */}
      <div className="relative max-w-xs">
        <MagnifyingGlass size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 text-xs pl-7"
        />
      </div>

      {/* Rule Strip */}
      <div className="w-px h-5 bg-border" />
      <RuleStrip
        events={events}
        panelOpen={panelOpen}
        onTogglePanel={onTogglePanel}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Expand toggle (3-level cycle) */}
      <button
        onClick={onCycleExpand}
        className={cn(
          'p-1 rounded transition-colors',
          expandLevel > 0
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
        title={
          expandLevel === 0 ? '하단 표시' : expandLevel === 1 ? '하단 넓히기' : '하단 없음'
        }
      >
        <Rows size={14} weight={expandLevel === 2 ? 'bold' : expandLevel === 1 ? 'regular' : 'thin'} />
      </button>

      {/* Auto-follow toggle */}
      <button
        onClick={onToggleAutoFollow}
        className={cn(
          'p-1 rounded transition-colors',
          !isToday && 'opacity-30 pointer-events-none',
          autoFollow
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
        title={autoFollow ? '자동 추적 끄기' : '자동 추적 켜기'}
      >
        <Crosshair size={14} weight={autoFollow ? 'bold' : 'regular'} />
      </button>

      <div className="w-px h-5 bg-border" />

      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onZoomChange(zoomSec - SLIDER_STEP_SEC)}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <MagnifyingGlassPlus size={14} />
        </button>
        <input
          type="range"
          min={SLIDER_MIN_SEC}
          max={SLIDER_MAX_SEC}
          step={SLIDER_STEP_SEC}
          value={zoomSec}
          onChange={handleSlider}
          className="w-[100px] h-1 accent-primary cursor-pointer"
        />
        <button
          onClick={() => onZoomChange(zoomSec + SLIDER_STEP_SEC)}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <MagnifyingGlassMinus size={14} />
        </button>
      </div>
    </div>
  );
});
