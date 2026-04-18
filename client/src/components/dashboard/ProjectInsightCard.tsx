import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, ArrowRight } from '@phosphor-icons/react';
import type { ProjectInsight, DeepProjectData } from '@/lib/api';
import { AgentBadge } from '@/components/domain/AgentBadge';
import { TrendSparkline } from './TrendSparkline';

interface ProjectInsightCardProps {
  insight: ProjectInsight;
  deep: DeepProjectData | null;
}

const PHASE_COLORS: Record<string, string> = {
  receive: '#94a3b8',
  plan: '#818cf8',
  explore: '#38bdf8',
  rule_check: '#f59e0b',
  implement: '#34d399',
  verify: '#a78bfa',
  complete: '#6366f1',
};

const PHASE_LABELS: Record<string, string> = {
  receive: 'Receive',
  plan: 'Plan',
  explore: 'Explore',
  rule_check: 'Rule Check',
  implement: 'Implement',
  verify: 'Verify',
  complete: 'Complete',
};

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return 'Never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ProjectInsightCard({ insight, deep }: ProjectInsightCardProps) {
  const navigate = useNavigate();
  const { project, stats, dailyTrend } = insight;

  const workflowPhases = deep?.workflowDNA.filter((w) => w.eventRatio > 0) ?? [];
  const topRule = deep?.ruleCompliance.topViolatedRules[0] ?? null;

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-colors group py-4"
      onClick={() => navigate(`/projects/${project.id}/monitor`)}
    >
      <CardHeader className="pb-0 gap-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FolderOpen size={16} className="text-muted-foreground" />
          <span className="truncate">{project.name}</span>
          <AgentBadge agent={project.agent} variant="full" className="ml-auto flex-shrink-0" />
        </CardTitle>
        {project.description && (
          <p className="text-xs text-muted-foreground truncate">{project.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{stats.totalEvents.toLocaleString()}</strong> events
          </span>
          {deep ? (
            <>
              <span>
                <strong className="text-foreground">{deep.profile.totalTasks}</strong> tasks
              </span>
              <span>
                <strong className="text-foreground">{deep.profile.totalFiles}</strong> files
              </span>
            </>
          ) : (
            <span>
              <strong className="text-foreground">{stats.ruleCount}</strong> rules
            </span>
          )}
          <span className="ml-auto">{timeAgo(stats.lastActivityAt)}</span>
        </div>

        {/* Compliance bar + task avg */}
        {deep && (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>Compliance</span>
                <span className="tabular-nums font-medium text-foreground">
                  {(deep.ruleCompliance.complianceRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${deep.ruleCompliance.complianceRate * 100}%`,
                    backgroundColor: deep.ruleCompliance.complianceRate >= 0.95 ? '#22c55e'
                      : deep.ruleCompliance.complianceRate >= 0.8 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </div>
            {deep.taskProfile.avgDurationMin > 0 && (
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-medium tabular-nums">{deep.taskProfile.avgDurationMin}m</div>
                <div className="text-[10px] text-muted-foreground">avg/task</div>
              </div>
            )}
          </div>
        )}

        {/* Workflow DNA mini bar */}
        {workflowPhases.length > 0 && (
          <div className="space-y-1">
            <div className="flex h-2 rounded-full overflow-hidden bg-muted/40">
              {workflowPhases.map((w) => (
                <div
                  key={w.phase}
                  style={{
                    width: `${w.eventRatio}%`,
                    backgroundColor: PHASE_COLORS[w.phase] ?? '#64748b',
                  }}
                  title={`${PHASE_LABELS[w.phase] ?? w.phase}: ${w.eventRatio}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
              {workflowPhases.slice(0, 5).map((w) => (
                <span key={w.phase} className="flex items-center gap-0.5">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: PHASE_COLORS[w.phase] ?? '#64748b' }}
                  />
                  {PHASE_LABELS[w.phase] ?? w.phase} {w.eventRatio}%
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 7-day trend */}
        <TrendSparkline data={dailyTrend} />

        {/* Footer */}
        <div className="flex items-center justify-between">
          {topRule && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600">
              Top violation: {topRule.ruleId} ({topRule.count})
            </span>
          )}
          <div className="flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors ml-auto">
            Open Monitor <ArrowRight size={12} className="ml-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
