import { memo, useCallback, useState, type WheelEvent, type PointerEvent } from 'react';
import type { ExpandLevel } from './lib/constants';
import type { PlacedItem, LaneInfo, Tick, Connection, CompressedTimeMap } from './lib/types';
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
  expandLevel: ExpandLevel;
  timeMap: CompressedTimeMap;
  onSelectItem: (item: PlacedItem) => void;
  onWheel: (e: WheelEvent<HTMLDivElement>) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  isDragging: boolean;
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
  isToday,
  expandLevel,
  timeMap,
  onSelectItem,
  onWheel,
  scrollContainerRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isDragging,
}: TimelineSVGProps) {
  const [hoveredItem, setHoveredItem] = useState<PlacedItem | null>(null);

  const handleHover = useCallback(
    (item: PlacedItem | null) => {
      setHoveredItem(item);
    },
    [],
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
      className={`flex-1 overflow-x-scroll overflow-y-auto relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <svg
        width={svgWidth}
        height={totalHeight}
        className="block"
      >
        <TimelineGrid
          ticks={ticks}
          lanes={lanes}
          totalHeight={totalHeight}
          segments={timeMap.segments}
        />
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
                expandLevel={expandLevel}
                onClick={handleClick}
                onHover={handleHover}
              />
            ),
          )}
        </g>
        <TimelineNowLine
          timeMap={timeMap}
          rangeStart={rangeStart}
          totalHeight={totalHeight}
          isToday={isToday}
        />
      </svg>
      {expandLevel === 0 && (
        <TimelineTooltip item={hoveredItem} scrollContainerRef={scrollContainerRef} />
      )}
    </div>
  );
});
