import { memo } from 'react';
import type { Connection } from './lib/types';
import { BAR_HEIGHT } from './lib/constants';
import { CATEGORY_COLORS } from './lib/colors';

interface TimelineConnectionsProps {
  connections: Connection[];
}

export const TimelineConnections = memo(function TimelineConnections({
  connections,
}: TimelineConnectionsProps) {
  if (connections.length === 0) return null;

  return (
    <g className="timeline-connections">
      {connections.map((conn, i) => {
        const x1 = conn.from.x + conn.from.width;
        const y1 = conn.from.y + BAR_HEIGHT / 2;
        const x2 = conn.to.x;
        const y2 = conn.to.y + BAR_HEIGHT / 2;

        const dx = Math.abs(x2 - x1) * 0.4;
        const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const isRuleChain = conn.type === 'rule_chain';
        const color = CATEGORY_COLORS[conn.from.category].connector;

        return (
          <path
            key={`${conn.from.id}-${conn.to.id}-${i}`}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={isRuleChain ? 0.4 : 0.3}
            strokeDasharray={isRuleChain ? undefined : '4 3'}
          />
        );
      })}
    </g>
  );
});
