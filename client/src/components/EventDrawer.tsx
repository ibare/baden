import type { RuleEvent, Rule } from '@/lib/api';
import { EventDetail } from '@/components/EventDetail';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface EventDrawerProps {
  isOpen: boolean;
  event: RuleEvent | null;
  rule: Rule | null;
  onClose: () => void;
}

export function EventDrawer({ isOpen, event, rule, onClose }: EventDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-96 bg-card border-l border-border shadow-xl',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">상세 정보</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-49px)]">
          <EventDetail event={event} rule={rule} />
        </div>
      </div>
    </>
  );
}
