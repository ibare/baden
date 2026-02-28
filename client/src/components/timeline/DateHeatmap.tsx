import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface DateHeatmapProps {
  eventDates: { date: string; count: number }[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

function getLast30Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getIntensity(count: number, max: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio <= 0.33) return 1;
  if (ratio <= 0.66) return 2;
  return 3;
}

function monthName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

function dayNum(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDate();
}

/** Returns a Map of index → month name, for the first occurrence of each month */
function getFirstMonthIndices(days: string[]): Map<number, string> {
  const seen = new Set<string>();
  const result = new Map<number, string>();
  for (let i = 0; i < days.length; i++) {
    const ym = days[i].slice(0, 7);
    if (!seen.has(ym)) {
      seen.add(ym);
      result.set(i, monthName(days[i]));
    }
  }
  return result;
}

const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3, string> = {
  0: 'bg-muted/40 border border-border/60',
  1: 'bg-primary/20',
  2: 'bg-primary/45',
  3: 'bg-primary/75',
};

export const DateHeatmap = memo(function DateHeatmap({
  eventDates,
  selectedDate,
  onDateChange,
}: DateHeatmapProps) {
  const days = useMemo(() => getLast30Days(), []);

  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const { date, count } of eventDates) {
      map.set(date, count);
    }
    return map;
  }, [eventDates]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const day of days) {
      const c = countMap.get(day) ?? 0;
      if (c > max) max = c;
    }
    return max;
  }, [days, countMap]);

  const monthMap = useMemo(() => getFirstMonthIndices(days), [days]);
  const selectedIdx = days.indexOf(selectedDate);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Top: month labels + selected day */}
      <div className="flex items-center gap-px relative h-2.5">
        {days.map((day, i) => {
          const isSelected = i === selectedIdx;
          const month = monthMap.get(i);
          // Selected on month-first → bold month only
          if (isSelected && month) {
            return (
              <div key={day} className="w-2 relative">
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] leading-none whitespace-nowrap text-foreground font-bold">
                  {month}
                </span>
              </div>
            );
          }
          if (isSelected) {
            return (
              <div key={day} className="w-2 relative">
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] leading-none whitespace-nowrap text-foreground font-bold">
                  {dayNum(day)}
                </span>
              </div>
            );
          }
          if (month) {
            return (
              <div key={day} className="w-2 relative">
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] leading-none whitespace-nowrap text-muted-foreground">
                  {month}
                </span>
              </div>
            );
          }
          return <div key={day} className="w-2" />;
        })}
      </div>

      {/* Cells */}
      <div className="flex items-center gap-px">
        {days.map((day) => {
          const count = countMap.get(day) ?? 0;
          const intensity = getIntensity(count, maxCount);
          const isSelected = day === selectedDate;

          return (
            <button
              key={day}
              onClick={() => onDateChange(day)}
              className={cn(
                'w-2 h-3 rounded-[2px] transition-all',
                INTENSITY_CLASSES[intensity],
                isSelected
                  ? 'ring-1 ring-primary ring-inset'
                  : 'hover:ring-1 hover:ring-muted-foreground/40',
              )}
            />
          );
        })}
      </div>

      {/* Bottom: day numbers every 7 days */}
      <div className="flex items-center gap-px relative h-2">
        {days.map((day, i) => {
          if (i % 7 !== 0) return <div key={day} className="w-2" />;
          return (
            <div key={day} className="w-2 relative">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] leading-none whitespace-nowrap text-muted-foreground">
                {dayNum(day)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
