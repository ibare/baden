import { useState, useEffect, useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api, type ProjectComparisonItem } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  exploration: 'Exploration',
  planning: 'Planning',
  implementation: 'Implementation',
  rule_compliance: 'Rules',
};

const PROJECT_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899',
];

export function ComparePage() {
  const [projects, setProjects] = useState<ProjectComparisonItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalyticsCompare()
      .then((data) => {
        setProjects(data.projects);
        setSelected(new Set(data.projects.map((p) => p.projectId)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => projects.filter((p) => selected.has(p.projectId)),
    [projects, selected],
  );

  // RadarChart 데이터
  const radarData = useMemo(() => {
    const categories = Object.keys(CATEGORY_LABELS);
    return categories.map((cat) => {
      const entry: Record<string, unknown> = { category: CATEGORY_LABELS[cat] };
      for (const p of filtered) {
        entry[p.projectName] = Math.round((p.categoryDistribution[cat] ?? 0) * 100);
      }
      return entry;
    });
  }, [filtered]);

  // BarChart 데이터 (성숙도)
  const maturityData = useMemo(
    () => filtered.map((p) => ({ name: p.projectName, score: p.maturityScore })),
    [filtered],
  );

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

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header + Project Filter */}
      <div>
        <h1 className="text-xl font-semibold mb-3">Project Comparison</h1>
        <div className="flex flex-wrap gap-2">
          {projects.map((p, i) => (
            <button
              key={p.projectId}
              onClick={() => toggleProject(p.projectId)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selected.has(p.projectId)
                  ? 'border-transparent text-white'
                  : 'border-border text-muted-foreground bg-card'
              }`}
              style={selected.has(p.projectId)
                ? { backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }
                : undefined
              }
            >
              {p.projectName}
            </button>
          ))}
        </div>
      </div>

      {/* Maturity Scores */}
      <section>
        <h2 className="text-base font-medium mb-3">Maturity Score</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((p, i) => (
            <div key={p.projectId} className="bg-card border border-border rounded-lg p-4 text-center">
              <div
                className="text-3xl font-bold"
                style={{ color: PROJECT_COLORS[projects.indexOf(p) % PROJECT_COLORS.length] }}
              >
                {p.maturityScore}
              </div>
              <div className="text-sm font-medium mt-1">{p.projectName}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {(p.complianceRate * 100).toFixed(0)}% compliance
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Behavioral DNA Radar */}
      {filtered.length > 0 && radarData.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Behavioral DNA</h2>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                }}
                formatter={(value: number) => [`${value}%`]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {filtered.map((p) => (
                <Radar
                  key={p.projectId}
                  name={p.projectName}
                  dataKey={p.projectName}
                  stroke={PROJECT_COLORS[projects.indexOf(p) % PROJECT_COLORS.length]}
                  fill={PROJECT_COLORS[projects.indexOf(p) % PROJECT_COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Maturity Bar Chart */}
      {maturityData.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Maturity Comparison</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={maturityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                }}
              />
              <Bar dataKey="score" name="Maturity" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Comparison Table */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-base font-medium mb-3">Detailed Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 px-3">Project</th>
                <th className="py-2 px-3 text-right">Events</th>
                <th className="py-2 px-3 text-right">Rules</th>
                <th className="py-2 px-3 text-right">Items</th>
                <th className="py-2 px-3 text-right">Compliance</th>
                <th className="py-2 px-3 text-right">Ref Intensity</th>
                <th className="py-2 px-3 text-right">Fix Rate</th>
                <th className="py-2 px-3 text-right">Maturity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.projectId} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium">{p.projectName}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.totalEvents.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.ruleCount}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.itemCount}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{(p.complianceRate * 100).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right tabular-nums">{p.ruleRefIntensity.toFixed(2)}x</td>
                  <td className="py-2 px-3 text-right tabular-nums">{(p.fixRate * 100).toFixed(0)}%</td>
                  <td className="py-2 px-3 text-right tabular-nums font-medium">{p.maturityScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
