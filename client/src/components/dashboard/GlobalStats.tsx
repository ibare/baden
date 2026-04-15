import { useMemo } from 'react';
import type { InsightsResponse, DeepComparisonResponse } from '@/lib/api';
import { ActivityHeatmap } from './ActivityHeatmap';

interface GlobalStatsProps {
  insights: InsightsResponse;
  deepComparison: DeepComparisonResponse | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-CA');
}

export function GlobalStats({ insights, deepComparison }: GlobalStatsProps) {
  const { global, projects } = insights;

  const crossStats = useMemo(() => {
    if (!deepComparison || deepComparison.projects.length === 0) return null;
    const dp = deepComparison.projects;
    const totalTasks = dp.reduce((s, p) => s + p.profile.totalTasks, 0);
    const totalFiles = dp.reduce((s, p) => s + p.profile.totalFiles, 0);
    // 가중 평균 compliance rate
    const totalMatches = dp.reduce((s, p) => s + p.ruleCompliance.matchCount, 0);
    const totalViolations = dp.reduce((s, p) => s + p.ruleCompliance.violationCount, 0);
    const complianceRate = totalMatches > 0 ? 1 - totalViolations / totalMatches : 1;
    const totalFixes = dp.reduce((s, p) => s + p.ruleCompliance.fixCount, 0);
    return { totalTasks, totalFiles, complianceRate, totalViolations, totalFixes };
  }, [deepComparison]);

  return (
    <div className="space-y-5">
      {/* Summary numbers */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="text-2xl font-bold">{global.totalEvents.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Events</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{global.totalProjects}</div>
          <div className="text-xs text-muted-foreground">Projects</div>
        </div>
        {crossStats && (
          <>
            <div>
              <div className="text-2xl font-bold">{crossStats.totalTasks.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Tasks</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{crossStats.totalFiles.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Files</div>
            </div>
          </>
        )}
        {/* Compliance summary */}
        {crossStats && crossStats.totalViolations > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${crossStats.complianceRate * 100}%`,
                      backgroundColor: crossStats.complianceRate >= 0.95 ? '#22c55e' : crossStats.complianceRate >= 0.8 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {(crossStats.complianceRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Compliance ({crossStats.totalViolations} violations)
              </div>
            </div>
          </div>
        )}
        {!crossStats && global.firstEventAt && (
          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Tracking since</div>
            <div className="text-sm font-medium">{formatDate(global.firstEventAt)}</div>
          </div>
        )}
      </div>

      {/* Activity Heatmap */}
      {projects.length > 0 && (
        <ActivityHeatmap projects={projects} firstEventAt={global.firstEventAt} />
      )}
    </div>
  );
}
