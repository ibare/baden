import { memo, useState, useCallback } from 'react';
import type { PlacedItem } from './lib/types';
import { BAR_HEIGHT, TEXT_MIN_WIDTH_PX } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';

interface TimelineBarProps {
  item: PlacedItem;
  onClick: (item: PlacedItem) => void;
  onHover: (item: PlacedItem | null, e?: React.MouseEvent) => void;
}

export const TimelineBar = memo(function TimelineBar({
  item,
  onClick,
  onHover,
}: TimelineBarProps) {
  const [hovered, setHovered] = useState(false);
  const colors = CATEGORY_COLORS[item.category];
  const clipId = `bar-clip-${item.id}`;

  const label =
    item.event.action || item.event.type.replace(/_/g, ' ');
  const fileName = item.event.file
    ? item.event.file.split('/').pop() || ''
    : '';
  const showText = item.width >= TEXT_MIN_WIDTH_PX;

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
    <g
      className="cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {showText && (
        <clipPath id={clipId}>
          <rect x={item.x} y={item.y} width={item.width} height={BAR_HEIGHT} rx={3} />
        </clipPath>
      )}
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={BAR_HEIGHT}
        rx={3}
        fill={hovered ? colors.fillHover : colors.fill}
        fillOpacity={0.75}
        stroke={hovered ? colors.stroke : 'none'}
        strokeWidth={hovered ? 1 : 0}
      />
      {showText && (
        <text
          x={item.x + 4}
          y={item.y + BAR_HEIGHT / 2}
          dominantBaseline="central"
          fontSize={10}
          fill={colors.text}
          fontWeight={500}
          clipPath={`url(#${clipId})`}
        >
          {label}
          {fileName && (
            <tspan fillOpacity={0.7} fontWeight={400}>
              {' '}
              {fileName}
            </tspan>
          )}
        </text>
      )}
    </g>
  );
});
