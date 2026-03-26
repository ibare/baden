import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface TrendSparklineProps {
  data: { date: string; count: number }[];
  height?: number;
  color?: string;
}

export function TrendSparkline({ data, height = 40, color = '#6366f1' }: TrendSparklineProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-[11px] text-muted-foreground" style={{ height }}>
        No recent activity
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          labelFormatter={(label: string) => label}
          formatter={(value: number) => [value, 'events']}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${color.replace('#', '')})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
