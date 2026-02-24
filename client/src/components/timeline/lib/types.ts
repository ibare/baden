import type { RuleEvent } from '@/lib/api';
import type { EventCategory } from '@/lib/event-types';

/** Raw timeline item converted from RuleEvent */
export interface TimelineItem {
  id: string;
  event: RuleEvent;
  category: EventCategory;
  startMs: number;
  endMs: number;
  isInstant: boolean;
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
  type: 'rule_chain' | 'file_link';
}

/** Tick mark on the time axis */
export interface Tick {
  ms: number;
  label: string;
  x: number;
  /** Major ticks get labels, minor ticks only get grid lines */
  isMajor: boolean;
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
}
