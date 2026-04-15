import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

interface WeekData {
  week: string;
  matches: number;
  violations: number;
  fixes: number;
}

interface ViolationTrendChartProps {
  data: WeekData[];
  height?: number;
}

export function ViolationTrendChart({ data, height = 300 }: ViolationTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No trend data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11 }}
          stroke="var(--color-muted-foreground)"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="var(--color-muted-foreground)"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="matches"
          name="Matches"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="violations"
          name="Violations"
          stroke="#f43f5e"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="fixes"
          name="Fixes"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
