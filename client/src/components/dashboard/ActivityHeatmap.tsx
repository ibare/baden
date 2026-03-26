import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ProjectInsight } from '@/lib/api';

type Range = '30d' | 'all';

const CELL_SIZE = 14;
const CELL_GAP = 2;

interface ActivityHeatmapProps {
  projects: ProjectInsight[];
  firstEventAt: string | null;
}

interface CellData {
  key: string;
  date: string;   // YYYY-MM-DD (full)
  count: number;
}

interface MonthSpan {
  label: string;  // "Mar", "Apr", ...
  colStart: number;
  colSpan: number;
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonth(dateStr: string): string {
  const m = parseInt(dateStr.slice(5, 7), 10) - 1;
  return MONTH_NAMES[m];
}

function getDay(dateStr: string): number {
  return parseInt(dateStr.slice(8, 10), 10);
}

function intensityClass(count: number, max: number): string {
  if (count === 0 || max === 0) return 'bg-muted/40';
  const ratio = count / max;
  if (ratio <= 0.15) return 'bg-indigo-200 dark:bg-indigo-900/60';
  if (ratio <= 0.35) return 'bg-indigo-300 dark:bg-indigo-700/70';
  if (ratio <= 0.60) return 'bg-indigo-400 dark:bg-indigo-600/80';
  return 'bg-indigo-500 dark:bg-indigo-500';
}

/** Compute month spans from an array of YYYY-MM-DD date strings */
function computeMonthSpans(dates: string[]): MonthSpan[] {
  if (dates.length === 0) return [];
  const spans: MonthSpan[] = [];
  let currentMonth = dates[0].slice(0, 7);
  let start = 0;

  for (let i = 1; i <= dates.length; i++) {
    const month = i < dates.length ? dates[i].slice(0, 7) : null;
    if (month !== currentMonth) {
      spans.push({
        label: getMonth(dates[start]),
        colStart: start,
        colSpan: i - start,
      });
      if (i < dates.length) {
        currentMonth = month!;
        start = i;
      }
    }
  }
  return spans;
}

/** Pick day labels — show first day of each month + every ~7th day, avoiding clutter */
function pickDayLabels(dates: string[], step: number): Set<number> {
  const show = new Set<number>();
  let lastShown = -step;
  for (let i = 0; i < dates.length; i++) {
    const day = getDay(dates[i]);
    const isFirstOfMonth = day === 1;
    if (isFirstOfMonth || i - lastShown >= step) {
      show.add(i);
      lastShown = i;
    }
  }
  return show;
}

export function ActivityHeatmap({ projects }: ActivityHeatmapProps) {
  const [range, setRange] = useState<Range>('30d');
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; project: string; date: string; count: number;
  } | null>(null);

  const { dates, projectRows, globalMax, monthSpans, dayLabelIndices } = useMemo(() => {
    let allDates: string[];
    let rows: CellData[][];
    let max = 0;

    if (range === '30d') {
      allDates = dateRange(daysAgoStr(29), todayStr());
      rows = projects.map((p) => {
        const countMap = new Map(p.dailyTrend.map((d) => [d.date, d.count]));
        return allDates.map((date) => {
          const count = countMap.get(date) ?? 0;
          if (count > max) max = count;
          return { key: date, date, count };
        });
      });
    } else {
      // All time — weekly: use week_start dates
      const allWeeks = new Set<string>();
      const weekToDate = new Map<string, string>();
      for (const p of projects) {
        for (const w of p.weeklyTrend) {
          allWeeks.add(w.week);
          weekToDate.set(w.week, w.date);
        }
      }
      const sorted = [...allWeeks].sort();
      allDates = sorted.map((w) => weekToDate.get(w) ?? w);

      rows = projects.map((p) => {
        const countMap = new Map(p.weeklyTrend.map((w) => [w.week, w.count]));
        return sorted.map((week, i) => {
          const count = countMap.get(week) ?? 0;
          if (count > max) max = count;
          return { key: week, date: allDates[i], count };
        });
      });
    }

    const spans = computeMonthSpans(allDates);
    const step = range === '30d' ? 7 : Math.max(1, Math.ceil(allDates.length / 12));
    const labels = pickDayLabels(allDates, step);

    return { dates: allDates, projectRows: rows, globalMax: max, monthSpans: spans, dayLabelIndices: labels };
  }, [projects, range]);

  const unit = CELL_SIZE + CELL_GAP;
  const labelColWidth = 80;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(['30d', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                range === r
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {r === '30d' ? 'Last 30 days' : 'All time'}
            </button>
          ))}
          {range === 'all' && (
            <span className="text-[11px] text-muted-foreground ml-1">(weekly)</span>
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          <span className="w-3 h-3 rounded-sm bg-muted/40" />
          <span className="w-3 h-3 rounded-sm bg-indigo-200 dark:bg-indigo-900/60" />
          <span className="w-3 h-3 rounded-sm bg-indigo-300 dark:bg-indigo-700/70" />
          <span className="w-3 h-3 rounded-sm bg-indigo-400 dark:bg-indigo-600/80" />
          <span className="w-3 h-3 rounded-sm bg-indigo-500 dark:bg-indigo-500" />
          <span>More</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto relative">
        <div style={{ paddingLeft: labelColWidth }}>
          {/* Month row */}
          <div className="flex" style={{ height: 16 }}>
            {monthSpans.map((span, i) => (
              <div
                key={i}
                className="text-[11px] font-medium text-muted-foreground overflow-hidden"
                style={{
                  position: 'absolute',
                  left: labelColWidth + span.colStart * unit,
                  width: span.colSpan * unit - CELL_GAP,
                }}
              >
                {span.colSpan >= 2 ? span.label : ''}
              </div>
            ))}
          </div>

          {/* Day row */}
          <div className="flex" style={{ height: 14 }}>
            {dates.map((date, i) => (
              <div
                key={i}
                className="text-[10px] text-muted-foreground/60 text-center"
                style={{ width: unit, minWidth: unit }}
              >
                {dayLabelIndices.has(i) ? getDay(date) : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="flex flex-col" style={{ gap: CELL_GAP }}>
          {projects.map((p, rowIdx) => (
            <div key={p.project.id} className="flex items-center">
              {/* Project name */}
              <div
                className="text-xs text-muted-foreground truncate text-right pr-2 flex-shrink-0"
                style={{ width: labelColWidth }}
                title={p.project.name}
              >
                {p.project.name}
              </div>

              {/* Cells */}
              <div className="flex" style={{ gap: CELL_GAP }}>
                {projectRows[rowIdx].map((cell) => (
                  <div
                    key={cell.key}
                    className={cn(
                      'rounded-sm cursor-default',
                      intensityClass(cell.count, globalMax),
                    )}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        project: p.project.name,
                        date: cell.date,
                        count: cell.count,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-md bg-popover border border-border text-xs shadow-md"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-medium">{tooltip.project}</div>
            <div className="text-muted-foreground">
              {tooltip.date}
              <span className="ml-2 text-foreground font-bold">{tooltip.count} events</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
