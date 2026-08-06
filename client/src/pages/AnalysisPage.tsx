import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  api,
  type RuleEffectivenessResponse,
  type RuleQualityResponse,
  type AgentEfficiencyResponse,
  type AnalyticsInsightsResponse,
  type RuleQualityLabel,
  type Rule,
} from '@/lib/api';
import { RuleSyncControl } from '@/components/domain/RuleSyncControl';
import { ViolationTrendChart } from '@/components/analytics/ViolationTrendChart';
import { RuleQualitySummary } from '@/components/analytics/RuleQualitySummary';
import { RuleQualityTable } from '@/components/analytics/RuleQualityTable';
import { AgentEfficiencyPanel } from '@/components/analytics/AgentEfficiencyPanel';
import { InsightSection } from '@/components/analytics/InsightSection';
import { BehaviorFlowChart } from '@/components/analytics/BehaviorFlowChart';
import { PhaseTimeChart } from '@/components/analytics/PhaseTimeChart';
import { HourlyChart } from '@/components/analytics/HourlyChart';
import { DurationChart } from '@/components/analytics/DurationChart';
import { DailyProductivityChart } from '@/components/analytics/DailyProductivityChart';
import { ComplexityScatter } from '@/components/analytics/ComplexityScatter';
import { ViolationClusters } from '@/components/analytics/ViolationClusters';
import { HotspotFiles } from '@/components/analytics/HotspotFiles';
import { ViolationStories } from '@/components/analytics/ViolationStories';
import { RuleCoOccurrenceList } from '@/components/analytics/RuleCoOccurrenceList';

type Period = 30 | 90 | 0;
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'All time' },
];

type Tab = 'overview' | 'insights';

export function AnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [period, setPeriod] = useState<Period>(90);
  const [tab, setTab] = useState<Tab>('overview');
  const [effectiveness, setEffectiveness] = useState<RuleEffectivenessResponse | null>(null);
  const [quality, setQuality] = useState<RuleQualityResponse | null>(null);
  const [efficiency, setEfficiency] = useState<AgentEfficiencyResponse | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsightsResponse | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  /** 재싱크 후 분석 데이터를 다시 부르기 위한 트리거 */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.getAnalyticsRuleEffectiveness(projectId, { days: period || undefined }),
      api.getAnalyticsRuleQuality(projectId),
      api.getAnalyticsAgentEfficiency(projectId, { days: period || undefined }),
      api.getAnalyticsInsights(projectId, { days: period || undefined }),
      api.getRules(projectId),
    ])
      .then(([eff, qual, effic, ins, ruleList]) => {
        setEffectiveness(eff);
        setQuality(qual);
        setEfficiency(effic);
        setInsights(ins);
        setRules(ruleList);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, period, reloadKey]);

  /** 규칙 파일을 마지막으로 읽은 시각 */
  const lastSyncedAt = useMemo(() => {
    if (rules.length === 0) return null;
    return rules.reduce((latest, r) => (r.parsed_at > latest ? r.parsed_at : latest), rules[0].parsed_at);
  }, [rules]);

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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Analysis</h1>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setTab('overview')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                tab === 'overview'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setTab('insights')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                tab === 'insights'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Insights
            </button>
          </div>
        </div>
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

      {tab === 'overview' && (
        <>
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

          {/* Rule Table — 규칙이 없어도 섹션은 남긴다. 그때가 재싱크가 가장 필요한 순간이다 */}
          <section className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-base font-medium">Rules</h2>
              <RuleSyncControl
                projectId={projectId}
                lastSyncedAt={lastSyncedAt}
                onSynced={() => setReloadKey((k) => k + 1)}
              />
            </div>
            {tableRules.length > 0 ? (
              <RuleQualityTable rules={tableRules} projectId={projectId} />
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                등록된 규칙이 없다. rules 디렉토리를 설정했다면 다시 읽어보라.
              </p>
            )}
          </section>
        </>
      )}

      {tab === 'insights' && insights && (
        <>
          {/* 시간축 분석 */}
          <h2 className="text-base font-medium text-muted-foreground uppercase tracking-wider">
            Time Analysis
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InsightSection
              title="Behavior Flow"
              description="Average actions per task in each workflow phase"
            >
              <BehaviorFlowChart data={insights.behaviorFlow} />
            </InsightSection>

            <InsightSection
              title="Phase Time Distribution"
              description="How time is distributed across workflow phases"
            >
              <PhaseTimeChart data={insights.phaseTimeDistribution} />
            </InsightSection>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InsightSection
              title="Task Duration"
              description="Distribution of task completion times"
            >
              <DurationChart data={insights.durationDistribution} />
            </InsightSection>

            <InsightSection
              title="Hourly Activity"
              description="Event distribution by hour of day"
            >
              <HourlyChart data={insights.hourlyDistribution} />
            </InsightSection>
          </div>

          <InsightSection
            title="Daily Productivity"
            description="Tasks completed and events generated per day"
          >
            <DailyProductivityChart data={insights.dailyProductivity} />
          </InsightSection>

          <InsightSection
            title="Task Complexity"
            description="Relationship between event count, file count, and duration"
          >
            <ComplexityScatter data={insights.complexityData} />
          </InsightSection>

          {/* 규칙 인사이트 */}
          <h2 className="text-base font-medium text-muted-foreground uppercase tracking-wider pt-2">
            Rule Insights
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InsightSection
              title="Violation Patterns"
              description="Most recurring violation patterns clustered by rule and message"
            >
              <ViolationClusters data={insights.violationClusters} />
            </InsightSection>

            <InsightSection
              title="Hotspot Files"
              description="Files with the most rule violations across all rules"
            >
              <HotspotFiles data={insights.hotspotFiles} />
            </InsightSection>
          </div>

          {insights.ruleCoOccurrence.length > 0 && (
            <InsightSection
              title="Rule Co-occurrence"
              description="Rules that are frequently violated together in the same task"
            >
              <RuleCoOccurrenceList data={insights.ruleCoOccurrence} />
            </InsightSection>
          )}

          <InsightSection
            title="Violation Stories"
            description="Task timelines showing how violations were discovered and resolved"
          >
            <ViolationStories data={insights.violationStories} />
          </InsightSection>
        </>
      )}
    </div>
  );
}
