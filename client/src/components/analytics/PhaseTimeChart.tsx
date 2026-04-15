import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { PhaseTimeItem } from '@/lib/api';

const PHASE_LABELS: Record<string, string> = {
  plan: 'Plan',
  explore: 'Explore',
  rule_check: 'Rule Check',
  implement: 'Implement',
  verify: 'Verify',
};

const PHASE_COLORS: Record<string, string> = {
  plan: '#818cf8',
  explore: '#38bdf8',
  rule_check: '#f59e0b',
  implement: '#34d399',
  verify: '#a78bfa',
};

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

interface Props {
  data: PhaseTimeItem[];
}

export function PhaseTimeChart({ data }: Props) {
  const filtered = data.filter((d) => d.percentage > 0);
  if (filtered.length === 0) return null;

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey="percentage"
            nameKey="phase"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={75}
            strokeWidth={1}
            stroke="var(--color-card)"
          >
            {filtered.map((d) => (
              <Cell key={d.phase} fill={PHASE_COLORS[d.phase] ?? '#6366f1'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: 12, padding: '6px 10px', borderRadius: 8,
              background: 'var(--color-card)', border: '1px solid var(--color-border)',
            }}
            formatter={(value: number, name: string) => [
              `${value}%`,
              PHASE_LABELS[name] ?? name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2">
        {filtered.map((d) => (
          <div key={d.phase} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: PHASE_COLORS[d.phase] ?? '#6366f1' }}
            />
            <span className="text-muted-foreground w-20">
              {PHASE_LABELS[d.phase] ?? d.phase}
            </span>
            <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${d.percentage}%`,
                  backgroundColor: PHASE_COLORS[d.phase] ?? '#6366f1',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
              {d.percentage}%
            </span>
            <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
              {formatTime(d.timeMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
