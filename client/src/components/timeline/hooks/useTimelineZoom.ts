import { useState, useCallback, useRef, type WheelEvent } from 'react';
import {
  RULER_SPACING_PX,
  SLIDER_MIN_SEC,
  SLIDER_MAX_SEC,
  SLIDER_STEP_SEC,
  DEFAULT_ZOOM_SEC,
} from '../lib/constants';

interface ZoomState {
  /** Seconds per ruler tick */
  zoomSec: number;
  setZoomSec: (s: number) => void;
  /** Pixels per minute */
  ppm: number;
  handleWheel: (e: WheelEvent<HTMLDivElement>) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function clamp(s: number): number {
  return Math.max(SLIDER_MIN_SEC, Math.min(SLIDER_MAX_SEC, s));
}

function snap(s: number): number {
  return Math.round(s / SLIDER_STEP_SEC) * SLIDER_STEP_SEC;
}

export function useTimelineZoom(): ZoomState {
  const [zoomSec, setRaw] = useState(DEFAULT_ZOOM_SEC);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 1 tick = zoomSec seconds = RULER_SPACING_PX pixels
  // ppm = RULER_SPACING_PX / (zoomSec / 60)
  const ppm = RULER_SPACING_PX / (zoomSec / 60);

  const setZoomSec = useCallback((s: number) => {
    setRaw(clamp(snap(s)));
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + container.scrollLeft;
        const oldPpm = RULER_SPACING_PX / (zoomSec / 60);

        const factor = e.deltaY < 0 ? 0.85 : 1.18;
        const newZoom = clamp(snap(zoomSec * factor));
        const newPpm = RULER_SPACING_PX / (newZoom / 60);

        const newMouseX = (mouseX / oldPpm) * newPpm;
        setRaw(newZoom);

        requestAnimationFrame(() => {
          if (container) {
            container.scrollLeft += newMouseX - mouseX;
          }
        });
        return;
      }

      if (e.shiftKey || (e.deltaX === 0 && e.deltaY !== 0)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    },
    [zoomSec],
  );

  return { zoomSec, setZoomSec, ppm, handleWheel, scrollContainerRef };
}
