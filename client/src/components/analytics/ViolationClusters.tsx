import type { ViolationCluster } from '@/lib/api';

interface Props {
  data: ViolationCluster[];
}

export function ViolationClusters({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No violation patterns found.</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((cluster, i) => (
        <div key={i} className="flex gap-3 text-sm">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-xs tabular-nums">
            {cluster.count}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-1.5 py-0.5 bg-muted/50 rounded">
                {cluster.rule}
              </span>
            </div>
            {cluster.examples.map((ex, j) => (
              <p key={j} className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {ex}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
