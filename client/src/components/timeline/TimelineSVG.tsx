import { memo, useCallback, useState, type WheelEvent } from 'react';
import type { PlacedItem, LaneInfo, Tick, Connection } from './lib/types';
import { TimelineGrid } from './TimelineGrid';
import { TimelineBar } from './TimelineBar';
import { TimelineMarker } from './TimelineMarker';
import { TimelineConnections } from './TimelineConnections';
import { TimelineNowLine } from './TimelineNowLine';
import { TimelineTooltip } from './TimelineTooltip';

interface TimelineSVGProps {
  placed: PlacedItem[];
  lanes: LaneInfo[];
  ticks: Tick[];
  connections: Connection[];
  totalWidth: number;
  totalHeight: number;
  viewportWidth: number;
  rangeStart: number;
  ppm: number;
  isToday: boolean;
  onSelectItem: (item: PlacedItem) => void;
  onWheel: (e: WheelEvent<HTMLDivElement>) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const TimelineSVG = memo(function TimelineSVG({
  placed,
  lanes,
  ticks,
  connections,
  totalWidth,
  totalHeight,
  viewportWidth,
  rangeStart,
  ppm,
  isToday,
  onSelectItem,
  onWheel,
  scrollContainerRef,
}: TimelineSVGProps) {
  const [hoveredItem, setHoveredItem] = useState<PlacedItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleHover = useCallback(
    (item: PlacedItem | null, e?: React.MouseEvent) => {
      setHoveredItem(item);
      if (e && item) {
        const container = scrollContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          setTooltipPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }
      } else {
        setTooltipPos(null);
      }
    },
    [scrollContainerRef],
  );

  const handleClick = useCallback(
    (item: PlacedItem) => {
      onSelectItem(item);
    },
    [onSelectItem],
  );

  const svgWidth = Math.max(totalWidth, viewportWidth);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-x-scroll overflow-y-auto relative"
      onWheel={onWheel}
    >
      <svg
        width={svgWidth}
        height={totalHeight}
        className="block"
      >
        <TimelineGrid ticks={ticks} lanes={lanes} totalHeight={totalHeight} />
        <TimelineConnections connections={connections} />
        <g className="timeline-items">
          {placed.map((item) =>
            item.isInstant ? (
              <TimelineMarker
                key={item.id}
                item={item}
                onClick={handleClick}
                onHover={handleHover}
              />
            ) : (
              <TimelineBar
                key={item.id}
                item={item}
                onClick={handleClick}
                onHover={handleHover}
              />
            ),
          )}
        </g>
        <TimelineNowLine
          rangeStart={rangeStart}
          ppm={ppm}
          totalHeight={totalHeight}
          isToday={isToday}
        />
      </svg>
      <TimelineTooltip item={hoveredItem} position={tooltipPos} />
    </div>
  );
});
