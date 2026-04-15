import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { HourlyItem } from '@/lib/api';

interface Props {
  data: HourlyItem[];
}

export function HourlyChart({ data }: Props) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 10 }}
          stroke="var(--color-muted-foreground)"
          tickFormatter={(h: number) => `${h}h`}
        />
        <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
        <Tooltip
          contentStyle={{
            fontSize: 12, padding: '6px 10px', borderRadius: 8,
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}
          formatter={(value: number) => [`${value} events`]}
          labelFormatter={(h: number) => `${h}:00 - ${h}:59`}
        />
        <Bar dataKey="count" fill="#818cf8" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
