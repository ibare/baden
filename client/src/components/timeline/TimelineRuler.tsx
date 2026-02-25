import { memo } from 'react';
import type { Tick } from './lib/types';
import { LABEL_WIDTH, TIME_AXIS_HEIGHT } from './lib/constants';

interface TimelineRulerProps {
  ticks: Tick[];
  totalWidth: number;
  scrollLeft: number;
}

export const TimelineRuler = memo(function TimelineRuler({
  ticks,
  totalWidth,
  scrollLeft,
}: TimelineRulerProps) {
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
          {ticks.map((tick) => (
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
          ))}
        </svg>
      </div>
    </div>
  );
});
