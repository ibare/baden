import { memo } from 'react';
import type { EventCategory } from '@/lib/event-types';
import { CATEGORY_CONFIG } from '@/lib/event-types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { CATEGORY_ORDER } from './lib/constants';
import { CATEGORY_BUTTON_CLASSES } from './lib/colors';

interface TimelineFilterBarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  isToday: boolean;
  activeCategories: Set<EventCategory>;
  onToggleCategory: (cat: EventCategory) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export const TimelineFilterBar = memo(function TimelineFilterBar({
  selectedDate,
  onDateChange,
  isToday,
  activeCategories,
  onToggleCategory,
  search,
  onSearchChange,
}: TimelineFilterBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border flex-shrink-0">
      {/* Date navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span
          className={cn(
            'text-sm font-mono px-2 py-0.5 rounded min-w-[7rem] text-center',
            isToday && 'text-primary',
          )}
        >
          {formatDateDisplay(selectedDate)}
        </span>
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, 1))}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
        {isToday && <span className="text-xs text-primary ml-1">LIVE</span>}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Category toggles */}
      <div className="flex items-center gap-1">
        {CATEGORY_ORDER.map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const colors = CATEGORY_BUTTON_CLASSES[cat];
          const isActive = activeCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggleCategory(cat)}
              className={cn(
                'px-2 py-0.5 text-xs rounded-full border transition-colors',
                isActive
                  ? `${colors.bg} ${colors.text} border-transparent`
                  : 'text-muted-foreground border-border hover:border-muted-foreground/50',
              )}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 text-xs pl-7"
        />
      </div>
    </div>
  );
});
