import { memo, useCallback, useRef, useState } from 'react';
import type { PlacedItem, TimeSegment } from './lib/types';
import { BAR_HEIGHT } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';

interface TimelineMinimapProps {
  placed: PlacedItem[];
  segments: TimeSegment[];
  totalWidth: number;
  totalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
  onNavigate: (scrollLeft: number, scrollTop: number) => void;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 48;

export const TimelineMinimap = memo(function TimelineMinimap({
  placed,
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

  if (placed.length === 0) return null;

  const gapSegments = segments.filter((s) => s.isGap);

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
      className="rounded border border-border/60 shadow-md bg-background/80 backdrop-blur-sm"
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

        {/* Event items as colored rects */}
        {placed.map((item) => (
          <rect
            key={item.id}
            x={item.x * scaleX}
            y={item.y * scaleY}
            width={Math.max(1, item.width * scaleX)}
            height={Math.max(1, BAR_HEIGHT * scaleY)}
            fill={CATEGORY_COLORS[item.category]?.fill ?? '#888'}
            fillOpacity={0.7}
            rx={0.5}
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
