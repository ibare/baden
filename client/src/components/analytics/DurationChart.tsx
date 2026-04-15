import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { DurationBucket } from '@/lib/api';

interface Props {
  data: DurationBucket[];
}

export function DurationChart({ data }: Props) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
        <Tooltip
          contentStyle={{
            fontSize: 12, padding: '6px 10px', borderRadius: 8,
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}
          formatter={(value: number) => [`${value} tasks`]}
        />
        <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
