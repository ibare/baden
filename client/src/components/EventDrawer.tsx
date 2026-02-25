import { useCallback, useRef } from 'react';
import type { RuleEvent, Rule } from '@/lib/api';
import { EventDetail } from '@/components/EventDetail';
import { cn } from '@/lib/utils';
import { X, PushPin, PushPinSlash } from '@phosphor-icons/react';

interface EventDrawerProps {
  isOpen: boolean;
  event: RuleEvent | null;
  rule: Rule | null;
  pinned: boolean;
  pinnedWidth: number;
  onClose: () => void;
  onTogglePin: () => void;
  onWidthChange: (width: number) => void;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;

export function EventDrawer({
  isOpen,
  event,
  rule,
  pinned,
  pinnedWidth,
  onClose,
  onTogglePin,
  onWidthChange,
}: EventDrawerProps) {
  const isDragging = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startWidth = pinnedWidth;

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = startX - ev.clientX;
        onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
      };
      const onUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [pinnedWidth, onWidthChange],
  );

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold text-foreground">상세 정보</h3>
      <div className="flex items-center gap-1">
        <button
          onClick={onTogglePin}
          className={cn(
            'p-1 rounded-md transition-colors',
            pinned
              ? 'text-foreground bg-muted/60 hover:bg-muted'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
          title={pinned ? '고정 해제' : '사이드바 고정'}
        >
          {pinned ? <PushPinSlash size={14} /> : <PushPin size={14} />}
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );

  const content = (
    <div className="overflow-y-auto h-[calc(100%-49px)]">
      <EventDetail event={event} rule={rule} />
    </div>
  );

  // Pinned: in-flow sidebar
  if (pinned) {
    if (!isOpen) return null;
    return (
      <div
        className="relative flex-shrink-0 h-full bg-card border-l border-border flex flex-col"
        style={{ width: pinnedWidth }}
      >
        {/* Resize handle */}
        <div
          className="absolute inset-y-0 left-0 w-0 z-10"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute inset-y-0 -left-[3px] w-[6px] cursor-col-resize hover:bg-primary/20 transition-colors" />
        </div>

        {header}
        {content}
      </div>
    );
  }

  // Unpinned: overlay drawer
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />
      )}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-96 bg-card border-l border-border shadow-xl',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {header}
        {content}
      </div>
    </>
  );
}
