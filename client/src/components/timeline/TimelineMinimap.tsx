import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { LaneInfo, PlacedItem, TimeSegment } from './lib/types';
import { CATEGORY_COLORS } from './lib/colors';

interface TimelineMinimapProps {
  placed: PlacedItem[];
  lanes: LaneInfo[];
  segments: TimeSegment[];
  totalWidth: number;
  totalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
  onNavigate: (scrollLeft: number, scrollTop: number) => void;
}

const MINIMAP_WIDTH = 300;
const MINIMAP_HEIGHT = 112;
const BIN_WIDTH_PX = 4;

export const TimelineMinimap = memo(function TimelineMinimap({
  placed,
  lanes,
  segments,
  totalWidth,
  totalHeight,
  viewportWidth,
  viewportHeight,
  scrollLeft,
  scrollTop,
  onNavigate,
}: TimelineMinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fixed minimap size — content scales to fit
  const scaleX = MINIMAP_WIDTH / totalWidth;
  const scaleY = MINIMAP_HEIGHT / totalHeight;

  // Viewport rect in minimap coords
  const vpX = scrollLeft * scaleX;
  const vpY = scrollTop * scaleY;
  const vpW = viewportWidth * scaleX;
  const vpH = viewportHeight * scaleY;

  const navigateFromEvent = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newScrollLeft = Math.max(0, x / scaleX - viewportWidth / 2);
      const newScrollTop = Math.max(0, y / scaleY - viewportHeight / 2);
      onNavigate(newScrollLeft, newScrollTop);
    },
    [scaleX, scaleY, viewportWidth, viewportHeight, onNavigate],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      setIsDragging(true);
      (e.target as SVGSVGElement).setPointerCapture?.(e.pointerId);
      navigateFromEvent(e);
    },
    [navigateFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDragging) return;
      navigateFromEvent(e);
    },
    [isDragging, navigateFromEvent],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Build density heatmap grid: X bins × lanes
  const heatmapCells = useMemo(() => {
    if (placed.length === 0 || lanes.length === 0) return [];

    const numBins = Math.max(1, Math.floor(MINIMAP_WIDTH / BIN_WIDTH_PX));
    const binScale = numBins / totalWidth; // items px → bin index

    // Count events per (bin, lane)
    const grid: number[][] = lanes.map(() => new Array(numBins).fill(0));
    for (const item of placed) {
      const bin = Math.min(Math.floor(item.x * binScale), numBins - 1);
      if (bin >= 0 && item.lane >= 0 && item.lane < lanes.length) {
        grid[item.lane][bin]++;
      }
    }

    // Find global max for normalization
    let maxCount = 0;
    for (const row of grid) {
      for (const c of row) {
        if (c > maxCount) maxCount = c;
      }
    }
    if (maxCount === 0) return [];

    // Build cell descriptors
    const cells: { x: number; y: number; w: number; h: number; color: string; opacity: number }[] = [];
    const sy = MINIMAP_HEIGHT / totalHeight;

    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li];
      const color = CATEGORY_COLORS[lane.category]?.fill ?? '#888';
      const cellY = lane.y * sy;
      const cellH = lane.height * sy;

      for (let bi = 0; bi < numBins; bi++) {
        const count = grid[li][bi];
        if (count === 0) continue;
        const ratio = count / maxCount;
        cells.push({
          x: bi * BIN_WIDTH_PX,
          y: cellY,
          w: BIN_WIDTH_PX,
          h: cellH,
          color,
          opacity: 0.1 + ratio * 0.7, // 0.1 ~ 0.8
        });
      }
    }
    return cells;
  }, [placed, lanes, totalWidth, totalHeight]);

  if (placed.length === 0) return null;

  const gapSegments = segments.filter((s) => s.type === 'gap');
  const eventGapSegments = segments.filter((s) => s.type === 'event_gap');

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        zIndex: 10,
      }}
      className="rounded border border-border shadow-lg bg-background/90 backdrop-blur-sm"
    >
      <svg
        ref={svgRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        className="block cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          {/* Gap hatching pattern */}
          <pattern
            id="minimap-gap-hatch"
            width={4}
            height={4}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1={0} y1={0} x2={0} y2={4}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          </pattern>
          {/* Event gap dot pattern */}
          <pattern
            id="minimap-event-gap-dots"
            width={4}
            height={4}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={2} cy={2} r={0.5} fill="currentColor" fillOpacity={0.1} />
          </pattern>
        </defs>

        {/* Gap regions */}
        {gapSegments.map((seg) => (
          <rect
            key={`gap-${seg.startMs}`}
            x={seg.pxOffset * scaleX}
            y={0}
            width={seg.pxWidth * scaleX}
            height={MINIMAP_HEIGHT}
            fill="url(#minimap-gap-hatch)"
          />
        ))}

        {/* Event gap regions */}
        {eventGapSegments.map((seg) => (
          <rect
            key={`egap-${seg.startMs}`}
            x={seg.pxOffset * scaleX}
            y={0}
            width={seg.pxWidth * scaleX}
            height={MINIMAP_HEIGHT}
            fill="url(#minimap-event-gap-dots)"
          />
        ))}

        {/* Density heatmap cells */}
        {heatmapCells.map((cell, i) => (
          <rect
            key={i}
            x={cell.x}
            y={cell.y}
            width={cell.w}
            height={cell.h}
            fill={cell.color}
            fillOpacity={cell.opacity}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          x={vpX}
          y={vpY}
          width={Math.min(vpW, MINIMAP_WIDTH - vpX)}
          height={Math.min(vpH, MINIMAP_HEIGHT - vpY)}
          fill="rgba(59,130,246,0.08)"
          stroke="rgba(59,130,246,0.6)"
          strokeWidth={1}
          rx={1}
        />
      </svg>
    </div>
  );
});
