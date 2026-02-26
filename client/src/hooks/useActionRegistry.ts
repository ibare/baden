import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import type { ActionPrefix } from '@/lib/api';
import type { EventCategory } from '@/lib/event-types';
import { EVENT_CATEGORY_MAP } from '@/lib/event-types';

// Domain keywords to extract from the detail portion of an action
const DETAIL_KEYWORDS = [
  'i18n', 'json', 'auth', 'css', 'config', 'route', 'api', 'locale',
  'type', 'test', 'rule', 'schema', 'db', 'component', 'hook', 'style',
  'error', 'log', 'file', 'ts', 'html', 'yaml', 'env', 'token',
  'session', 'event', 'user', 'project', 'page', 'layout', 'state',
  'query', 'model', 'service', 'util', 'lib', 'index', 'server',
  'client', 'build', 'deploy', 'docker', 'ci', 'lint', 'format',
];

function extractDetailKeyword(detail: string): string | null {
  if (!detail) return null;
  const tokens = detail.toLowerCase().split('_');
  return DETAIL_KEYWORDS.find((kw) => tokens.includes(kw)) ?? null;
}

export interface ResolvedAction {
  prefix: string;
  detail: string;
  category: EventCategory;
  label: string;
  icon: string | null;
  keyword: string | null;
}

export function useActionRegistry(projectId: string | null) {
  const [prefixes, setPrefixes] = useState<ActionPrefix[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setPrefixes([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getPrefixes(projectId);
      setPrefixes(data);
    } catch (err) {
      console.error('[ActionRegistry] Failed to load prefixes:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Prefixes sorted by length descending (server already does this, but ensure client-side)
  const sortedPrefixes = useMemo(
    () => [...prefixes].sort((a, b) => b.prefix.length - a.prefix.length),
    [prefixes],
  );

  const resolveAction = useCallback(
    (action: string | null, type: string): ResolvedAction => {
      if (action) {
        for (const p of sortedPrefixes) {
          if (action === p.prefix || action.startsWith(p.prefix + '_')) {
            const detail = action === p.prefix ? '' : action.slice(p.prefix.length + 1);
            return {
              prefix: p.prefix,
              detail,
              category: p.category as EventCategory,
              label: p.label,
              icon: p.icon,
              keyword: extractDetailKeyword(detail),
            };
          }
        }
      }

      // Fallback: no matching prefix
      return {
        prefix: '',
        detail: action || type,
        category: (EVENT_CATEGORY_MAP[type] || 'exploration') as EventCategory,
        label: action || type.replace(/_/g, ' '),
        icon: null,
        keyword: null,
      };
    },
    [sortedPrefixes],
  );

  // Backward-compatible wrappers
  const resolveCategory = useCallback(
    (action: string | null, type: string): EventCategory => {
      return resolveAction(action, type).category;
    },
    [resolveAction],
  );

  const resolveIcon = useCallback(
    (action: string | null): string | null => {
      if (!action) return null;
      return resolveAction(action, '').icon;
    },
    [resolveAction],
  );

  return { prefixes, loading, resolveAction, resolveCategory, resolveIcon, refresh };
}
