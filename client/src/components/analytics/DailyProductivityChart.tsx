import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { DailyProductivityItem } from '@/lib/api';

interface Props {
  data: DailyProductivityItem[];
}

export function DailyProductivityChart({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          stroke="var(--color-muted-foreground)"
          tickFormatter={(d: string) => d.slice(5)}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
        <Tooltip
          contentStyle={{
            fontSize: 12, padding: '8px 12px', borderRadius: 8,
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="tasks"
          name="Tasks"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="events"
          name="Events"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
