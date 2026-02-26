import { useMemo } from 'react';
import type { Tick, CompressedTimeMap } from '../lib/types';
import { formatGapDuration, formatEventGapDuration } from '../lib/gap-compression';

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

/** Minimum px distance between a normal tick and a compressed segment boundary */
const COMPRESSED_EDGE_MARGIN_PX = 35;

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

    // Collect compressed segment pixel ranges for proximity filtering
    const compressedRanges: { left: number; right: number }[] = [];
    for (const seg of timeMap.segments) {
      if (seg.type !== 'active') {
        compressedRanges.push({
          left: seg.pxOffset,
          right: seg.pxOffset + seg.pxWidth,
        });
      }
    }

    function tooCloseToCompressed(x: number): boolean {
      for (const g of compressedRanges) {
        if (x > g.left - COMPRESSED_EDGE_MARGIN_PX && x < g.right + COMPRESSED_EDGE_MARGIN_PX) return true;
      }
      return false;
    }

    for (const seg of timeMap.segments) {
      if (seg.type === 'gap') {
        // Gap segment: center tick with duration label
        const midX = seg.pxOffset + seg.pxWidth / 2;
        const durationMs = seg.endMs - seg.startMs;
        ticks.push({
          ms: seg.startMs + durationMs / 2,
          label: formatGapDuration(durationMs),
          x: midX,
          isMajor: false,
          segmentType: 'gap',
        });
      } else if (seg.type === 'event_gap') {
        // Event gap segment: center tick with "~Xm" label
        const midX = seg.pxOffset + seg.pxWidth / 2;
        const durationMs = seg.endMs - seg.startMs;
        ticks.push({
          ms: seg.startMs + durationMs / 2,
          label: formatEventGapDuration(durationMs),
          x: midX,
          isMajor: false,
          segmentType: 'event_gap',
        });
      } else {
        // Active segment: normal time ticks
        const firstTick = Math.ceil(seg.startMs / intervalMs) * intervalMs;
        let idx = 0;
        for (let ms = firstTick; ms <= seg.endMs; ms += intervalMs) {
          if (ms < rangeStart || ms > rangeEnd) continue;
          const x = timeMap.msToX(ms);
          // Skip ticks too close to compressed boundaries to prevent label overlap
          if (tooCloseToCompressed(x)) {
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
