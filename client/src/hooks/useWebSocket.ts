import { useEffect, useRef, useCallback, useState } from 'react';
import type { RuleEvent } from '@/lib/api';

interface UseWebSocketOptions {
  projectId?: string;
  onEvent?: (event: RuleEvent) => void;
  onRegistryUpdate?: () => void;
}

export function useWebSocket({ projectId, onEvent, onRegistryUpdate }: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const onRegistryUpdateRef = useRef(onRegistryUpdate);
  const [connected, setConnected] = useState(false);

  onEventRef.current = onEvent;
  onRegistryUpdateRef.current = onRegistryUpdate;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws${projectId ? `?projectId=${projectId}` : ''}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'event' && msg.data) {
          onEventRef.current?.(msg.data);
        } else if (msg.type === 'registry_update') {
          onRegistryUpdateRef.current?.();
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2 seconds
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [projectId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
