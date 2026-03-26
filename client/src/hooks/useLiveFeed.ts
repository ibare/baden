import { useCallback, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { useProject } from './useProjectContext';
import { EVENT_CATEGORY_MAP, CATEGORY_CONFIG } from '@/lib/event-types';
import type { RuleEvent } from '@/lib/api';
import type { EventCategory } from '@/lib/event-types';

const MAX_FEED_ITEMS = 100;

export interface LiveFeedItem {
  id: string;
  event: RuleEvent;
  projectName: string;
  category: EventCategory;
  categoryColor: string;
  categoryLabel: string;
  isUserEvent: boolean;
}

export function useLiveFeed() {
  const { projects } = useProject();
  const [feedItems, setFeedItems] = useState<LiveFeedItem[]>([]);

  const handleEvent = useCallback(
    (event: RuleEvent) => {
      const project = projects.find((p) => p.id === event.project_id);
      const projectName = project?.name ?? event.project_id.slice(0, 8);
      const isUserEvent = !!event.prompt;
      const category: EventCategory = isUserEvent
        ? 'user'
        : EVENT_CATEGORY_MAP[event.type] ?? 'exploration';
      const cfg = CATEGORY_CONFIG[category];

      const item: LiveFeedItem = {
        id: event.id,
        event,
        projectName,
        category,
        categoryColor: cfg.color,
        categoryLabel: cfg.label,
        isUserEvent,
      };

      setFeedItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        const next = [item, ...prev];
        return next.length > MAX_FEED_ITEMS ? next.slice(0, MAX_FEED_ITEMS) : next;
      });
    },
    [projects],
  );

  const { connected } = useWebSocket({ onEvent: handleEvent });

  return { feedItems, connected };
}
