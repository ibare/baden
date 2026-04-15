import type { HotspotFile } from '@/lib/api';

interface Props {
  data: HotspotFile[];
}

export function HotspotFiles({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No hotspot files found.</p>;
  }

  const maxViolations = Math.max(...data.map((d) => d.totalViolations));

  return (
    <div className="space-y-2">
      {data.map((file) => (
        <div key={file.file} className="text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs truncate flex-1 min-w-0">{file.file}</span>
            <span className="text-red-600 font-medium tabular-nums flex-shrink-0">
              {file.totalViolations}
            </span>
          </div>
          <div className="flex gap-1 mt-1">
            <div
              className="h-1.5 rounded-full bg-red-500/60"
              style={{ width: `${(file.totalViolations / maxViolations) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(file.rules).map(([rule, count]) => (
              <span key={rule} className="text-[10px] text-muted-foreground">
                {rule}({count})
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
