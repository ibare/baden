import type { RuleEvent } from '@/lib/api';
import type { EventCategory } from '@/lib/event-types';
import type { ResolvedAction } from '@/hooks/useActionRegistry';

/** Raw timeline item converted from RuleEvent */
export interface TimelineItem {
  id: string;
  event: RuleEvent;
  category: EventCategory;
  startMs: number;
  endMs: number;
  isInstant: boolean;
  /** Duration was capped at MAX_GAP — actual end time unknown */
  truncated: boolean;
  /** Icon name resolved from action registry */
  resolvedIcon?: string | null;
  /** Prefix label (e.g. "추가") */
  resolvedLabel?: string;
  /** Detail keyword (e.g. "[json]") */
  resolvedDetail?: string;
}

/** Item placed in a lane + sub-row with pixel coordinates */
export interface PlacedItem extends TimelineItem {
  lane: number;
  subRow: number;
  x: number;
  width: number;
  y: number;
}

/** Lane metadata */
export interface LaneInfo {
  category: EventCategory;
  label: string;
  subRowCount: number;
  y: number;
  height: number;
}

/** Connection between two events */
export interface Connection {
  from: PlacedItem;
  to: PlacedItem;
  type: 'rule_chain' | 'file_link' | 'task_chain';
}

/** Tick mark on the time axis */
export interface Tick {
  ms: number;
  label: string;
  x: number;
  /** Major ticks get labels, minor ticks only get grid lines */
  isMajor: boolean;
  /** True for gap separator ticks */
  isGap?: boolean;
}

/** A contiguous time segment (active or compressed gap) */
export interface TimeSegment {
  startMs: number;
  endMs: number;
  isGap: boolean;
  /** Pixel offset where this segment begins */
  pxOffset: number;
  /** Pixel width of this segment */
  pxWidth: number;
}

/** Compressed time map that handles gap compression */
export interface CompressedTimeMap {
  segments: TimeSegment[];
  msToX: (ms: number) => number;
  xToMs: (x: number) => number;
  durationToWidth: (startMs: number, durationMs: number) => number;
  totalWidth: number;
}

/** Timeline props — same interface as before */
export interface TimelineProps {
  events: RuleEvent[];
  allEvents: RuleEvent[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  eventDates: string[];
  activeCategories: Set<EventCategory>;
  onToggleCategory: (cat: EventCategory) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onSelectEvent: (event: RuleEvent) => void;
  resolveAction?: (action: string | null, type: string) => ResolvedAction;
}
