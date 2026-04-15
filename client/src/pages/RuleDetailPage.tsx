import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type RuleDetailResponse } from '@/lib/api';
import { QualityBadge } from '@/components/analytics/QualityBadge';
import { ViolationTrendChart } from '@/components/analytics/ViolationTrendChart';
import { ArrowLeft } from '@phosphor-icons/react';

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function RuleDetailPage() {
  const { projectId, ruleId } = useParams<{ projectId: string; ruleId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<RuleDetailResponse | null>(null);
  const [content, setContent] = useState<{ title: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !ruleId) return;
    setLoading(true);
    Promise.all([
      api.getAnalyticsRuleDetail(projectId, ruleId),
      api.getRuleContent(projectId, ruleId).catch(() => null),
    ])
      .then(([detail, cont]) => {
        setData(detail);
        setContent(cont);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, ruleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading rule detail...
      </div>
    );
  }

  if (!data || !projectId) return null;

  const { rule, stats, violations, trend, topFiles } = data;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(`/projects/${projectId}/analysis`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft size={14} />
          Back to Analysis
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{rule.id}</h1>
          <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
            {rule.category}
          </span>
          <QualityBadge quality={stats.quality} />
        </div>
        {rule.description && (
          <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{stats.reason}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{stats.matchCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Matches</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.violationCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Violations</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.fixCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Fixes</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{formatMs(stats.avgFixTimeMs)}</div>
          <div className="text-xs text-muted-foreground mt-1">Avg Fix Time</div>
        </div>
      </div>

      {/* Trend Chart */}
      {trend.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Weekly Trend</h2>
          <ViolationTrendChart data={trend} height={250} />
        </section>
      )}

      {/* Top Violated Files */}
      {topFiles.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Most Violated Files</h2>
          <div className="space-y-1">
            {topFiles.map((f) => (
              <div key={f.file} className="flex items-center justify-between py-1.5 text-sm">
                <span className="font-mono text-xs truncate max-w-[70%]">{f.file}</span>
                <span className="text-red-600 font-medium tabular-nums">{f.violation_count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Violation History */}
      {violations.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Violation History ({violations.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">File</th>
                  <th className="py-2 px-3">Message</th>
                  <th className="py-2 px-3">Severity</th>
                  <th className="py-2 px-3 text-center">Fixed</th>
                  <th className="py-2 px-3 text-right">Fix Time</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.id} className="border-b border-border/50">
                    <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(v.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs truncate max-w-[200px]">
                      {v.file ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-xs truncate max-w-[300px]">
                      {v.message ?? '—'}
                    </td>
                    <td className="py-2 px-3">
                      {v.severity && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          v.severity === 'critical' || v.severity === 'high'
                            ? 'bg-red-500/15 text-red-700'
                            : 'bg-amber-500/15 text-amber-700'
                        }`}>
                          {v.severity}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {v.fixed ? '✓' : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-xs text-muted-foreground tabular-nums">
                      {formatMs(v.fixTimeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Rule Content */}
      {content && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Rule Content</h2>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {content.body}
          </pre>
        </section>
      )}
    </div>
  );
}
