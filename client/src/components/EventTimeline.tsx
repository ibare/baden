import { useEffect, useRef, useState, useMemo } from 'react';
import type { RuleEvent } from '@/lib/api';
import { useProject } from '@/hooks/useProjectContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from '@/components/domain/SeverityBadge';
import { TYPE_CONFIG, EVENT_CATEGORY_MAP, CATEGORY_CONFIG } from '@/lib/event-types';

interface EventTimelineProps {
  events: RuleEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  const { projects } = useProject();
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop } = containerRef.current;
    setAutoScroll(scrollTop < 10);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">타임라인</h3>
        {!autoScroll && (
          <Button variant="link" size="xs" onClick={() => setAutoScroll(true)}>
            최신으로 이동
          </Button>
        )}
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 min-h-0"
      >
        {events.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">이벤트 대기 중...</div>
        )}
        {events.map((event) => {
          const config = TYPE_CONFIG[event.type] || { icon: '?', color: 'text-muted-foreground' };
          const category = EVENT_CATEGORY_MAP[event.type];
          const catConfig = category ? CATEGORY_CONFIG[category] : null;
          const time = new Date(event.timestamp).toLocaleTimeString('ko-KR');
          return (
            <div key={event.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
              <span className={`${config.color} font-mono w-4 flex-shrink-0`}>{config.icon}</span>
              <span className="text-muted-foreground flex-shrink-0 w-20 font-mono text-xs mt-0.5">{time}</span>
              <div className="flex-1 min-w-0">
                <Badge variant="outline" className="mr-1.5 text-xs text-muted-foreground">
                  {projectNameMap.get(event.project_id) ?? event.project_id}
                </Badge>
                {catConfig && (
                  <Badge variant="secondary" className="mr-1.5 text-xs">
                    {catConfig.label}
                  </Badge>
                )}
                <span className={`${config.color} font-medium`}>
                  {event.type === 'query'
                    ? [event.step, event.action].filter(Boolean).join(' · ') || 'query'
                    : event.type.replace(/_/g, ' ')}
                </span>
                {event.rule_id && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {event.rule_id}
                  </Badge>
                )}
                {event.file && (
                  <span className="ml-2 text-muted-foreground text-xs truncate">{event.file}</span>
                )}
                {event.message && (
                  <div className="text-muted-foreground text-xs mt-0.5 truncate">{event.message}</div>
                )}
              </div>
              {event.severity && (
                <SeverityBadge severity={event.severity} className="flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
