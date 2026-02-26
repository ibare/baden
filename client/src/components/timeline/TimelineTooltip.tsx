import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { PlacedItem } from './lib/types';
import { BAR_HEIGHT } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';
import { EVENT_TYPE_ICONS, USER_ICON } from './lib/event-icons';
import { PHOSPHOR_ICON_MAP } from './lib/icon-map';

interface TimelineTooltipProps {
  item: PlacedItem | null;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
}

function humanType(type: string): string {
  return type.replace(/_/g, ' ');
}

const SEVERITY_STYLES: Record<string, string> = {
  error: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};

const CARD_WIDTH = 380;
const CARD_GAP = 8;

export const TimelineTooltip = memo(function TimelineTooltip({
  item,
  scrollContainerRef,
}: TimelineTooltipProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showBelow, setShowBelow] = useState(false);

  // Measure card height after render, decide above vs below before paint
  useLayoutEffect(() => {
    if (!cardRef.current || !item || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardHeight = cardRef.current.offsetHeight;
    const spaceAbove = item.y - container.scrollTop;
    setShowBelow(spaceAbove < cardHeight + CARD_GAP);
  }, [item, scrollContainerRef]);

  if (!item || !scrollContainerRef.current) return null;

  const container = scrollContainerRef.current;
  const colors = CATEGORY_COLORS[item.category];
  const durationMs = item.endMs - item.startMs;
  const severity = item.event.severity;

  const rawAction = item.event.action;
  const prompt = item.event.prompt;
  const message = item.event.message;
  const detail = item.event.detail;
  const result = item.event.result;
  const summary = item.event.summary;
  const file = item.event.file;
  const line = item.event.line;
  const ruleId = item.event.rule_id;
  const hasPrompt = !!prompt;
  const IconComponent = hasPrompt
    ? USER_ICON
    : (item.resolvedIcon && PHOSPHOR_ICON_MAP[item.resolvedIcon])
      || EVENT_TYPE_ICONS[item.event.type];

  // Don't show action if it's the same as type (header already shows it)
  const action = rawAction && rawAction !== item.event.type ? rawAction : null;

  // Skip JSON blobs — not human-readable
  const isJson = (s: string | null) => s != null && s.trimStart().startsWith('{');
  const rawContext = message && message !== rawAction ? message : detail;
  const contextText = rawContext && !isJson(rawContext) ? rawContext : null;

  // Position in content coordinates (absolute inside scroll container)
  const barCenterX = item.x + item.width / 2;

  // Horizontal: clamp to visible viewport area
  const vpLeft = container.scrollLeft + 8;
  const vpRight = container.scrollLeft + container.clientWidth - CARD_WIDTH - 8;
  const left = Math.max(vpLeft, Math.min(barCenterX - CARD_WIDTH / 2, vpRight));

  // Vertical: above or below the bar
  const top = showBelow
    ? item.y + BAR_HEIGHT + CARD_GAP
    : item.y - CARD_GAP;

  return (
    <div
      ref={cardRef}
      className="absolute z-50 pointer-events-none"
      style={{
        left,
        top,
        width: CARD_WIDTH,
        transform: showBelow ? undefined : 'translateY(-100%)',
      }}
    >
      <div
        className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden text-xs"
        style={{ borderLeftWidth: 3, borderLeftColor: colors.fill }}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/50 bg-muted/30">
          {IconComponent && (
            <IconComponent size={14} weight="bold" color={colors.text} className="flex-shrink-0" />
          )}
          <span className="font-semibold text-foreground truncate">
            {item.resolvedLabel || humanType(item.event.type)}
          </span>
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            {hasPrompt && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                USER
              </span>
            )}
            {severity && severity !== 'info' && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.info}`}>
                {severity}
              </span>
            )}
            {!item.isInstant && durationMs > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">
                {formatDuration(durationMs)}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-2.5 py-2 space-y-1.5">
          {action && (
            <div className="font-medium text-foreground leading-snug">
              {action}
            </div>
          )}

          {prompt && (
            <div className="text-foreground leading-snug bg-blue-50 dark:bg-blue-950/30 rounded px-1.5 py-1 -mx-0.5">
              {prompt}
            </div>
          )}

          {(file || ruleId) && (
            <div className="flex flex-col gap-0.5">
              {file && (
                <div className="text-muted-foreground font-mono break-all">
                  {file}{line != null ? `:${line}` : ''}
                </div>
              )}
              {ruleId && (
                <div className="text-muted-foreground font-mono break-all">{ruleId}</div>
              )}
            </div>
          )}

          {contextText && (
            <div className="text-muted-foreground leading-snug">
              {contextText}
            </div>
          )}

          {summary && (
            <div className="text-muted-foreground leading-snug">
              {summary}
            </div>
          )}

          {result && (
            <div className="text-muted-foreground leading-snug">
              {result}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-2.5 py-1 border-t border-border/50 text-muted-foreground font-mono bg-muted/20">
          {formatTime(item.startMs)}
          {!item.isInstant && <span> — {formatTime(item.endMs)}</span>}
        </div>
      </div>
    </div>
  );
});
