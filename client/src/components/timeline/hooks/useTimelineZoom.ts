import { useState, useCallback, useRef, type WheelEvent, type PointerEvent } from 'react';
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
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  isDragging: boolean;
}

function clamp(s: number): number {
  return Math.max(SLIDER_MIN_SEC, Math.min(SLIDER_MAX_SEC, s));
}

function snap(s: number): number {
  return Math.round(s / SLIDER_STEP_SEC) * SLIDER_STEP_SEC;
}

const ZOOM_STORAGE_KEY = 'baden-timeline-zoom-sec';

function loadZoom(): number {
  try {
    const v = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (v != null) {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return clamp(snap(n));
    }
  } catch { /* ignore */ }
  return DEFAULT_ZOOM_SEC;
}

export function useTimelineZoom(): ZoomState {
  const [zoomSec, setRaw] = useState(loadZoom);
  const [isDragging, setIsDragging] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0 });
  const inertiaRef = useRef(0);

  // 1 tick = zoomSec seconds = RULER_SPACING_PX pixels
  // ppm = RULER_SPACING_PX / (zoomSec / 60)
  const ppm = RULER_SPACING_PX / (zoomSec / 60);

  const setZoomSec = useCallback((s: number) => {
    const v = clamp(snap(s));
    setRaw(v);
    try { localStorage.setItem(ZOOM_STORAGE_KEY, String(v)); } catch { /* ignore */ }
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

      if (e.shiftKey) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    },
    [zoomSec],
  );

  const startInertia = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const FRICTION = 0.92;
    const MIN_VELOCITY = 0.5;
    let { vx, vy } = velocityRef.current;

    const step = () => {
      vx *= FRICTION;
      vy *= FRICTION;

      if (Math.abs(vx) < MIN_VELOCITY && Math.abs(vy) < MIN_VELOCITY) {
        inertiaRef.current = 0;
        return;
      }

      container.scrollLeft -= vx;
      container.scrollTop -= vy;
      inertiaRef.current = requestAnimationFrame(step);
    };

    inertiaRef.current = requestAnimationFrame(step);
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      // Don't start drag on timeline items (bars/markers)
      const target = e.target as Element;
      if (target.closest('[data-timeline-item]')) return;

      const container = scrollContainerRef.current;
      if (!container) return;

      // Cancel any ongoing inertia
      if (inertiaRef.current) {
        cancelAnimationFrame(inertiaRef.current);
        inertiaRef.current = 0;
      }

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      velocityRef.current = { vx: 0, vy: 0, lastX: e.clientX, lastY: e.clientY, lastTime: performance.now() };
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const now = performance.now();
      const dt = now - velocityRef.current.lastTime;
      if (dt > 0) {
        velocityRef.current.vx = (e.clientX - velocityRef.current.lastX) / dt * 16;
        velocityRef.current.vy = (e.clientY - velocityRef.current.lastY) / dt * 16;
        velocityRef.current.lastX = e.clientX;
        velocityRef.current.lastY = e.clientY;
        velocityRef.current.lastTime = now;
      }

      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      container.scrollLeft = dragRef.current.scrollLeft - dx;
      container.scrollTop = dragRef.current.scrollTop - dy;
    },
    [isDragging],
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    startInertia();
  }, [startInertia]);

  return {
    zoomSec, setZoomSec, ppm, handleWheel, scrollContainerRef,
    onPointerDown, onPointerMove, onPointerUp, isDragging,
  };
}
