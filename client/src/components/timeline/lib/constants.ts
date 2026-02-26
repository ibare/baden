import type { EventCategory } from '@/lib/event-types';

// Layout dimensions
export const LABEL_WIDTH = 72;
export const TIME_AXIS_HEIGHT = 28;
export const SUB_ROW_HEIGHT = 28;
export const BAR_HEIGHT = 22;
export type ExpandLevel = 0 | 1 | 2;
export const DETAIL_HEIGHTS = [0, 22, 44] as const;
export const LANE_GAP = 6;
export const MARKER_SIZE = 10;
export const MIN_BAR_WIDTH_PX = 4;
export const ICON_MIN_WIDTH_PX = 20;
export const TEXT_MIN_WIDTH_PX = 50;
export const INSTANT_THRESHOLD_MS = 5000;
export const MAX_SUB_ROWS = 8;

// Zoom — ruler-based: 1 ruler tick = zoomSeconds, pixel gap fixed
export const RULER_SPACING_PX = 80;
/** Slider min/max/step/default in seconds */
export const SLIDER_MIN_SEC = 1;
export const SLIDER_MAX_SEC = 60;
export const SLIDER_STEP_SEC = 1;
export const DEFAULT_ZOOM_SEC = 2;

// Duration inference
export const MAX_GAP_DURATION_MS = 5 * 60_000;
export const DEFAULT_LAST_DURATION_MS = 30_000;

// Gap compression
export const GAP_THRESHOLD_MS = 3 * 60_000;       // 3분 이상 빈 구간 → 압축
export const COMPRESSED_GAP_PX = 40;               // 압축 gap 폭
export const CLUSTER_PADDING_MS = 30_000;           // 클러스터 앞뒤 30초 여유

// Long event compression
export const COMPRESSED_EVENT_GAP_PX = 60;         // 긴 이벤트 압축 gap 폭
export const EVENT_HEAD_TAIL_RATIO = 0.35;         // 뷰포트의 35%를 head/tail로 유지

// Category ordering
export const CATEGORY_ORDER: EventCategory[] = [
  'user',
  'exploration',
  'planning',
  'implementation',
  'verification',
  'debugging',
  'rule_compliance',
];
