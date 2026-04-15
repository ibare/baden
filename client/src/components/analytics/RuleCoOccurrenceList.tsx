import type { RuleCoOccurrence } from '@/lib/api';

interface Props {
  data: RuleCoOccurrence[];
}

export function RuleCoOccurrenceList({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No co-occurring violations found.</p>;
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-2">
      {data.map((pair, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="font-mono text-xs px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 rounded">
              {pair.ruleA}
            </span>
            <span className="text-muted-foreground text-xs">+</span>
            <span className="font-mono text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-600 rounded">
              {pair.ruleB}
            </span>
          </div>
          <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500/60 rounded-full"
              style={{ width: `${(pair.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 w-8 text-right">
            {pair.count}x
          </span>
        </div>
      ))}
    </div>
  );
}
