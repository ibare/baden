import type { InsightsResponse } from '@/lib/api';
import { ActivityHeatmap } from './ActivityHeatmap';

interface GlobalStatsProps {
  insights: InsightsResponse;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-CA');
}

export function GlobalStats({ insights }: GlobalStatsProps) {
  const { global, projects } = insights;

  return (
    <div className="space-y-5">
      {/* Summary numbers */}
      <div className="flex items-end gap-6">
        <div>
          <div className="text-2xl font-bold">{global.totalEvents.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Events</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{global.totalProjects}</div>
          <div className="text-xs text-muted-foreground">Projects</div>
        </div>
        {global.firstEventAt && (
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
