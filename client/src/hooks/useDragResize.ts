import { useState, useCallback, useRef, useEffect, type PointerEvent } from 'react';

const STORAGE_KEY = 'baden-rule-panel';
const MIN_W = 360;
const MIN_H = 280;
const DEFAULT_W = 400;
const DEFAULT_H = 480;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function loadRect(): Rect {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const r = JSON.parse(raw) as Rect;
      if (r.w >= MIN_W && r.h >= MIN_H) return r;
    }
  } catch { /* ignore */ }
  // Default: top-right corner
  return {
    x: Math.max(0, window.innerWidth - DEFAULT_W - 24),
    y: 80,
    w: DEFAULT_W,
    h: DEFAULT_H,
  };
}

function saveRect(r: Rect) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

function clampRect(r: Rect): Rect {
  const maxX = window.innerWidth - 100;
  const maxY = window.innerHeight - 100;
  return {
    x: Math.max(0, Math.min(r.x, maxX)),
    y: Math.max(0, Math.min(r.y, maxY)),
    w: Math.max(MIN_W, r.w),
    h: Math.max(MIN_H, r.h),
  };
}

export interface DragResizeState {
  rect: Rect;
  onDragStart: (e: PointerEvent<HTMLElement>) => void;
  onResizeStart: (e: PointerEvent<HTMLElement>) => void;
}

export function useDragResize(): DragResizeState {
  const [rect, setRect] = useState<Rect>(loadRect);
  const dragOrigin = useRef({ px: 0, py: 0, rx: 0, ry: 0 });
  const resizeOrigin = useRef({ px: 0, py: 0, rw: 0, rh: 0 });

  // Persist on change
  useEffect(() => { saveRect(rect); }, [rect]);

  const onDragStart = useCallback((e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    dragOrigin.current = { px: e.clientX, py: e.clientY, rx: rect.x, ry: rect.y };

    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - dragOrigin.current.px;
      const dy = ev.clientY - dragOrigin.current.py;
      setRect((prev) =>
        clampRect({ ...prev, x: dragOrigin.current.rx + dx, y: dragOrigin.current.ry + dy }),
      );
    };

    const onUp = () => {
      el.releasePointerCapture(e.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [rect.x, rect.y]);

  const onResizeStart = useCallback((e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    resizeOrigin.current = { px: e.clientX, py: e.clientY, rw: rect.w, rh: rect.h };

    const onMove = (ev: globalThis.PointerEvent) => {
      const dw = ev.clientX - resizeOrigin.current.px;
      const dh = ev.clientY - resizeOrigin.current.py;
      setRect((prev) =>
        clampRect({ ...prev, w: resizeOrigin.current.rw + dw, h: resizeOrigin.current.rh + dh }),
      );
    };

    const onUp = () => {
      el.releasePointerCapture(e.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [rect.w, rect.h]);

  return { rect, onDragStart, onResizeStart };
}
