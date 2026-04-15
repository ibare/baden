import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  api,
  type RuleEffectivenessResponse,
  type RuleQualityResponse,
  type AgentEfficiencyResponse,
  type RuleQualityLabel,
} from '@/lib/api';
import { ViolationTrendChart } from '@/components/analytics/ViolationTrendChart';
import { RuleQualitySummary } from '@/components/analytics/RuleQualitySummary';
import { RuleQualityTable } from '@/components/analytics/RuleQualityTable';
import { AgentEfficiencyPanel } from '@/components/analytics/AgentEfficiencyPanel';

type Period = 30 | 90 | 0;
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'All time' },
];

export function AnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [period, setPeriod] = useState<Period>(90);
  const [effectiveness, setEffectiveness] = useState<RuleEffectivenessResponse | null>(null);
  const [quality, setQuality] = useState<RuleQualityResponse | null>(null);
  const [efficiency, setEfficiency] = useState<AgentEfficiencyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.getAnalyticsRuleEffectiveness(projectId, { days: period || undefined }),
      api.getAnalyticsRuleQuality(projectId),
      api.getAnalyticsAgentEfficiency(projectId, { days: period || undefined }),
    ])
      .then(([eff, qual, effic]) => {
        setEffectiveness(eff);
        setQuality(qual);
        setEfficiency(effic);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, period]);

  // 집계된 위반 추이 (전체 규칙 합산)
  const aggregatedTrend = useMemo(() => {
    if (!effectiveness) return [];
    const weekMap = new Map<string, { matches: number; violations: number; fixes: number }>();
    for (const rule of effectiveness.rules) {
      for (const t of rule.trend) {
        const existing = weekMap.get(t.week) ?? { matches: 0, violations: 0, fixes: 0 };
        existing.matches += t.matches;
        existing.violations += t.violations;
        existing.fixes += t.fixes;
        weekMap.set(t.week, existing);
      }
    }
    return [...weekMap.entries()]
      .map(([week, v]) => ({ week, ...v }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [effectiveness]);

  // 규칙 테이블: effectiveness + quality 결합
  const tableRules = useMemo(() => {
    if (!effectiveness || !quality) return [];
    const qualityMap = new Map(quality.rules.map((r) => [r.ruleId, r]));
    return effectiveness.rules.map((r) => ({
      ...r,
      quality: (qualityMap.get(r.ruleId)?.quality ?? 'healthy') as RuleQualityLabel,
      reason: qualityMap.get(r.ruleId)?.reason ?? '',
    }));
  }, [effectiveness, quality]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading analysis...
      </div>
    );
  }

  if (!projectId) return null;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Analysis</h1>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                period === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Efficiency */}
      {efficiency && (
        <section>
          <h2 className="text-base font-medium mb-3">Agent Efficiency</h2>
          <AgentEfficiencyPanel data={efficiency} />
        </section>
      )}

      {/* Violation Trend */}
      {aggregatedTrend.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Violation Trend</h2>
          <ViolationTrendChart data={aggregatedTrend} />
        </section>
      )}

      {/* Rule Quality */}
      {quality && (
        <section>
          <h2 className="text-base font-medium mb-3">Rule Quality</h2>
          <RuleQualitySummary summary={quality.summary} />
        </section>
      )}

      {/* Rule Table */}
      {tableRules.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-base font-medium mb-3">Rules</h2>
          <RuleQualityTable rules={tableRules} projectId={projectId} />
        </section>
      )}
    </div>
  );
}
