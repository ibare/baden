import { memo, useState, useCallback } from 'react';
import type { PlacedItem } from './lib/types';
import { BAR_HEIGHT, MARKER_SIZE } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';

interface TimelineMarkerProps {
  item: PlacedItem;
  onClick: (item: PlacedItem) => void;
  onHover: (item: PlacedItem | null, e?: React.MouseEvent) => void;
}

export const TimelineMarker = memo(function TimelineMarker({
  item,
  onClick,
  onHover,
}: TimelineMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const colors = CATEGORY_COLORS[item.category];
  const cx = item.x + MARKER_SIZE / 2;
  const cy = item.y + BAR_HEIGHT / 2;
  const half = MARKER_SIZE / 2;

  const points = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      setHovered(true);
      onHover(item, e);
    },
    [item, onHover],
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    onHover(null);
  }, [onHover]);

  const handleClick = useCallback(() => {
    onClick(item);
  }, [item, onClick]);

  return (
    <polygon
      data-timeline-item
      points={points}
      fill={hovered ? colors.fillHover : colors.fill}
      stroke={hovered ? colors.stroke : colors.fill}
      strokeWidth={1.5}
      className="cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  );
});
