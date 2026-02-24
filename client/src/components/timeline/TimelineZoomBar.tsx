import { memo, useCallback } from 'react';
import {
  SLIDER_MIN_SEC,
  SLIDER_MAX_SEC,
  SLIDER_STEP_SEC,
} from './lib/constants';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface TimelineZoomBarProps {
  zoomSec: number;
  onZoomChange: (sec: number) => void;
}

export const TimelineZoomBar = memo(function TimelineZoomBar({
  zoomSec,
  onZoomChange,
}: TimelineZoomBarProps) {
  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onZoomChange(parseFloat(e.target.value));
    },
    [onZoomChange],
  );

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border flex-shrink-0">
      <button
        onClick={() => onZoomChange(zoomSec - SLIDER_STEP_SEC)}
        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <ZoomIn className="size-3.5" />
      </button>

      <input
        type="range"
        min={SLIDER_MIN_SEC}
        max={SLIDER_MAX_SEC}
        step={SLIDER_STEP_SEC}
        value={zoomSec}
        onChange={handleSlider}
        className="flex-1 max-w-[100px] h-1 accent-primary cursor-pointer"
      />

      <button
        onClick={() => onZoomChange(zoomSec + SLIDER_STEP_SEC)}
        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <ZoomOut className="size-3.5" />
      </button>
    </div>
  );
});
