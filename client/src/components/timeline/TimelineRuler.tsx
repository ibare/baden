import { memo } from 'react';
import type { Tick, TimeSegment } from './lib/types';
import { LABEL_WIDTH, TIME_AXIS_HEIGHT } from './lib/constants';

interface TimelineRulerProps {
  ticks: Tick[];
  segments: TimeSegment[];
  totalWidth: number;
  scrollLeft: number;
}

export const TimelineRuler = memo(function TimelineRuler({
  ticks,
  segments,
  totalWidth,
  scrollLeft,
}: TimelineRulerProps) {
  const gapSegments = segments.filter((s) => s.isGap);

  return (
    <div className="flex flex-shrink-0 border-b border-border" style={{ height: TIME_AXIS_HEIGHT }}>
      {/* Spacer matching lane labels */}
      <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }} />
      {/* Scrollable ruler area */}
      <div className="flex-1 overflow-hidden">
        <svg
          width={totalWidth}
          height={TIME_AXIS_HEIGHT}
          className="text-muted-foreground"
          style={{ transform: `translateX(${-scrollLeft}px)` }}
        >
          {/* Gap background rects */}
          {gapSegments.map((seg) => (
            <rect
              key={`gap-bg-${seg.startMs}`}
              x={seg.pxOffset}
              y={0}
              width={seg.pxWidth}
              height={TIME_AXIS_HEIGHT}
              fill="currentColor"
              fillOpacity={0.06}
            />
          ))}

          {/* Ticks */}
          {ticks.map((tick) =>
            tick.isGap ? (
              <g key={`gap-${tick.ms}`}>
                <text
                  x={tick.x}
                  y={TIME_AXIS_HEIGHT / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="currentColor"
                  fillOpacity={0.5}
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight={600}
                  letterSpacing={0.5}
                >
                  {tick.label}
                </text>
              </g>
            ) : (
              <g key={tick.ms}>
                <line
                  x1={tick.x}
                  y1={TIME_AXIS_HEIGHT - 4}
                  x2={tick.x}
                  y2={TIME_AXIS_HEIGHT}
                  stroke="currentColor"
                  strokeOpacity={tick.isMajor ? 0.4 : 0.2}
                  strokeWidth={1}
                />
                <text
                  x={tick.x}
                  y={TIME_AXIS_HEIGHT - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={tick.isMajor ? 0.6 : 0.4}
                  fontSize={11}
                  fontFamily="monospace"
                  fontWeight={tick.isMajor ? 600 : 400}
                >
                  {tick.label}
                </text>
              </g>
            ),
          )}
        </svg>
      </div>
    </div>
  );
});
