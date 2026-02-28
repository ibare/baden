import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Crosshair, MagnifyingGlassPlus, MagnifyingGlassMinus, Rows } from '@phosphor-icons/react';
import type { RuleEvent } from '@/lib/api';
import type { ExpandLevel } from './lib/constants';
import { SLIDER_MIN_SEC, SLIDER_MAX_SEC, SLIDER_STEP_SEC } from './lib/constants';
import { RuleStrip } from './RuleStrip';
import { DateHeatmap } from './DateHeatmap';

interface TimelineFilterBarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  isToday: boolean;
  eventDates: { date: string; count: number }[];
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

export const TimelineFilterBar = memo(function TimelineFilterBar({
  selectedDate,
  onDateChange,
  isToday,
  eventDates,
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
      {/* Date heatmap */}
      <DateHeatmap
        eventDates={eventDates}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
      />

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
          expandLevel === 0 ? 'Show detail' : expandLevel === 1 ? 'Expand detail' : 'Hide detail'
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
        title={autoFollow ? 'Disable auto-follow' : 'Enable auto-follow'}
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
