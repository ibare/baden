import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis,
} from 'recharts';
import type { ComplexityItem } from '@/lib/api';

interface Props {
  data: ComplexityItem[];
}

export function ComplexityScatter({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          type="number"
          dataKey="events"
          name="Events"
          tick={{ fontSize: 11 }}
          stroke="var(--color-muted-foreground)"
          label={{ value: 'Events', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'var(--color-muted-foreground)' }}
        />
        <YAxis
          type="number"
          dataKey="durationMin"
          name="Duration"
          tick={{ fontSize: 11 }}
          stroke="var(--color-muted-foreground)"
          label={{ value: 'Min', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--color-muted-foreground)' }}
        />
        <ZAxis type="number" dataKey="files" range={[30, 200]} name="Files" />
        <Tooltip
          contentStyle={{
            fontSize: 12, padding: '8px 12px', borderRadius: 8,
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'Duration') return [`${value}m`, name];
            return [value, name];
          }}
        />
        <Scatter data={data} fill="#6366f1" fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
