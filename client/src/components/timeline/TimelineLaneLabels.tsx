import { memo, forwardRef } from 'react';
import type { LaneInfo } from './lib/types';
import { CATEGORY_COLORS } from './lib/colors';
import { LABEL_WIDTH } from './lib/constants';

interface TimelineLaneLabelsProps {
  lanes: LaneInfo[];
  scrollTop: number;
}

export const TimelineLaneLabels = memo(
  forwardRef<HTMLDivElement, TimelineLaneLabelsProps>(function TimelineLaneLabels(
    { lanes, scrollTop },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className="flex-shrink-0 relative overflow-hidden"
        style={{ width: LABEL_WIDTH }}
      >
        <div style={{ transform: `translateY(${-scrollTop}px)` }}>
          {lanes.map((lane) => {
            const colors = CATEGORY_COLORS[lane.category];
            return (
              <div
                key={lane.category}
                className="absolute left-0 right-0 flex items-center px-1 text-xs font-medium truncate"
                style={{
                  top: lane.y,
                  height: lane.height,
                  color: colors.text,
                }}
              >
                {lane.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }),
);
