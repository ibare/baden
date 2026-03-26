import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, ArrowRight } from '@phosphor-icons/react';
import type { ProjectInsight } from '@/lib/api';
import { CategoryBar } from './CategoryBar';
import { TrendSparkline } from './TrendSparkline';

interface ProjectInsightCardProps {
  insight: ProjectInsight;
}

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

export function ProjectInsightCard({ insight }: ProjectInsightCardProps) {
  const navigate = useNavigate();
  const { project, stats, categoryDistribution, dailyTrend } = insight;

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-colors group py-4"
      onClick={() => navigate(`/projects/${project.id}/monitor`)}
    >
      <CardHeader className="pb-0 gap-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FolderOpen size={16} className="text-muted-foreground" />
          {project.name}
        </CardTitle>
        {project.description && (
          <p className="text-xs text-muted-foreground truncate">{project.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{stats.totalEvents.toLocaleString()}</strong> events</span>
          <span><strong className="text-foreground">{stats.ruleCount}</strong> rules</span>
          <span className="ml-auto">{timeAgo(stats.lastActivityAt)}</span>
        </div>

        {/* Category distribution */}
        <CategoryBar distribution={categoryDistribution} />

        {/* 7-day trend */}
        <TrendSparkline data={dailyTrend} />

        {/* Footer */}
        <div className="flex items-center justify-end text-xs text-muted-foreground group-hover:text-primary transition-colors">
          Open Monitor <ArrowRight size={12} className="ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}
