import { useState, useEffect } from 'react';
import type { PlacedItem, Connection } from '../lib/types';
import { buildConnections } from '../lib/algorithms';

/**
 * Computes connections asynchronously using requestIdleCallback
 * to avoid blocking initial render.
 */
export function useTimelineConnections(placed: PlacedItem[]): Connection[] {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    if (placed.length === 0) {
      setConnections([]);
      return;
    }

    const handle = requestIdleCallback(
      () => {
        setConnections(buildConnections(placed));
      },
      { timeout: 500 },
    );

    return () => cancelIdleCallback(handle);
  }, [placed]);

  return connections;
}
