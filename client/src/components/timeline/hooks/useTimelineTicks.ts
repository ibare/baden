import { useMemo } from 'react';
import type { Tick } from '../lib/types';
import { msToX } from '../lib/algorithms';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatTickLabel(ms: number, zoomSec: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();

  if (zoomSec < 60) {
    return s !== 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
  }
  return `${pad(h)}:${pad(m)}`;
}

export function useTimelineTicks(
  rangeStart: number,
  rangeEnd: number,
  ppm: number,
  zoomSec: number,
): Tick[] {
  return useMemo(() => {
    const intervalMs = zoomSec * 1000;
    const firstTick = Math.ceil(rangeStart / intervalMs) * intervalMs;
    const ticks: Tick[] = [];

    let idx = 0;
    for (let ms = firstTick; ms <= rangeEnd; ms += intervalMs) {
      // Every 5th tick is "major" (stronger grid line), all ticks get labels
      ticks.push({
        ms,
        label: formatTickLabel(ms, zoomSec),
        x: msToX(ms, rangeStart, ppm),
        isMajor: idx % 5 === 0,
      });
      idx++;
    }

    return ticks;
  }, [rangeStart, rangeEnd, ppm, zoomSec]);
}
