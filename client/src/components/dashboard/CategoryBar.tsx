import { CATEGORY_CONFIG, type EventCategory } from '@/lib/event-types';

interface CategoryBarProps {
  distribution: { category: string; count: number }[];
}

const TAILWIND_BG: Record<string, string> = {
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  rose: 'bg-rose-500',
};

export function CategoryBar({ distribution }: CategoryBarProps) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        {distribution.map((d) => {
          const cfg = CATEGORY_CONFIG[d.category as EventCategory];
          if (!cfg) return null;
          const pct = (d.count / total) * 100;
          return (
            <div
              key={d.category}
              className={`${TAILWIND_BG[cfg.color] ?? 'bg-muted-foreground'}`}
              style={{ width: `${pct}%` }}
              title={`${cfg.label}: ${d.count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {distribution.map((d) => {
          const cfg = CATEGORY_CONFIG[d.category as EventCategory];
          if (!cfg) return null;
          return (
            <span key={d.category} className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${TAILWIND_BG[cfg.color] ?? 'bg-muted-foreground'}`} />
              {cfg.label} {d.count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
