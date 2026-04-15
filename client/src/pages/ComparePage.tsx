import { useState, useEffect, useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { api, type DeepComparisonResponse, type DeepProjectData } from '@/lib/api';

const PROJECT_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899',
];

const PHASE_LABELS: Record<string, string> = {
  receive: 'Receive',
  plan: 'Plan',
  explore: 'Explore',
  rule_check: 'Rule Check',
  implement: 'Implement',
  verify: 'Verify',
  complete: 'Complete',
};

function getColor(projects: DeepProjectData[], p: DeepProjectData) {
  return PROJECT_COLORS[projects.indexOf(p) % PROJECT_COLORS.length];
}

function Sparkline({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const max = Math.max(...data.map((d) => d.count));
  const w = 120;
  const h = 24;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (d.count / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function ComparePage() {
  const [data, setData] = useState<DeepComparisonResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dnaMode, setDnaMode] = useState<'events' | 'time'>('events');

  useEffect(() => {
    api.getAnalyticsCompareDeep()
      .then((d) => {
        setData(d);
        setSelected(new Set(d.projects.map((p) => p.projectId)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => data?.projects.filter((p) => selected.has(p.projectId)) ?? [],
    [data, selected],
  );

  // Radar chart data
  const radarData = useMemo(() => {
    const phases = Object.keys(PHASE_LABELS);
    return phases.map((phase) => {
      const entry: Record<string, unknown> = { phase: PHASE_LABELS[phase] };
      for (const p of filtered) {
        const wf = p.workflowDNA.find((w) => w.phase === phase);
        entry[p.projectName] = dnaMode === 'events'
          ? (wf?.eventRatio ?? 0)
          : (wf?.timeRatio ?? 0);
      }
      return entry;
    });
  }, [filtered, dnaMode]);

  // Productivity timeline (filtered)
  const timeline = useMemo(() => {
    if (!data) return [];
    const names = new Set(filtered.map((p) => p.projectName));
    return data.productivityTimeline.map((entry) => {
      const row: Record<string, unknown> = { date: entry.date };
      for (const name of names) {
        row[name] = entry[name] ?? 0;
      }
      return row;
    });
  }, [data, filtered]);

  // Duration distribution stacked data
  const durationData = useMemo(() => {
    const buckets = ['<1m', '1-5m', '5-10m', '10-30m', '30-60m', '60m+'];
    return buckets.map((bucket) => {
      const entry: Record<string, unknown> = { bucket };
      for (const p of filtered) {
        const d = p.taskProfile.durationDistribution.find((dd) => dd.bucket === bucket);
        entry[p.projectName] = d?.count ?? 0;
      }
      return entry;
    });
  }, [filtered]);

  // Rule heatmap
  const ruleHeatmap = useMemo(() => {
    if (!data) return [];
    const projectIds = new Set(filtered.map((p) => p.projectId));
    return data.ruleHeatmap
      .filter((r) => Object.keys(r.byProject).some((id) => projectIds.has(id)))
      .map((r) => ({
        ...r,
        filteredTotal: Object.entries(r.byProject)
          .filter(([id]) => projectIds.has(id))
          .reduce((sum, [, count]) => sum + count, 0),
      }))
      .sort((a, b) => b.filteredTotal - a.filteredTotal);
  }, [data, filtered]);

  // Hourly heatmap max value (for color scaling)
  const hourlyMax = useMemo(() => {
    let max = 0;
    for (const p of filtered) {
      for (const c of p.hourlyActivity) {
        if (c > max) max = c;
      }
    }
    return max || 1;
  }, [filtered]);

  const toggleProject = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading comparison...
      </div>
    );
  }

  if (!data) return null;
  const allProjects = data.projects;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header + Project Filter */}
      <div>
        <h1 className="text-xl font-semibold mb-3">Project Comparison</h1>
        <div className="flex flex-wrap gap-2">
          {allProjects.map((p) => (
            <button
              key={p.projectId}
              onClick={() => toggleProject(p.projectId)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selected.has(p.projectId)
                  ? 'border-transparent text-white'
                  : 'border-border text-muted-foreground bg-card'
              }`}
              style={selected.has(p.projectId)
                ? { backgroundColor: getColor(allProjects, p) }
                : undefined
              }
            >
              {p.projectName}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Layer 1: Project Profile Cards ─── */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Project Profiles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const color = getColor(allProjects, p);
            return (
              <div key={p.projectId} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm" style={{ color }}>
                    {p.projectName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.profile.activeDays}d active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <div className="text-lg font-bold tabular-nums">{p.profile.totalTasks}</div>
                    <div className="text-[10px] text-muted-foreground">Tasks</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular-nums">{p.profile.totalFiles}</div>
                    <div className="text-[10px] text-muted-foreground">Files</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular-nums">{p.profile.totalEvents.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">Events</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>avg {p.taskProfile.avgDurationMin}m/task</span>
                  <span>{p.profile.avgEventsPerDay} events/day</span>
                </div>
                <Sparkline data={p.profile.dailySparkline} color={color} />
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.ruleCompliance.complianceRate * 100}%`,
                        backgroundColor: p.ruleCompliance.complianceRate >= 0.95 ? '#22c55e' : p.ruleCompliance.complianceRate >= 0.8 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums">
                    {(p.ruleCompliance.complianceRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Layer 2: Workflow DNA ─── */}
      {filtered.length > 0 && radarData.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-medium">Workflow DNA</h2>
              <p className="text-xs text-muted-foreground">How each project distributes effort across workflow phases</p>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              <button
                onClick={() => setDnaMode('events')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  dnaMode === 'events' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                By Events
              </button>
              <button
                onClick={() => setDnaMode('time')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  dnaMode === 'time' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                By Time
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="phase" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  fontSize: 12, padding: '8px 12px', borderRadius: 8,
                  background: 'var(--color-card)', border: '1px solid var(--color-border)',
                }}
                formatter={(value: number) => [`${value}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {filtered.map((p) => (
                <Radar
                  key={p.projectId}
                  name={p.projectName}
                  dataKey={p.projectName}
                  stroke={getColor(allProjects, p)}
                  fill={getColor(allProjects, p)}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ─── Layer 3: Productivity Timeline ─── */}
      {timeline.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-1">Productivity Timeline</h2>
          <p className="text-xs text-muted-foreground mb-3">Daily event volume across projects</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timeline} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
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
                  fontSize: 12, padding: '8px 12px', borderRadius: 8,
                  background: 'var(--color-card)', border: '1px solid var(--color-border)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {filtered.map((p) => (
                <Line
                  key={p.projectId}
                  type="monotone"
                  dataKey={p.projectName}
                  stroke={getColor(allProjects, p)}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ─── Layer 4: Task Profiles ─── */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Task Profiles
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Task metrics comparison */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Task Metrics</h3>
            <div className="space-y-3">
              {/* Avg Duration */}
              <MetricBar
                label="Avg Duration"
                items={filtered.map((p) => ({
                  name: p.projectName,
                  value: p.taskProfile.avgDurationMin,
                  color: getColor(allProjects, p),
                  suffix: 'm',
                }))}
              />
              {/* Avg Events/Task */}
              <MetricBar
                label="Avg Events/Task"
                items={filtered.map((p) => ({
                  name: p.projectName,
                  value: p.taskProfile.avgEventsPerTask,
                  color: getColor(allProjects, p),
                }))}
              />
              {/* Avg Files/Task */}
              <MetricBar
                label="Avg Files/Task"
                items={filtered.map((p) => ({
                  name: p.projectName,
                  value: p.taskProfile.avgFilesPerTask,
                  color: getColor(allProjects, p),
                }))}
              />
            </div>
          </div>

          {/* Duration Distribution */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Duration Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={durationData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12, padding: '8px 12px', borderRadius: 8,
                    background: 'var(--color-card)', border: '1px solid var(--color-border)',
                  }}
                />
                {filtered.map((p) => (
                  <Bar
                    key={p.projectId}
                    dataKey={p.projectName}
                    fill={getColor(allProjects, p)}
                    radius={[2, 2, 0, 0]}
                    fillOpacity={0.8}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ─── Layer 4b: Hourly Heatmap ─── */}
      {filtered.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-1">Activity Heatmap</h2>
          <p className="text-xs text-muted-foreground mb-3">Event distribution by hour of day per project</p>
          <div className="space-y-2">
            {/* Hour labels */}
            <div className="flex items-center gap-0.5 pl-20">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {i % 3 === 0 ? `${i}` : ''}
                </div>
              ))}
            </div>
            {filtered.map((p) => (
              <div key={p.projectId} className="flex items-center gap-1">
                <span className="text-xs w-20 text-right truncate pr-2" style={{ color: getColor(allProjects, p) }}>
                  {p.projectName}
                </span>
                <div className="flex-1 flex gap-0.5">
                  {p.hourlyActivity.map((count, hour) => (
                    <div
                      key={hour}
                      className="flex-1 h-5 rounded-[2px]"
                      style={{
                        backgroundColor: getColor(allProjects, p),
                        opacity: count > 0 ? 0.15 + (count / hourlyMax) * 0.85 : 0.05,
                      }}
                      title={`${hour}:00 — ${count} events`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Layer 5: Rule Compliance Deep Dive ─── */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Rule Compliance
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Compliance comparison */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Compliance Overview</h3>
            <div className="space-y-3">
              {filtered.map((p) => {
                const rc = p.ruleCompliance;
                const color = getColor(allProjects, p);
                return (
                  <div key={p.projectId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span style={{ color }}>{p.projectName}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {rc.matchCount} checks / {rc.violationCount} violations / {rc.fixCount} fixes
                      </span>
                    </div>
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${rc.complianceRate * 100}%`,
                          backgroundColor: rc.complianceRate >= 0.95 ? '#22c55e' : rc.complianceRate >= 0.8 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top violated rules per project */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Top Violated Rules</h3>
            <div className="space-y-3">
              {filtered.filter((p) => p.ruleCompliance.topViolatedRules.length > 0).map((p) => (
                <div key={p.projectId}>
                  <div className="text-xs font-medium mb-1" style={{ color: getColor(allProjects, p) }}>
                    {p.projectName}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.ruleCompliance.topViolatedRules.map((r) => (
                      <span
                        key={r.ruleId}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 tabular-nums"
                      >
                        {r.ruleId} ({r.count})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {filtered.every((p) => p.ruleCompliance.topViolatedRules.length === 0) && (
                <p className="text-sm text-muted-foreground">No violations found.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Rule Violation Heatmap */}
      {ruleHeatmap.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-1">Rule Violation Heatmap</h2>
          <p className="text-xs text-muted-foreground mb-3">Violation counts by rule across projects — darker = more violations</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 px-3 text-xs">Rule</th>
                  {filtered.map((p) => (
                    <th key={p.projectId} className="py-2 px-3 text-xs text-center" style={{ color: getColor(allProjects, p) }}>
                      {p.projectName}
                    </th>
                  ))}
                  <th className="py-2 px-3 text-xs text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ruleHeatmap.map((r) => {
                  const maxInRow = Math.max(...filtered.map((p) => r.byProject[p.projectId] ?? 0), 1);
                  return (
                    <tr key={r.ruleId} className="border-b border-border/30">
                      <td className="py-1.5 px-3 font-mono text-xs">{r.ruleId}</td>
                      {filtered.map((p) => {
                        const count = r.byProject[p.projectId] ?? 0;
                        return (
                          <td key={p.projectId} className="py-1.5 px-3 text-center">
                            {count > 0 ? (
                              <span
                                className="inline-block px-2 py-0.5 rounded text-[11px] font-medium tabular-nums"
                                style={{
                                  backgroundColor: `rgba(239, 68, 68, ${0.1 + (count / maxInRow) * 0.4})`,
                                  color: count / maxInRow > 0.5 ? '#dc2626' : '#ef4444',
                                }}
                              >
                                {count}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-3 text-right text-xs font-medium tabular-nums text-red-600">
                        {r.filteredTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Summary Table ─── */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-base font-medium mb-3">Detailed Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 px-3">Project</th>
                <th className="py-2 px-3 text-right">Events</th>
                <th className="py-2 px-3 text-right">Tasks</th>
                <th className="py-2 px-3 text-right">Files</th>
                <th className="py-2 px-3 text-right">Rules</th>
                <th className="py-2 px-3 text-right">Compliance</th>
                <th className="py-2 px-3 text-right">Avg Duration</th>
                <th className="py-2 px-3 text-right">Events/Task</th>
                <th className="py-2 px-3 text-right">Active Days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.projectId} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium" style={{ color: getColor(allProjects, p) }}>
                    {p.projectName}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.profile.totalEvents.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.profile.totalTasks}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.profile.totalFiles}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.profile.itemCount}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{(p.ruleCompliance.complianceRate * 100).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.taskProfile.avgDurationMin}m</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.taskProfile.avgEventsPerTask}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.profile.activeDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Helper Components ───────────────────────────────

function MetricBar({ label, items }: {
  label: string;
  items: { name: string; value: number; color: string; suffix?: string }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 0.1);
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="text-[10px] w-14 text-right truncate" style={{ color: item.color }}>
              {item.name}
            </span>
            <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
              {item.value}{item.suffix ?? ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
