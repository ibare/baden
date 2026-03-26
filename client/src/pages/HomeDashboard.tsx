import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { InsightsResponse } from '@/lib/api';
import { useProject } from '@/hooks/useProjectContext';
import { useLiveFeed } from '@/hooks/useLiveFeed';
import { ProjectDialog } from '@/components/domain/ProjectDialog';
import { GlobalStats } from '@/components/dashboard/GlobalStats';
import { ProjectInsightCard } from '@/components/dashboard/ProjectInsightCard';
import { LiveFeed } from '@/components/dashboard/LiveFeed';
import { Plus } from '@phosphor-icons/react';

const FEED_MIN_W = 200;
const FEED_MAX_W = 600;
const FEED_DEFAULT_W = 320;
const FEED_STORAGE_KEY = 'baden-live-feed-width';

function loadFeedWidth(): number {
  try {
    const v = localStorage.getItem(FEED_STORAGE_KEY);
    if (v) {
      const n = Number(v);
      if (n >= FEED_MIN_W && n <= FEED_MAX_W) return n;
    }
  } catch { /* ignore */ }
  return FEED_DEFAULT_W;
}

export function HomeDashboard() {
  const { projects, addProject } = useProject();
  const { feedItems, connected } = useLiveFeed();
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedWidth, setFeedWidth] = useState(loadFeedWidth);
  const [resizing, setResizing] = useState(false);
  const dragOrigin = useRef({ x: 0, w: 0 });

  useEffect(() => {
    try { localStorage.setItem(FEED_STORAGE_KEY, String(feedWidth)); } catch { /* ignore */ }
  }, [feedWidth]);

  const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOrigin.current = { x: e.clientX, w: feedWidth };
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      const delta = dragOrigin.current.x - ev.clientX;
      const next = Math.max(FEED_MIN_W, Math.min(FEED_MAX_W, dragOrigin.current.w + delta));
      setFeedWidth(next);
    };

    const onUp = () => {
      setResizing(false);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [feedWidth]);

  useEffect(() => {
    setLoading(true);
    api
      .getInsights()
      .then(setInsights)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!insights || projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p className="text-sm">No projects yet</p>
        <ProjectDialog onCreated={addProject}>
          <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
            <Plus size={16} />
            Create your first project
          </button>
        </ProjectDialog>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex min-h-0 ${resizing ? 'select-none' : ''}`}>
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-lg font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview across all projects</p>
          </div>

          {/* Global stats + Activity Heatmap */}
          <GlobalStats insights={insights} />

          {/* Project cards */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.projects.map((insight) => (
                <ProjectInsightCard key={insight.project.id} insight={insight} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Feed panel */}
      <div
        className="flex-shrink-0 border-l border-border hidden xl:flex relative"
        style={{ width: feedWidth }}
      >
        {/* Resize handle */}
        <div
          onPointerDown={onResizeStart}
          className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors hover:bg-primary/30 ${resizing ? 'bg-primary/30' : ''}`}
        />
        <LiveFeed feedItems={feedItems} connected={connected} />
      </div>
    </div>
  );
}
