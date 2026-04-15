import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { DeepComparisonResponse } from '@/lib/api';

const PROJECT_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899',
];

interface Props {
  data: DeepComparisonResponse;
}

export function CrossProjectInsights({ data }: Props) {
  const { projects, productivityTimeline, ruleHeatmap } = data;

  // 최근 30일만 표시
  const recentTimeline = useMemo(() => {
    const last30 = productivityTimeline.slice(-30);
    if (last30.length === 0) return [];
    return last30;
  }, [productivityTimeline]);

  // 위반이 있는 규칙만 필터
  const activeRules = useMemo(() => {
    return ruleHeatmap.filter((r) => r.total > 0).slice(0, 8);
  }, [ruleHeatmap]);

  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const r of activeRules) {
      for (const count of Object.values(r.byProject)) {
        if (count > max) max = count;
      }
    }
    return max || 1;
  }, [activeRules]);

  if (recentTimeline.length === 0 && activeRules.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Across All Projects</h2>

      {/* Productivity Timeline */}
      {recentTimeline.length > 1 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-1">Activity Timeline</h3>
          <p className="text-[11px] text-muted-foreground mb-3">Daily event volume comparison (last 30 days)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recentTimeline} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                stroke="var(--color-muted-foreground)"
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                contentStyle={{
                  fontSize: 11, padding: '6px 10px', borderRadius: 8,
                  background: 'var(--color-card)', border: '1px solid var(--color-border)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {projects.map((p, i) => (
                <Line
                  key={p.projectId}
                  type="monotone"
                  dataKey={p.projectName}
                  stroke={PROJECT_COLORS[i % PROJECT_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rule Violation Heatmap */}
      {activeRules.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-1">Rule Violation Map</h3>
          <p className="text-[11px] text-muted-foreground mb-3">Which rules are violated in which projects</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 px-2">Rule</th>
                  {projects.map((p, i) => (
                    <th
                      key={p.projectId}
                      className="py-1.5 px-2 text-center"
                      style={{ color: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                    >
                      {p.projectName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRules.map((r) => (
                  <tr key={r.ruleId} className="border-b border-border/30">
                    <td className="py-1 px-2 font-mono">{r.ruleId}</td>
                    {projects.map((p) => {
                      const count = r.byProject[p.projectId] ?? 0;
                      return (
                        <td key={p.projectId} className="py-1 px-2 text-center">
                          {count > 0 ? (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums"
                              style={{
                                backgroundColor: `rgba(239, 68, 68, ${0.1 + (count / heatmapMax) * 0.4})`,
                                color: '#ef4444',
                              }}
                            >
                              {count}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/20">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
