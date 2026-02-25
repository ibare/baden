import { useMemo } from 'react';
import type { Tick, CompressedTimeMap } from '../lib/types';
import { formatGapDuration } from '../lib/gap-compression';

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

/** Minimum px distance between a normal tick and a gap boundary */
const GAP_EDGE_MARGIN_PX = 35;

export function useTimelineTicks(
  rangeStart: number,
  rangeEnd: number,
  ppm: number,
  zoomSec: number,
  timeMap: CompressedTimeMap,
): Tick[] {
  return useMemo(() => {
    const intervalMs = zoomSec * 1000;
    const ticks: Tick[] = [];

    // Collect gap pixel ranges for proximity filtering
    const gapRanges: { left: number; right: number }[] = [];
    for (const seg of timeMap.segments) {
      if (seg.isGap) {
        gapRanges.push({
          left: seg.pxOffset,
          right: seg.pxOffset + seg.pxWidth,
        });
      }
    }

    function tooCloseToGap(x: number): boolean {
      for (const g of gapRanges) {
        if (x > g.left - GAP_EDGE_MARGIN_PX && x < g.right + GAP_EDGE_MARGIN_PX) return true;
      }
      return false;
    }

    for (const seg of timeMap.segments) {
      if (seg.isGap) {
        const midX = seg.pxOffset + seg.pxWidth / 2;
        const durationMs = seg.endMs - seg.startMs;
        ticks.push({
          ms: seg.startMs + durationMs / 2,
          label: formatGapDuration(durationMs),
          x: midX,
          isMajor: false,
          isGap: true,
        });
      } else {
        const firstTick = Math.ceil(seg.startMs / intervalMs) * intervalMs;
        let idx = 0;
        for (let ms = firstTick; ms <= seg.endMs; ms += intervalMs) {
          if (ms < rangeStart || ms > rangeEnd) continue;
          const x = timeMap.msToX(ms);
          // Skip ticks too close to gap boundaries to prevent label overlap
          if (tooCloseToGap(x)) {
            idx++;
            continue;
          }
          ticks.push({
            ms,
            label: formatTickLabel(ms, zoomSec),
            x,
            isMajor: idx % 5 === 0,
          });
          idx++;
        }
      }
    }

    return ticks;
  }, [rangeStart, rangeEnd, ppm, zoomSec, timeMap]);
}
