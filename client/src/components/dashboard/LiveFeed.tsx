import type { LiveFeedItem } from '@/hooks/useLiveFeed';
import { Badge } from '@/components/ui/badge';

const TAILWIND_BG: Record<string, string> = {
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  rose: 'bg-rose-500',
};

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'now';
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface LiveFeedProps {
  feedItems: LiveFeedItem[];
  connected: boolean;
}

export function LiveFeed({ feedItems, connected }: LiveFeedProps) {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold">Live Activity</h3>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-[11px] text-muted-foreground">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto">
        {feedItems.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground animate-pulse">
            Waiting for events...
          </div>
        ) : (
          feedItems.map((item) => (
            <div
              key={item.id}
              className="px-4 py-2 border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs min-w-0">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  {item.projectName}
                </Badge>
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${TAILWIND_BG[item.categoryColor] ?? 'bg-muted-foreground'}`}
                />
                <span className="font-medium truncate min-w-0 flex-1">
                  {item.isUserEvent ? 'User prompt' : item.event.action || item.event.type}
                </span>
                <span className="text-muted-foreground flex-shrink-0">
                  {timeAgo(item.event.timestamp)}
                </span>
              </div>
              {(item.event.summary || item.event.prompt) && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {item.isUserEvent ? `> ${item.event.prompt}` : item.event.summary}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
