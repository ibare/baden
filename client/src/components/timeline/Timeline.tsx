import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineProps, PlacedItem } from './lib/types';
import type { ExpandLevel } from './lib/constants';
import { LABEL_WIDTH, AUTO_FOLLOW_STORAGE_KEY } from './lib/constants';
import { useTimelineLayout } from './hooks/useTimelineLayout';
import { useTimelineTicks } from './hooks/useTimelineTicks';
import { useTimelineZoom } from './hooks/useTimelineZoom';
import { useTimelineConnections } from './hooks/useTimelineConnections';
import { TimelineFilterBar } from './TimelineFilterBar';
import { TimelineRuler } from './TimelineRuler';
import { TimelineLaneLabels } from './TimelineLaneLabels';
import { TimelineSVG } from './TimelineSVG';
import { TimelineMinimap } from './TimelineMinimap';

export function Timeline({
  events,
  allEvents,
  selectedDate,
  onDateChange,
  eventDates,
  activeCategories,
  onToggleCategory,
  search,
  onSearchChange,
  onSelectEvent,
  resolveAction,
  selectedEventId,
}: TimelineProps) {
  const {
    zoomSec, setZoomSec, ppm, handleWheel, scrollContainerRef,
    onPointerDown, onPointerMove, onPointerUp, isDragging,
  } = useTimelineZoom();
  const [expandLevel, setExpandLevel] = useState<ExpandLevel>(0);
  const [autoFollow, setAutoFollow] = useState(() => {
    try {
      return localStorage.getItem(AUTO_FOLLOW_STORAGE_KEY) === 'true';
    } catch { return false; }
  });
  const [viewportWidth, setViewportWidth] = useState(800);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [now, setNow] = useState(Date.now());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width - LABEL_WIDTH);
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Re-run when scroll container becomes available (conditional rendering)
  const hasEvents = events.length > 0;
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      setScrollTop(container.scrollTop);
      setScrollLeft(container.scrollLeft);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, hasEvents]);

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isToday]);

  const toggleAutoFollow = useCallback(() => {
    setAutoFollow(prev => {
      const next = !prev;
      try { localStorage.setItem(AUTO_FOLLOW_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const { placed, lanes, rangeStart, rangeEnd, totalHeight, totalWidth, timeMap } =
    useTimelineLayout(events, allEvents, selectedDate, activeCategories, ppm, viewportWidth, resolveAction, expandLevel);

  const ticks = useTimelineTicks(rangeStart, rangeEnd, ppm, zoomSec, timeMap);
  const connections = useTimelineConnections(placed);

  // Auto-follow: scroll to latest event when new events arrive
  useEffect(() => {
    if (!autoFollow || !isToday || placed.length === 0 || isDragging) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    let maxRight = 0;
    for (const item of placed) {
      const right = item.x + item.width;
      if (right > maxRight) maxRight = right;
    }

    const target = maxRight - viewportWidth + 80;
    container.scrollLeft = Math.max(0, target);
  }, [placed, autoFollow, isToday, isDragging, viewportWidth, scrollContainerRef]);

  const handleSelectItem = useCallback(
    (item: PlacedItem) => {
      onSelectEvent(item.event);
    },
    [onSelectEvent],
  );

  // NOW label position in the zoom bar (px from left edge of wrapper)
  const nowLabelLeft = useMemo(() => {
    if (!isToday || now < rangeStart) return null;
    const xInSvg = timeMap.msToX(now);
    const xInViewport = xInSvg - scrollLeft + LABEL_WIDTH;
    if (xInViewport < LABEL_WIDTH || xInViewport > LABEL_WIDTH + viewportWidth) return null;
    return xInViewport;
  }, [isToday, now, rangeStart, timeMap, scrollLeft, viewportWidth]);

  const handleMinimapNavigate = useCallback(
    (newScrollLeft: number, newScrollTop: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      container.scrollLeft = newScrollLeft;
      container.scrollTop = newScrollTop;
    },
    [scrollContainerRef],
  );

  return (
    <div className="flex flex-col h-full">
      <TimelineFilterBar
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        isToday={isToday}
        search={search}
        onSearchChange={onSearchChange}
        expandLevel={expandLevel}
        onCycleExpand={() => setExpandLevel(v => ((v + 1) % 3) as ExpandLevel)}
        zoomSec={zoomSec}
        onZoomChange={setZoomSec}
        autoFollow={autoFollow}
        onToggleAutoFollow={toggleAutoFollow}
      />

      {/* Sticky time ruler with NOW label overlay */}
      <div className="relative">
        <TimelineRuler ticks={ticks} segments={timeMap.segments} totalWidth={totalWidth} scrollLeft={scrollLeft} />
        {nowLabelLeft !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: nowLabelLeft }}
          >
            <span className="text-[9px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 -translate-x-1/2 block leading-none">
              NOW
            </span>
          </div>
        )}
      </div>

      <div ref={wrapperRef} className="flex-1 min-h-0 relative">
        {events.length === 0 ? (
          <div className="flex items-center justify-center w-full h-full text-sm text-muted-foreground">
            이벤트가 없습니다
          </div>
        ) : (
          <>
            <div className="flex h-full">
              <TimelineLaneLabels ref={labelsRef} lanes={lanes} scrollTop={scrollTop} />
              <TimelineSVG
                placed={placed}
                lanes={lanes}
                ticks={ticks}
                connections={connections}
                totalWidth={totalWidth}
                totalHeight={totalHeight}
                viewportWidth={viewportWidth}
                rangeStart={rangeStart}
                ppm={ppm}
                isToday={isToday}
                expandLevel={expandLevel}
                timeMap={timeMap}
                selectedEventId={selectedEventId}
                onSelectItem={handleSelectItem}
                onWheel={handleWheel}
                scrollContainerRef={scrollContainerRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                isDragging={isDragging}
              />
            </div>
            <TimelineMinimap
              placed={placed}
              segments={timeMap.segments}
              totalWidth={totalWidth}
              totalHeight={totalHeight}
              viewportWidth={viewportWidth}
              viewportHeight={viewportHeight}
              scrollLeft={scrollLeft}
              scrollTop={scrollTop}
              onNavigate={handleMinimapNavigate}
            />
          </>
        )}
      </div>
    </div>
  );
}
