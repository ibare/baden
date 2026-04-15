import type { AgentEfficiencyResponse } from '@/lib/api';
import { ViolationTrendChart } from './ViolationTrendChart';

interface AgentEfficiencyPanelProps {
  data: AgentEfficiencyResponse;
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function AgentEfficiencyPanel({ data }: AgentEfficiencyPanelProps) {
  const { summary, trend } = data;

  const trendData = trend.map((t) => ({
    week: t.week,
    matches: t.tasks, // tasks 대신 matches 필드로 매핑
    violations: t.violations,
    fixes: t.fixes,
  }));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{summary.totalTasks}</div>
          <div className="text-xs text-muted-foreground mt-1">Tasks</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{summary.totalViolations}</div>
          <div className="text-xs text-muted-foreground mt-1">Violations</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{summary.totalFixes}</div>
          <div className="text-xs text-muted-foreground mt-1">Fixes</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {(summary.fixSuccessRate * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">Fix Rate</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {formatMs(summary.avgFixTimeMs)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Avg Fix Time</div>
        </div>
      </div>

      {/* Weekly Trend */}
      {trendData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Weekly Trend</h4>
          <ViolationTrendChart data={trendData} height={200} />
        </div>
      )}
    </div>
  );
}
