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
  const maskId = `bar-mask-${item.id}`;
  const truncated = item.truncated && !item.isInstant && item.width >= 40;

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
      {truncated && (() => {
        const cx = item.x + item.width - 28;
        const ty = item.y - 2;
        const by = item.y + BAR_HEIGHT + 2;
        const amp = 3;
        const segments = 3;
        const step = (by - ty) / segments;
        const buildWavy = (offsetX: number) => {
          let d = `M${cx + offsetX},${ty}`;
          for (let i = 0; i < segments; i++) {
            const cy1 = ty + step * i + step / 2;
            const dir = i % 2 === 0 ? 1 : -1;
            d += ` Q${cx + offsetX + amp * dir},${cy1} ${cx + offsetX},${ty + step * (i + 1)}`;
          }
          return d;
        };
        // Shape between the two wavy lines (gap region)
        const leftWavy = buildWavy(-2.5);
        let rightWavyReverse = `M${cx + 2.5},${by}`;
        for (let i = segments - 1; i >= 0; i--) {
          const cy1 = ty + step * i + step / 2;
          const dir = i % 2 === 0 ? 1 : -1;
          rightWavyReverse += ` Q${cx + 2.5 + amp * dir},${cy1} ${cx + 2.5},${ty + step * i}`;
        }
        const gapPath = leftWavy + ` L${cx + 2.5},${by}` + rightWavyReverse.slice(rightWavyReverse.indexOf(' ')) + ' Z';
        return (
          <mask id={maskId}>
            <rect x={item.x - 1} y={item.y - 1} width={item.width + 2} height={BAR_HEIGHT + 2} fill="white" />
            <path d={gapPath} fill="black" />
          </mask>
        );
      })()}
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
        mask={truncated ? `url(#${maskId})` : undefined}
      />
      {truncated && (() => {
        const cx = item.x + item.width - 28;
        const ty = item.y - 2;
        const by = item.y + BAR_HEIGHT + 2;
        const amp = 3;
        const segments = 3;
        const step = (by - ty) / segments;
        const buildWavy = (offsetX: number) => {
          let d = `M${cx + offsetX},${ty}`;
          for (let i = 0; i < segments; i++) {
            const cy1 = ty + step * i + step / 2;
            const dir = i % 2 === 0 ? 1 : -1;
            d += ` Q${cx + offsetX + amp * dir},${cy1} ${cx + offsetX},${ty + step * (i + 1)}`;
          }
          return d;
        };
        return (
          <>
            <path d={buildWavy(-2.5)} fill="none" stroke={colors.stroke} strokeWidth={1.2} strokeOpacity={0.4} />
            <path d={buildWavy(2.5)} fill="none" stroke={colors.stroke} strokeWidth={1.2} strokeOpacity={0.4} />
          </>
        );
      })()}
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
