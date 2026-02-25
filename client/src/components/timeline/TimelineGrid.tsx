import { memo } from 'react';
import type { Tick, LaneInfo, TimeSegment } from './lib/types';

interface TimelineGridProps {
  ticks: Tick[];
  lanes: LaneInfo[];
  totalHeight: number;
  segments: TimeSegment[];
}

export const TimelineGrid = memo(function TimelineGrid({
  ticks,
  lanes,
  totalHeight,
  segments,
}: TimelineGridProps) {
  const gapSegments = segments.filter((s) => s.isGap);

  return (
    <g className="timeline-grid">
      {/* Hatching pattern definition */}
      <defs>
        <pattern
          id="gap-hatch"
          width={6}
          height={6}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={6}
            stroke="currentColor"
            strokeOpacity={0.10}
            strokeWidth={7}
          />
        </pattern>
      </defs>

      {/* Grid lines — skip gap ticks */}
      {ticks.map((tick) =>
        tick.isGap ? null : (
          <line
            key={tick.ms}
            x1={tick.x}
            y1={0}
            x2={tick.x}
            y2={totalHeight}
            stroke="currentColor"
            strokeOpacity={tick.isMajor ? 0.12 : 0.05}
            strokeWidth={1}
          />
        ),
      )}

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

      {/* Gap overlays: solid tint + hatching */}
      {gapSegments.map((seg) => (
        <g key={`gap-${seg.startMs}`}>
          {/* Semi-transparent background */}
          <rect
            x={seg.pxOffset}
            y={0}
            width={seg.pxWidth}
            height={totalHeight}
            fill="currentColor"
            fillOpacity={0.04}
          />
          {/* Hatching pattern */}
          <rect
            x={seg.pxOffset}
            y={0}
            width={seg.pxWidth}
            height={totalHeight}
            fill="url(#gap-hatch)"
          />
        </g>
      ))}
    </g>
  );
});
