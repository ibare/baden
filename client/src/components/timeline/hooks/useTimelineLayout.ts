import { useMemo } from 'react';
import type { RuleEvent } from '@/lib/api';
import type { EventCategory } from '@/lib/event-types';
import { EVENT_CATEGORY_MAP } from '@/lib/event-types';
import type { TimelineItem, PlacedItem, LaneInfo } from '../lib/types';
import {
  INSTANT_THRESHOLD_MS,
  MAX_GAP_DURATION_MS,
  DEFAULT_LAST_DURATION_MS,
  LANE_GAP,
} from '../lib/constants';
import { computeLanes, placeItems, assignSubRows } from '../lib/algorithms';

interface LayoutResult {
  items: TimelineItem[];
  placed: PlacedItem[];
  lanes: LaneInfo[];
  rangeStart: number;
  rangeEnd: number;
  totalHeight: number;
  totalWidth: number;
}

export function useTimelineLayout(
  events: RuleEvent[],
  allEvents: RuleEvent[],
  selectedDate: string,
  activeCategories: Set<EventCategory>,
  ppm: number,
  viewportWidth: number,
): LayoutResult {
  // Stage 1: Convert RuleEvents → TimelineItems
  const items = useMemo((): TimelineItem[] => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return sorted.map((e, i) => {
      const cat = EVENT_CATEGORY_MAP[e.type] || 'exploration';
      const startMs = new Date(e.timestamp).getTime();
      let endMs: number;
      let truncated = false;

      if (e.duration_ms) {
        endMs = startMs + e.duration_ms;
      } else if (i < sorted.length - 1) {
        const nextStart = new Date(sorted[i + 1].timestamp).getTime();
        const gap = nextStart - startMs;
        if (gap > MAX_GAP_DURATION_MS) {
          endMs = startMs + MAX_GAP_DURATION_MS;
          truncated = true;
        } else {
          endMs = startMs + gap;
        }
      } else {
        endMs = startMs + DEFAULT_LAST_DURATION_MS;
        truncated = true;
      }

      const isInstant = endMs - startMs < INSTANT_THRESHOLD_MS;

      return { id: e.id, event: e, category: cat, startMs, endMs, isInstant, truncated };
    });
  }, [events]);

  // Stage 2: Compute time range — ensure it covers at least the viewport width
  const { rangeStart, rangeEnd } = useMemo(() => {
    // Minimum ms the viewport can display
    const viewportMs = ppm > 0 ? (viewportWidth / ppm) * 60_000 : 3600_000;

    if (allEvents.length === 0) {
      const base = new Date(selectedDate + 'T00:00:00').getTime();
      return { rangeStart: base + 8 * 3600_000, rangeEnd: base + 8 * 3600_000 + viewportMs };
    }

    let min = Infinity;
    let max = -Infinity;
    for (const e of allEvents) {
      const t = new Date(e.timestamp).getTime();
      if (t < min) min = t;
      if (t > max) max = t;
    }

    const span = max - min || 3600_000;
    const padding = span * 0.03;
    const start = min - padding;
    let end = max + padding + DEFAULT_LAST_DURATION_MS;

    // Always extend to at least current time (today) or end of day (past dates)
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate === today) {
      const nowWithPadding = Date.now() + 5 * 60_000;
      if (nowWithPadding > end) end = nowWithPadding;
    } else {
      const endOfDay = new Date(selectedDate + 'T23:59:59').getTime();
      if (endOfDay > end) end = endOfDay;
    }

    // Extend rangeEnd so the ruler fills at least the viewport
    if (end - start < viewportMs) {
      end = start + viewportMs;
    }

    return { rangeStart: start, rangeEnd: end };
  }, [allEvents, selectedDate, ppm, viewportWidth]);

  // Stage 3: Layout
  const { lanes, placed, totalHeight, totalWidth } = useMemo(() => {
    const byCategory = new Map<EventCategory, TimelineItem[]>();
    for (const item of items) {
      if (!activeCategories.has(item.category)) continue;
      if (!byCategory.has(item.category)) byCategory.set(item.category, []);
      byCategory.get(item.category)!.push(item);
    }

    const subRowCounts = new Map<EventCategory, number>();
    const eventCounts = new Map<EventCategory, number>();
    for (const [cat, catItems] of byCategory) {
      const results = assignSubRows(catItems, ppm);
      const maxRow = results.reduce((m, r) => Math.max(m, r.subRowCount), 1);
      subRowCounts.set(cat, maxRow);
      eventCounts.set(cat, catItems.length);
    }

    const lanes = computeLanes(activeCategories, subRowCounts, eventCounts);
    const filteredItems = items.filter((i) => activeCategories.has(i.category));
    const placed = placeItems(filteredItems, lanes, rangeStart, ppm);

    const lastLane = lanes[lanes.length - 1];
    const totalHeight = lastLane
      ? lastLane.y + lastLane.height + LANE_GAP
      : 100;

    const rangeMs = rangeEnd - rangeStart;
    const totalWidth = Math.max((rangeMs / 60000) * ppm, viewportWidth);

    return { lanes, placed, totalHeight, totalWidth };
  }, [items, activeCategories, ppm, rangeStart, rangeEnd, viewportWidth]);

  return { items, placed, lanes, rangeStart, rangeEnd, totalHeight, totalWidth };
}
