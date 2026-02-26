import { memo, useState, useCallback } from 'react';
import type { PlacedItem } from './lib/types';
import type { ExpandLevel } from './lib/constants';
import { BAR_HEIGHT, DETAIL_HEIGHTS, ICON_MIN_WIDTH_PX, TEXT_MIN_WIDTH_PX } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';
import { EVENT_TYPE_ICONS, USER_ICON } from './lib/event-icons';
import { PHOSPHOR_ICON_MAP } from './lib/icon-map';

interface TimelineBarProps {
  item: PlacedItem;
  expandLevel: ExpandLevel;
  onClick: (item: PlacedItem) => void;
  onHover: (item: PlacedItem | null) => void;
}

const ICON_SIZE = 14;

export const TimelineBar = memo(function TimelineBar({
  item,
  expandLevel,
  onClick,
  onHover,
}: TimelineBarProps) {
  const [hovered, setHovered] = useState(false);
  const colors = CATEGORY_COLORS[item.category];
  const clipId = `bar-clip-${item.id}`;
  const maskId = `bar-mask-${item.id}`;
  const truncated = item.truncated && !item.isInstant && item.width >= 40;
  const hasPrompt = !!item.event.prompt;

  const showIcon = item.width >= ICON_MIN_WIDTH_PX;
  const showDetail = item.width >= TEXT_MIN_WIDTH_PX;   // 50px: detail visible
  const showLabel = item.width >= 90;                    // 90px: label also visible
  const needClip = showIcon;

  const IconComponent = hasPrompt
    ? USER_ICON
    : (item.resolvedIcon && PHOSPHOR_ICON_MAP[item.resolvedIcon])
      || EVENT_TYPE_ICONS[item.event.type];

  const label = item.resolvedLabel || item.event.action || item.event.type.replace(/_/g, ' ');
  const detailText = item.resolvedDetail || '';

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

  const showAnyText = showLabel || showDetail;

  // Icon position
  const iconX = showAnyText ? item.x + 4 : item.x + (item.width - ICON_SIZE) / 2;
  const iconY = item.y + (BAR_HEIGHT - ICON_SIZE) / 2;

  // Text offset (after icon)
  const textX = showIcon ? item.x + 4 + ICON_SIZE + 3 : item.x + 4;

  const detailH = DETAIL_HEIGHTS[expandLevel];

  // Detail info text (for expanded mode)
  const infoText = (() => {
    if (expandLevel === 0) return '';

    const isJson = (s: string | null | undefined) => s != null && s.trimStart().startsWith('{');
    const file = item.event.file?.split('/').pop() ?? null;
    const summary = item.event.summary && !isJson(item.event.summary) ? item.event.summary : null;
    const rawAction = item.event.action;
    const message = (item.event.message && item.event.message !== rawAction && !isJson(item.event.message))
      ? item.event.message : null;
    const detail = (item.event.detail && !isJson(item.event.detail)) ? item.event.detail : null;

    // Pick the best context text: summary > message > detail
    const context = summary ?? message ?? detail ?? null;

    return [file, context].filter(Boolean).join(' · ');
  })();

  const clipHeight = BAR_HEIGHT + detailH;

  return (
    <g
      data-timeline-item
      className="cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {needClip && (
        <clipPath id={clipId}>
          <rect x={item.x} y={item.y} width={item.width} height={clipHeight} rx={3} />
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
      {/* Main bar */}
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={BAR_HEIGHT}
        rx={3}
        fill={hasPrompt ? '#fff' : hovered ? colors.fillHover : colors.fill}
        fillOpacity={hasPrompt ? 1 : 0.75}
        stroke={hasPrompt ? colors.fill : hovered ? colors.stroke : 'none'}
        strokeWidth={hasPrompt ? 1.5 : hovered ? 1 : 0}
        strokeDasharray={hasPrompt ? '4 2' : undefined}
        mask={truncated ? `url(#${maskId})` : undefined}
      />
      {/* Prompt: top accent line */}
      {hasPrompt && (
        <line
          x1={item.x + 3}
          y1={item.y}
          x2={item.x + item.width - 3}
          y2={item.y}
          stroke={colors.fill}
          strokeWidth={3}
          strokeLinecap="round"
        />
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
        return (
          <>
            <path d={buildWavy(-2.5)} fill="none" stroke={colors.stroke} strokeWidth={1.2} strokeOpacity={0.4} />
            <path d={buildWavy(2.5)} fill="none" stroke={colors.stroke} strokeWidth={1.2} strokeOpacity={0.4} />
          </>
        );
      })()}
      {/* Icon via foreignObject */}
      {showIcon && IconComponent && (
        <foreignObject
          x={iconX}
          y={iconY}
          width={ICON_SIZE}
          height={ICON_SIZE}
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: 'none' }}
        >
          <IconComponent size={ICON_SIZE} weight="bold" color={colors.text} />
        </foreignObject>
      )}
      {/* Text: disappear order — label first, then detail, then icon */}
      {showAnyText && (
        <text
          x={textX}
          y={item.y + BAR_HEIGHT / 2}
          dominantBaseline="central"
          fontSize={10}
          fill={colors.text}
          fontWeight={500}
          clipPath={`url(#${clipId})`}
          style={{ userSelect: 'none' }}
        >
          {showLabel && label}
          {showDetail && detailText && (
            <tspan fillOpacity={showLabel ? 0.5 : 0.8} fontWeight={400} fontSize={9}>
              {showLabel ? ' ' : ''}{detailText}
            </tspan>
          )}
          {showDetail && !detailText && !showLabel && label}
        </text>
      )}
      {/* Expanded: detail area */}
      {expandLevel > 0 && (
        <>
          <rect
            x={item.x}
            y={item.y + BAR_HEIGHT}
            width={item.width}
            height={detailH}
            fill={colors.detailBg}
            clipPath={`url(#${clipId})`}
          />
          {infoText && (
            <foreignObject
              x={item.x}
              y={item.y + BAR_HEIGHT}
              width={item.width}
              height={detailH}
              clipPath={`url(#${clipId})`}
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  width: item.width,
                  height: detailH,
                  padding: '2px 4px',
                  fontSize: 9,
                  lineHeight: '1.3',
                  color: colors.detailText,
                  userSelect: 'none',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: expandLevel === 2 ? 2 : 1,
                  WebkitBoxOrient: 'vertical',
                  textOverflow: 'ellipsis',
                  overflowWrap: 'break-word',
                  boxSizing: 'border-box',
                }}
              >
                {infoText}
              </div>
            </foreignObject>
          )}
        </>
      )}
    </g>
  );
});
