import type { TimelineItem, TimeSegment, CompressedTimeMap } from './types';
import {
  GAP_THRESHOLD_MS,
  COMPRESSED_GAP_PX,
  CLUSTER_PADDING_MS,
  MIN_BAR_WIDTH_PX,
} from './constants';

interface Cluster {
  startMs: number;
  endMs: number;
}

/**
 * Detect gaps between event clusters.
 * Events within CLUSTER_PADDING_MS of each other are merged into clusters.
 * Gaps between clusters that exceed GAP_THRESHOLD_MS are returned.
 */
export function detectGaps(
  items: TimelineItem[],
  rangeStart: number,
  rangeEnd: number,
): { clusters: Cluster[]; gaps: { startMs: number; endMs: number }[] } {
  if (items.length === 0) {
    return { clusters: [], gaps: [] };
  }

  // Sort by startMs
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);

  // Build clusters by merging overlapping/adjacent events
  const clusters: Cluster[] = [];
  let curStart = sorted[0].startMs - CLUSTER_PADDING_MS;
  let curEnd = sorted[0].endMs + CLUSTER_PADDING_MS;

  for (let i = 1; i < sorted.length; i++) {
    const itemStart = sorted[i].startMs - CLUSTER_PADDING_MS;
    const itemEnd = sorted[i].endMs + CLUSTER_PADDING_MS;

    if (itemStart <= curEnd) {
      // Overlaps or adjacent — extend cluster
      curEnd = Math.max(curEnd, itemEnd);
    } else {
      // New cluster
      clusters.push({ startMs: curStart, endMs: curEnd });
      curStart = itemStart;
      curEnd = itemEnd;
    }
  }
  clusters.push({ startMs: curStart, endMs: curEnd });

  // Clamp clusters to range
  clusters[0].startMs = Math.max(clusters[0].startMs, rangeStart);
  clusters[clusters.length - 1].endMs = Math.min(
    clusters[clusters.length - 1].endMs,
    rangeEnd,
  );

  // Find gaps between clusters that exceed threshold
  const gaps: { startMs: number; endMs: number }[] = [];

  // Gap before first cluster
  if (clusters[0].startMs - rangeStart > GAP_THRESHOLD_MS) {
    gaps.push({ startMs: rangeStart, endMs: clusters[0].startMs });
  }

  // Gaps between clusters
  for (let i = 0; i < clusters.length - 1; i++) {
    const gapStart = clusters[i].endMs;
    const gapEnd = clusters[i + 1].startMs;
    if (gapEnd - gapStart > GAP_THRESHOLD_MS) {
      gaps.push({ startMs: gapStart, endMs: gapEnd });
    }
  }

  // Gap after last cluster
  if (rangeEnd - clusters[clusters.length - 1].endMs > GAP_THRESHOLD_MS) {
    gaps.push({ startMs: clusters[clusters.length - 1].endMs, endMs: rangeEnd });
  }

  return { clusters, gaps };
}

/**
 * Build a CompressedTimeMap that compresses gap regions into fixed-width segments.
 * Active regions use normal ppm scaling, gap regions use COMPRESSED_GAP_PX.
 *
 * If no gaps are detected, returns a linear pass-through map.
 */
export function buildCompressedTimeMap(
  items: TimelineItem[],
  rangeStart: number,
  rangeEnd: number,
  ppm: number,
): CompressedTimeMap {
  const { gaps } = detectGaps(items, rangeStart, rangeEnd);

  // No gaps → linear pass-through
  if (gaps.length === 0) {
    const totalWidth = Math.max(MIN_BAR_WIDTH_PX, ((rangeEnd - rangeStart) / 60_000) * ppm);
    return {
      segments: [{
        startMs: rangeStart,
        endMs: rangeEnd,
        isGap: false,
        pxOffset: 0,
        pxWidth: totalWidth,
      }],
      msToX: (ms: number) => ((ms - rangeStart) / 60_000) * ppm,
      xToMs: (x: number) => rangeStart + (x / ppm) * 60_000,
      durationToWidth: (_startMs: number, durationMs: number) =>
        Math.max(MIN_BAR_WIDTH_PX, (durationMs / 60_000) * ppm),
      totalWidth,
    };
  }

  // Build segments alternating between active and gap
  const segments: TimeSegment[] = [];
  let cursor = rangeStart;
  let pxOffset = 0;

  for (const gap of gaps) {
    // Active segment before gap
    if (gap.startMs > cursor) {
      const durationMs = gap.startMs - cursor;
      const pxWidth = (durationMs / 60_000) * ppm;
      segments.push({
        startMs: cursor,
        endMs: gap.startMs,
        isGap: false,
        pxOffset,
        pxWidth,
      });
      pxOffset += pxWidth;
    }

    // Gap segment
    segments.push({
      startMs: gap.startMs,
      endMs: gap.endMs,
      isGap: true,
      pxOffset,
      pxWidth: COMPRESSED_GAP_PX,
    });
    pxOffset += COMPRESSED_GAP_PX;

    cursor = gap.endMs;
  }

  // Trailing active segment
  if (cursor < rangeEnd) {
    const durationMs = rangeEnd - cursor;
    const pxWidth = (durationMs / 60_000) * ppm;
    segments.push({
      startMs: cursor,
      endMs: rangeEnd,
      isGap: false,
      pxOffset,
      pxWidth,
    });
    pxOffset += pxWidth;
  }

  const totalWidth = pxOffset;

  // Binary search for the segment containing a given ms value
  function findSegment(ms: number): TimeSegment {
    let lo = 0;
    let hi = segments.length - 1;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (segments[mid].endMs <= ms) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    return segments[lo];
  }

  function msToX(ms: number): number {
    // Clamp to range
    if (ms <= rangeStart) return 0;
    if (ms >= rangeEnd) return totalWidth;

    const seg = findSegment(ms);

    if (seg.isGap) {
      // Interpolate within gap (compressed)
      const frac = (ms - seg.startMs) / (seg.endMs - seg.startMs);
      return seg.pxOffset + frac * seg.pxWidth;
    }

    // Active segment: linear scale
    const offsetMs = ms - seg.startMs;
    return seg.pxOffset + (offsetMs / 60_000) * ppm;
  }

  function xToMs(x: number): number {
    if (x <= 0) return rangeStart;
    if (x >= totalWidth) return rangeEnd;

    // Find segment by pixel offset
    let seg = segments[0];
    for (let i = 0; i < segments.length; i++) {
      if (x < segments[i].pxOffset + segments[i].pxWidth) {
        seg = segments[i];
        break;
      }
    }

    const offsetPx = x - seg.pxOffset;

    if (seg.isGap) {
      const frac = offsetPx / seg.pxWidth;
      return seg.startMs + frac * (seg.endMs - seg.startMs);
    }

    // Active: reverse linear scale
    return seg.startMs + (offsetPx / ppm) * 60_000;
  }

  function durationToWidth(startMs: number, durationMs: number): number {
    return Math.max(MIN_BAR_WIDTH_PX, msToX(startMs + durationMs) - msToX(startMs));
  }

  return { segments, msToX, xToMs, durationToWidth, totalWidth };
}

/**
 * Format a gap duration as a human-readable string.
 * e.g., "⋯ 2h 15m", "⋯ 45m", "⋯ 3m"
 */
export function formatGapDuration(durationMs: number): string {
  const totalMin = Math.round(durationMs / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  if (hours > 0 && minutes > 0) return `⋯ ${hours}h ${minutes}m`;
  if (hours > 0) return `⋯ ${hours}h`;
  return `⋯ ${minutes}m`;
}
