import { memo, useState, useCallback } from 'react';
import type { PlacedItem } from './lib/types';
import { BAR_HEIGHT, MARKER_SIZE } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';
import greenFlagUrl from '@/assets/green-flag.svg';
import summaryUrl from '@/assets/summary.svg';
import violationUrl from '@/assets/violation.svg';
import passUrl from '@/assets/pass.svg';
import checkUrl from '@/assets/check.svg';

const FLAG_SIZE = 32;
const SUMMARY_SIZE = 32;
const VIOLATION_SIZE = 32;
const PASS_SIZE = 32;
const CHECK_SIZE = 32;

interface TimelineMarkerProps {
  item: PlacedItem;
  selected?: boolean;
  onClick: (item: PlacedItem) => void;
  onHover: (item: PlacedItem | null) => void;
}

export const TimelineMarker = memo(function TimelineMarker({
  item,
  selected,
  onClick,
  onHover,
}: TimelineMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const colors = CATEGORY_COLORS[item.category];
  const cx = item.x + MARKER_SIZE / 2;
  const cy = item.y + BAR_HEIGHT / 2;
  const half = MARKER_SIZE / 2;

  const handleMouseEnter = useCallback(
    () => {
      setHovered(true);
      onHover(item);
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

  const fillColor = hovered ? colors.fillHover : colors.fill;
  const strokeColor = (selected || hovered) ? colors.stroke : colors.fill;
  const strokeW = (selected || hovered) ? 2 : 1.5;

  const common = {
    'data-timeline-item': true,
    className: 'cursor-pointer' as const,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick,
  };

  // receive_task → green flag icon
  if (item.event.action === 'receive_task') {
    const aspect = 124 / 268; // original SVG aspect ratio
    const h = FLAG_SIZE;
    const w = h * aspect;
    // Pole is at ~11% from left in the SVG; align pole to event start x
    const poleRatio = 13.77 / 124;
    const flagX = item.x - w * poleRatio;
    const flagY = cy - h / 2;
    return (
      <g {...common}>
        <image
          href={greenFlagUrl}
          x={flagX}
          y={flagY}
          width={w}
          height={h}
          opacity={(selected || hovered) ? 1 : 0.85}
        />
        {(selected || hovered) && (
          <rect
            x={flagX - 2}
            y={flagY - 2}
            width={w + 4}
            height={h + 4}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            rx={3}
            opacity={0.6}
          />
        )}
      </g>
    );
  }

  // task_complete → summary icon
  if (item.event.action === 'task_complete') {
    const aspect = 179 / 326; // original SVG aspect ratio
    const h = SUMMARY_SIZE;
    const w = h * aspect;
    const imgX = item.x - w * 0.1;
    const imgY = cy - h / 2;
    return (
      <g {...common}>
        <image
          href={summaryUrl}
          x={imgX}
          y={imgY}
          width={w}
          height={h}
          opacity={(selected || hovered) ? 1 : 0.85}
        />
        {(selected || hovered) && (
          <rect
            x={imgX - 2}
            y={imgY - 2}
            width={w + 4}
            height={h + 4}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            rx={3}
            opacity={0.6}
          />
        )}
      </g>
    );
  }

  // violation_found → violation icon
  if (item.event.action === 'violation_found' || item.event.action === 'rule_violation') {
    const aspect = 141 / 170; // original SVG aspect ratio
    const h = VIOLATION_SIZE;
    const w = h * aspect;
    const imgX = item.x - w * 0.1;
    const imgY = cy - h / 2;
    return (
      <g {...common}>
        <image
          href={violationUrl}
          x={imgX}
          y={imgY}
          width={w}
          height={h}
          opacity={(selected || hovered) ? 1 : 0.85}
        />
        {(selected || hovered) && (
          <rect
            x={imgX - 2}
            y={imgY - 2}
            width={w + 4}
            height={h + 4}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            rx={3}
            opacity={0.6}
          />
        )}
      </g>
    );
  }

  // rule_pass → pass icon
  if (item.event.action === 'rule_pass') {
    const aspect = 41 / 64;
    const h = PASS_SIZE;
    const w = h * aspect;
    const imgX = item.x - w * 0.1;
    const imgY = cy - h / 2;
    return (
      <g {...common}>
        <image
          href={passUrl}
          x={imgX}
          y={imgY}
          width={w}
          height={h}
          opacity={(selected || hovered) ? 1 : 0.85}
        />
        {(selected || hovered) && (
          <rect
            x={imgX - 2}
            y={imgY - 2}
            width={w + 4}
            height={h + 4}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            rx={3}
            opacity={0.6}
          />
        )}
      </g>
    );
  }

  // check_rule → check icon
  if (item.event.action === 'check_rule') {
    const aspect = 41 / 64;
    const h = CHECK_SIZE;
    const w = h * aspect;
    const imgX = item.x - w * 0.1;
    const imgY = cy - h / 2;
    return (
      <g {...common}>
        <image
          href={checkUrl}
          x={imgX}
          y={imgY}
          width={w}
          height={h}
          opacity={(selected || hovered) ? 1 : 0.85}
        />
        {(selected || hovered) && (
          <rect
            x={imgX - 2}
            y={imgY - 2}
            width={w + 4}
            height={h + 4}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            rx={3}
            opacity={0.6}
          />
        )}
      </g>
    );
  }

  // Default: diamond
  const points = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;

  return (
    <polygon
      {...common}
      points={points}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={strokeW}
    />
  );
});
