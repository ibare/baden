import { memo } from 'react';
import type { Tick, LaneInfo } from './lib/types';

interface TimelineGridProps {
  ticks: Tick[];
  lanes: LaneInfo[];
  totalHeight: number;
}

export const TimelineGrid = memo(function TimelineGrid({
  ticks,
  lanes,
  totalHeight,
}: TimelineGridProps) {
  return (
    <g className="timeline-grid">
      {ticks.map((tick) => (
        <g key={tick.ms}>
          {/* Grid line: major ticks stronger */}
          <line
            x1={tick.x}
            y1={0}
            x2={tick.x}
            y2={totalHeight}
            stroke="currentColor"
            strokeOpacity={tick.isMajor ? 0.12 : 0.05}
            strokeWidth={1}
          />
        </g>
      ))}
      {/* Lane backgrounds */}
      {lanes.map((lane) => (
        <rect
          key={lane.category}
          x={0}
          y={lane.y}
          width="100%"
          height={lane.height}
          fill="currentColor"
          fillOpacity={0.02}
          rx={3}
        />
      ))}
    </g>
  );
});
