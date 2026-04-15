import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { BehaviorFlowItem } from '@/lib/api';

const PHASE_LABELS: Record<string, string> = {
  receive: 'Receive',
  plan: 'Plan',
  explore: 'Explore',
  rule_check: 'Rule Check',
  implement: 'Implement',
  verify: 'Verify',
  complete: 'Complete',
};

const PHASE_COLORS: Record<string, string> = {
  receive: '#94a3b8',
  plan: '#818cf8',
  explore: '#38bdf8',
  rule_check: '#f59e0b',
  implement: '#34d399',
  verify: '#a78bfa',
  complete: '#6366f1',
};

interface Props {
  data: BehaviorFlowItem[];
}

export function BehaviorFlowChart({ data }: Props) {
  const chartData = data
    .filter((d) => d.totalEvents > 0)
    .map((d) => ({
      phase: PHASE_LABELS[d.phase] ?? d.phase,
      avgPerTask: d.avgPerTask,
      total: d.totalEvents,
      fill: PHASE_COLORS[d.phase] ?? '#6366f1',
    }));

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
        <YAxis
          type="category"
          dataKey="phase"
          tick={{ fontSize: 11 }}
          stroke="var(--color-muted-foreground)"
          width={80}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12, padding: '8px 12px', borderRadius: 8,
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}
          formatter={(value: number, _name: string, props: { payload: { total: number } }) => [
            `${value} avg/task (${props.payload.total} total)`,
          ]}
        />
        <Bar dataKey="avgPerTask" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
