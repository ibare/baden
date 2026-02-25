import { memo, useEffect, useState } from 'react';
import type { CompressedTimeMap } from './lib/types';

interface TimelineNowLineProps {
  timeMap: CompressedTimeMap;
  rangeStart: number;
  totalHeight: number;
  isToday: boolean;
}

export const TimelineNowLine = memo(function TimelineNowLine({
  timeMap,
  rangeStart,
  totalHeight,
  isToday,
}: TimelineNowLineProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isToday]);

  if (!isToday) return null;
  if (now < rangeStart) return null;

  const x = timeMap.msToX(now);

  return (
    <g>
      {/* Vertical line */}
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={totalHeight}
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeOpacity={0.6}
      />
      {/* Triangle marker at top */}
      <polygon
        points={`${x - 4},0 ${x + 4},0 ${x},6`}
        fill="#ef4444"
      />
    </g>
  );
});
