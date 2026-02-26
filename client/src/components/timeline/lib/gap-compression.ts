import type { TimelineItem, TimeSegment, CompressedTimeMap, SegmentType } from './types';
import {
  GAP_THRESHOLD_MS,
  COMPRESSED_GAP_PX,
  COMPRESSED_EVENT_GAP_PX,
  EVENT_HEAD_TAIL_RATIO,
  CLUSTER_PADDING_MS,
  MIN_BAR_WIDTH_PX,
} from './constants';

interface Cluster {
  startMs: number;
  endMs: number;
}

/** A compressed region — either a gap (empty time) or event_gap (long event middle) */
interface CompressedRegion {
  startMs: number;
  endMs: number;
  type: 'gap' | 'event_gap';
  pxWidth: number;
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
 * Detect events whose rendered width exceeds the viewport and that don't
 * overlap with any other events. Returns the middle region to compress.
 */
export function detectLongEvents(
  items: TimelineItem[],
  ppm: number,
  viewportWidth: number,
): { itemId: string; headEndMs: number; tailStartMs: number }[] {
  if (viewportWidth <= 0 || ppm <= 0) return [];

  const results: { itemId: string; headEndMs: number; tailStartMs: number }[] = [];
  const headTailMs = (EVENT_HEAD_TAIL_RATIO * viewportWidth / ppm) * 60_000;

  for (const item of items) {
    const durationMs = item.endMs - item.startMs;
    const renderedWidth = (durationMs / 60_000) * ppm;

    // Only compress events wider than viewport
    if (renderedWidth <= viewportWidth) continue;

    // Check if any other event overlaps with this one's time range
    const hasOverlap = items.some(
      (other) =>
        other.id !== item.id &&
        other.startMs < item.endMs &&
        other.endMs > item.startMs,
    );
    if (hasOverlap) continue;

    const headEndMs = item.startMs + headTailMs;
    const tailStartMs = item.endMs - headTailMs;

    // Skip if head and tail overlap (event only slightly wider than viewport)
    if (headEndMs >= tailStartMs) continue;

    results.push({ itemId: item.id, headEndMs, tailStartMs });
  }

  return results;
}

/**
 * Build a CompressedTimeMap that compresses gap regions and long event
 * middle regions into fixed-width segments.
 * Active regions use normal ppm scaling, compressed regions use fixed px.
 *
 * If no compressed regions exist, returns a linear pass-through map.
 */
export function buildCompressedTimeMap(
  items: TimelineItem[],
  rangeStart: number,
  rangeEnd: number,
  ppm: number,
  viewportWidth: number = 0,
): CompressedTimeMap {
  const { gaps } = detectGaps(items, rangeStart, rangeEnd);
  const longEvents = detectLongEvents(items, ppm, viewportWidth);

  // Build unified compressed regions
  const regions: CompressedRegion[] = [];

  for (const gap of gaps) {
    regions.push({
      startMs: gap.startMs,
      endMs: gap.endMs,
      type: 'gap',
      pxWidth: COMPRESSED_GAP_PX,
    });
  }

  for (const le of longEvents) {
    regions.push({
      startMs: le.headEndMs,
      endMs: le.tailStartMs,
      type: 'event_gap',
      pxWidth: COMPRESSED_EVENT_GAP_PX,
    });
  }

  // Sort by startMs; on overlap, earlier region wins
  regions.sort((a, b) => a.startMs - b.startMs);

  // Remove overlapping regions (earlier one wins)
  const filtered: CompressedRegion[] = [];
  for (const r of regions) {
    if (filtered.length === 0) {
      filtered.push(r);
    } else {
      const prev = filtered[filtered.length - 1];
      if (r.startMs >= prev.endMs) {
        filtered.push(r);
      }
      // else: overlap, skip this region
    }
  }

  // No compressed regions → linear pass-through
  if (filtered.length === 0) {
    const totalWidth = Math.max(MIN_BAR_WIDTH_PX, ((rangeEnd - rangeStart) / 60_000) * ppm);
    return {
      segments: [{
        startMs: rangeStart,
        endMs: rangeEnd,
        type: 'active',
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

  // Build segments alternating between active and compressed
  const segments: TimeSegment[] = [];
  let cursor = rangeStart;
  let pxOffset = 0;

  for (const region of filtered) {
    // Active segment before compressed region
    if (region.startMs > cursor) {
      const durationMs = region.startMs - cursor;
      const pxWidth = (durationMs / 60_000) * ppm;
      segments.push({
        startMs: cursor,
        endMs: region.startMs,
        type: 'active',
        pxOffset,
        pxWidth,
      });
      pxOffset += pxWidth;
    }

    // Compressed segment
    segments.push({
      startMs: region.startMs,
      endMs: region.endMs,
      type: region.type,
      pxOffset,
      pxWidth: region.pxWidth,
    });
    pxOffset += region.pxWidth;

    cursor = region.endMs;
  }

  // Trailing active segment
  if (cursor < rangeEnd) {
    const durationMs = rangeEnd - cursor;
    const pxWidth = (durationMs / 60_000) * ppm;
    segments.push({
      startMs: cursor,
      endMs: rangeEnd,
      type: 'active',
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

    if (seg.type !== 'active') {
      // Interpolate within compressed region
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

    if (seg.type !== 'active') {
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
 * e.g., "2h 15m", "45m", "3m"
 */
export function formatGapDuration(durationMs: number): string {
  const totalMin = Math.round(durationMs / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Format an event gap duration with a "~" prefix.
 * e.g., "~2h 15m", "~45m", "~3m"
 */
export function formatEventGapDuration(durationMs: number): string {
  return `~${formatGapDuration(durationMs)}`;
}
