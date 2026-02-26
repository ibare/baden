import type { TimelineItem, PlacedItem, Connection, LaneInfo, CompressedTimeMap } from './types';
import type { EventCategory } from '@/lib/event-types';
import type { ExpandLevel } from './constants';
import {
  SUB_ROW_HEIGHT,
  BAR_HEIGHT,
  DETAIL_HEIGHTS,
  LANE_GAP,
  MARKER_SIZE,
  MIN_BAR_WIDTH_PX,
  MAX_SUB_ROWS,
  CATEGORY_ORDER,
  RULER_SPACING_PX,
  LANE_PAD_TOP,
} from './constants';

/**
 * Greedy interval scheduling: assign each item to the lowest sub-row
 * where it doesn't overlap any existing item.
 */
export function assignSubRows(
  items: TimelineItem[],
  ppm: number,
  timeMap?: CompressedTimeMap,
): { subRow: number; subRowCount: number }[] {
  // Sort by startMs
  const sorted = items.map((item, i) => ({ item, index: i }));
  sorted.sort((a, b) => a.item.startMs - b.item.startMs);

  // Track end-px of each sub-row
  const subRowEnds: number[] = [];
  const results = new Array<number>(items.length);

  for (const { item, index } of sorted) {
    const startPx = timeMap
      ? timeMap.msToX(item.startMs)
      : msToX(item.startMs, 0, ppm);
    const endPx = item.isInstant
      ? startPx + MARKER_SIZE + 2
      : timeMap
        ? startPx + timeMap.durationToWidth(item.startMs, item.endMs - item.startMs)
        : startPx + Math.max(MIN_BAR_WIDTH_PX, ((item.endMs - item.startMs) / 60000) * ppm);

    let placed = false;
    for (let row = 0; row < subRowEnds.length && row < MAX_SUB_ROWS; row++) {
      const gap = item.isInstant ? 0 : RULER_SPACING_PX;
      if (subRowEnds[row] + gap <= startPx) {
        subRowEnds[row] = endPx;
        results[index] = row;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const row = Math.min(subRowEnds.length, MAX_SUB_ROWS - 1);
      if (row === subRowEnds.length) {
        subRowEnds.push(endPx);
      } else {
        subRowEnds[row] = Math.max(subRowEnds[row], endPx);
      }
      results[index] = row;
    }
  }

  const subRowCount = subRowEnds.length || 1;
  return results.map((subRow) => ({ subRow, subRowCount }));
}

/** Convert ms timestamp to x pixel position */
export function msToX(ms: number, rangeStart: number, ppm: number): number {
  return ((ms - rangeStart) / 60000) * ppm;
}

/** Convert ms duration to pixel width */
export function durationToWidth(durationMs: number, ppm: number): number {
  return Math.max(MIN_BAR_WIDTH_PX, (durationMs / 60000) * ppm);
}

/** Minimum lane height for lanes with very few events */
const MIN_LANE_HEIGHT = SUB_ROW_HEIGHT;

/**
 * Compute lane info: y position and height for each active category.
 * Lanes with more events get additional height even without sub-row overflow,
 * making dense lanes visually taller.
 */
export function computeLanes(
  activeCategories: Set<EventCategory>,
  subRowCounts: Map<EventCategory, number>,
  eventCounts?: Map<EventCategory, number>,
  expandLevel?: ExpandLevel,
): LaneInfo[] {
  const lanes: LaneInfo[] = [];
  let y = LANE_PAD_TOP;

  const categoryLabels: Record<EventCategory, string> = {
    user: '사용자',
    exploration: '탐색',
    planning: '계획',
    implementation: '구현',
    verification: '검증',
    debugging: '디버깅',
    rule_compliance: '규칙',
  };

  const detailH = DETAIL_HEIGHTS[expandLevel ?? 0];
  const rowUnit = SUB_ROW_HEIGHT + detailH;

  // Find max event count for proportional scaling
  let maxEvents = 1;
  if (eventCounts) {
    for (const cat of CATEGORY_ORDER) {
      if (!activeCategories.has(cat)) continue;
      maxEvents = Math.max(maxEvents, eventCounts.get(cat) || 0);
    }
  }

  for (const cat of CATEGORY_ORDER) {
    if (!activeCategories.has(cat)) continue;
    const subRows = subRowCounts.get(cat) || 1;
    const evtCount = eventCounts?.get(cat) || 0;

    // Base height from sub-rows
    const subRowHeight = subRows * rowUnit;

    // Density bonus: 0–2 extra sub-row heights proportional to event density
    let densityBonus = 0;
    if (eventCounts && maxEvents > 1 && evtCount > 2) {
      const density = evtCount / maxEvents; // 0..1
      densityBonus = Math.round(density * 2) * rowUnit;
    }

    const minLaneHeight = (expandLevel ?? 0) > 0 ? rowUnit : MIN_LANE_HEIGHT;
    const height = Math.max(minLaneHeight, subRowHeight + densityBonus);
    lanes.push({ category: cat, label: categoryLabels[cat], subRowCount: subRows, y, height });
    y += height + LANE_GAP;
  }

  return lanes;
}

/**
 * Place items into pixel coordinates.
 */
export function placeItems(
  items: TimelineItem[],
  lanes: LaneInfo[],
  rangeStart: number,
  ppm: number,
  timeMap?: CompressedTimeMap,
  expandLevel?: ExpandLevel,
): PlacedItem[] {
  const laneMap = new Map<EventCategory, number>();
  lanes.forEach((l, i) => laneMap.set(l.category, i));

  // Group by category for sub-row assignment
  const byCategory = new Map<EventCategory, TimelineItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  const placed: PlacedItem[] = [];

  for (const [cat, catItems] of byCategory) {
    const laneIdx = laneMap.get(cat);
    if (laneIdx === undefined) continue;
    const lane = lanes[laneIdx];

    const subRowResults = assignSubRows(catItems, ppm, timeMap);

    for (let i = 0; i < catItems.length; i++) {
      const item = catItems[i];
      const { subRow } = subRowResults[i];
      const x = timeMap
        ? timeMap.msToX(item.startMs)
        : msToX(item.startMs, rangeStart, ppm);
      const width = item.isInstant
        ? MARKER_SIZE
        : timeMap
          ? timeMap.durationToWidth(item.startMs, item.endMs - item.startMs)
          : durationToWidth(item.endMs - item.startMs, ppm);
      const detailH = DETAIL_HEIGHTS[expandLevel ?? 0];
      const rowUnit = SUB_ROW_HEIGHT + detailH;
      const itemHeight = BAR_HEIGHT + detailH;
      const y = lane.y + subRow * rowUnit + (rowUnit - itemHeight) / 2;

      placed.push({ ...item, lane: laneIdx, subRow, x, width, y });
    }
  }

  return placed;
}

/**
 * Build connections between events.
 * - Rule chain: same rule_id, ordered by time
 * - File link: same file, different category, within 10 minutes
 */
export function buildConnections(placed: PlacedItem[]): Connection[] {
  const connections: Connection[] = [];

  // Rule chain connections
  const byRule = new Map<string, PlacedItem[]>();
  for (const p of placed) {
    const ruleId = p.event.rule_id;
    if (!ruleId) continue;
    if (!byRule.has(ruleId)) byRule.set(ruleId, []);
    byRule.get(ruleId)!.push(p);
  }
  for (const items of byRule.values()) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < items.length - 1; i++) {
      connections.push({ from: items[i], to: items[i + 1], type: 'rule_chain' });
    }
  }

  // File link connections
  const byFile = new Map<string, PlacedItem[]>();
  for (const p of placed) {
    const file = p.event.file;
    if (!file) continue;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file)!.push(p);
  }
  const TEN_MIN = 10 * 60_000;
  for (const items of byFile.values()) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < items.length - 1; i++) {
      if (items[i].category === items[i + 1].category) continue;
      if (items[i + 1].startMs - items[i].endMs > TEN_MIN) continue;
      connections.push({ from: items[i], to: items[i + 1], type: 'file_link' });
    }
  }

  // Task chain connections: same task_id, ordered by time
  const byTask = new Map<string, PlacedItem[]>();
  for (const p of placed) {
    const taskId = p.event.task_id;
    if (!taskId) continue;
    if (!byTask.has(taskId)) byTask.set(taskId, []);
    byTask.get(taskId)!.push(p);
  }
  for (const items of byTask.values()) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < items.length - 1; i++) {
      connections.push({ from: items[i], to: items[i + 1], type: 'task_chain' });
    }
  }

  return connections;
}
