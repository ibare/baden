import { memo } from 'react';
import type { Connection, PlacedItem } from './lib/types';
import { BAR_HEIGHT, MARKER_SIZE } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';

interface TimelineConnectionsProps {
  connections: Connection[];
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

/** Get bounding rect for a placed item (bars vs instant diamond markers) */
function getItemRect(item: PlacedItem): Rect {
  if (item.isInstant) {
    const cx = item.x + MARKER_SIZE / 2;
    const cy = item.y + BAR_HEIGHT / 2;
    const half = MARKER_SIZE / 2;
    return { left: cx - half, right: cx + half, top: cy - half, bottom: cy + half, cx, cy };
  }
  return {
    left: item.x,
    right: item.x + item.width,
    top: item.y,
    bottom: item.y + BAR_HEIGHT,
    cx: item.x + item.width / 2,
    cy: item.y + BAR_HEIGHT / 2,
  };
}

/**
 * Build connection path between two items.
 *
 * Routing rules:
 * - Entry: always target's LEFT CENTER
 * - Exit (bars):
 *   - Same height  → RIGHT CENTER (straight horizontal)
 *   - Target below → BOTTOM edge (cx or right-biased), downward
 *   - Target above → TOP edge (cx or right-biased), upward
 * - Exit (diamonds): top/bottom center
 * - Path: vertical → rounded corner → horizontal into target left center
 */
function buildConnectionPath(from: PlacedItem, to: PlacedItem): string {
  const fromRect = getItemRect(from);
  const toRect = getItemRect(to);

  // Entry: always left center of target
  const entry = { x: toRect.left, y: toRect.cy };

  // Vertical relationship
  const dy = toRect.cy - fromRect.cy;
  const sameLevel = Math.abs(dy) < BAR_HEIGHT / 2;

  // Same level → straight horizontal
  if (sameLevel) {
    return `M ${fromRect.right} ${fromRect.cy} L ${entry.x} ${entry.y}`;
  }

  // Determine exit point
  let exit: { x: number; y: number };

  if (from.isInstant) {
    // Diamond: top or bottom center
    exit = dy > 0
      ? { x: fromRect.cx, y: fromRect.bottom }
      : { x: fromRect.cx, y: fromRect.top };
  } else {
    // Bar: exit from BOTTOM edge (target below) or TOP edge (target above)
    // X position: right-biased (3/4 of bar width) for visual balance
    const exitX = fromRect.left + from.width * 0.85;
    exit = dy > 0
      ? { x: exitX, y: fromRect.bottom }
      : { x: exitX, y: fromRect.top };
  }

  // Build L-shape path: vertical → rounded corner → horizontal
  const horizontalGap = entry.x - exit.x;

  if (horizontalGap > 4) {
    const R = Math.max(2, Math.min(8, Math.abs(dy) / 2, horizontalGap / 2));
    const beforeTurnY = dy > 0 ? entry.y - R : entry.y + R;

    return [
      `M ${exit.x} ${exit.y}`,
      `L ${exit.x} ${beforeTurnY}`,
      `Q ${exit.x} ${entry.y}, ${exit.x + R} ${entry.y}`,
      `L ${entry.x} ${entry.y}`,
    ].join(' ');
  }

  // Overlap / leftward case: bezier that exits vertically and enters from the left
  const loopOffset = Math.max(16, Math.abs(horizontalGap) + 16);
  const midY = (exit.y + entry.y) / 2;

  return `M ${exit.x} ${exit.y} C ${exit.x} ${midY}, ${entry.x - loopOffset} ${entry.y}, ${entry.x} ${entry.y}`;
}

const ARROW_W = 7;
const ARROW_H = 5;

export const TimelineConnections = memo(function TimelineConnections({
  connections,
}: TimelineConnectionsProps) {
  if (connections.length === 0) return null;

  return (
    <g className="timeline-connections">
      <defs>
        <marker
          id="conn-arrow"
          markerWidth={ARROW_W}
          markerHeight={ARROW_H}
          refX={ARROW_W}
          refY={ARROW_H / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d={`M 0 0 L ${ARROW_W} ${ARROW_H / 2} L 0 ${ARROW_H} Z`}
            fill="currentColor"
          />
        </marker>
      </defs>
      {connections.map((conn, i) => {
        const d = buildConnectionPath(conn.from, conn.to);
        const color = CATEGORY_COLORS[conn.from.category].connector;
        const isTaskChain = conn.type === 'task_chain';
        const isRuleChain = conn.type === 'rule_chain';

        return (
          <path
            key={`${conn.from.id}-${conn.to.id}-${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={isTaskChain ? 0.5 : isRuleChain ? 0.4 : 0.3}
            strokeDasharray={isRuleChain || isTaskChain ? undefined : '4 3'}
            markerEnd="url(#conn-arrow)"
            style={{ color }}
          />
        );
      })}
    </g>
  );
});
