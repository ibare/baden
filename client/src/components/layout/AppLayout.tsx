import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '@/lib/api';
import type { RuleEvent, Rule } from '@/lib/api';
import type { EventCategory } from '@/lib/event-types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useProject } from '@/hooks/useProjectContext';
import type { RootOutletContext } from './RootLayout';
import { ProjectHeader } from '@/components/ProjectHeader';
import { RuleHeatmap } from '@/components/RuleHeatmap';
import { Timeline } from '@/components/timeline';
import { EventDrawer } from '@/components/EventDrawer';

/** UTC 기준 오늘 날짜 (서버 date 필터와 일치) */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function AppLayout() {
  const { projects, selectedProject } = useProject();
  const { resolveAction, resolveCategory, refreshRegistry, setConnected } =
    useOutletContext<RootOutletContext>();

  // Data
  const [rules, setRules] = useState<Rule[]>([]);
  const [events, setEvents] = useState<RuleEvent[]>([]);
  const [eventDates, setEventDates] = useState<string[]>([]);

  // Resizable split
  const [splitRatio, setSplitRatio] = useState(0.7);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (ev.clientY - rect.top) / rect.height;
      setSplitRatio(Math.min(0.9, Math.max(0.2, ratio)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Timeline filters
  const [selectedDate, setSelectedDate] = useState(todayUTC);
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(
    new Set(['user', 'exploration', 'planning', 'implementation', 'verification', 'debugging', 'rule_compliance']),
  );
  const [search, setSearch] = useState('');

  // Drawer
  const [drawerEvent, setDrawerEvent] = useState<RuleEvent | null>(null);
  const [drawerRule, setDrawerRule] = useState<Rule | null>(null);
  const [drawerPinned, setDrawerPinned] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(384);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === selectedProject) ?? null,
    [projects, selectedProject],
  );

  // Load rules & event dates when project changes
  useEffect(() => {
    if (!selectedProject) {
      setRules([]);
      setEvents([]);
      setEventDates([]);
      return;
    }
    api.getRules(selectedProject).then(setRules).catch(console.error);
    api.getEventDates(selectedProject).then((dates) => {
      setEventDates(dates);
      if (dates.length > 0 && !dates.includes(todayUTC())) {
        setSelectedDate(dates[0]);
      } else {
        setSelectedDate(todayUTC());
      }
    }).catch(console.error);
  }, [selectedProject]);

  // Load events when project or date changes
  useEffect(() => {
    if (!selectedProject) return;
    api
      .getEvents({ projectId: selectedProject, date: selectedDate, limit: '1000' })
      .then(setEvents)
      .catch(console.error);
  }, [selectedProject, selectedDate]);

  // WebSocket: only add events if selected date is today
  const handleWsEvent = useCallback(
    (event: RuleEvent) => {
      if (selectedDate === todayUTC()) {
        setEvents((prev) => [event, ...prev]);
      }
      setEventDates((prev) => {
        const d = event.timestamp.slice(0, 10);
        return prev.includes(d) ? prev : [d, ...prev];
      });
    },
    [selectedDate],
  );

  const { connected } = useWebSocket({
    projectId: selectedProject || undefined,
    onEvent: handleWsEvent,
    onRegistryUpdate: refreshRegistry,
  });

  // Sync connection status up to RootLayout
  useEffect(() => {
    setConnected(connected);
  }, [connected, setConnected]);

  // Handlers
  const handleSelectEvent = useCallback(
    (event: RuleEvent) => {
      const rule = event.rule_id ? rules.find((r) => r.id === event.rule_id) ?? null : null;
      setDrawerEvent(event);
      setDrawerRule(rule);
    },
    [rules],
  );

  const handleSelectRule = useCallback(
    (rule: Rule, _eventCount: number) => {
      setDrawerEvent(null);
      setDrawerRule(rule);
    },
    [],
  );

  const handleCloseDrawer = useCallback(() => {
    setDrawerEvent(null);
    setDrawerRule(null);
  }, []);

  const handleTogglePin = useCallback(() => {
    setDrawerPinned((prev) => !prev);
  }, []);

  const toggleCategory = useCallback((cat: EventCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // Filter events for timeline
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const cat = e.prompt ? 'user' : resolveCategory(e.action, e.type);
      if (cat && !activeCategories.has(cat)) return false;
      if (search) {
        const s = search.toLowerCase();
        const searchable = [e.file, e.message, e.rule_id, e.type, e.action, e.step, e.task_id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      return true;
    });
  }, [events, activeCategories, search, resolveCategory]);

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <ProjectHeader project={currentProject} />

        {selectedProject && (
          <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Timeline */}
            <div className="min-h-0 overflow-hidden" style={{ height: `${splitRatio * 100}%` }}>
              <Timeline
                events={filteredEvents}
                allEvents={events}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                eventDates={eventDates}
                activeCategories={activeCategories}
                onToggleCategory={toggleCategory}
                search={search}
                onSearchChange={setSearch}
                onSelectEvent={handleSelectEvent}
                resolveAction={resolveAction}
                selectedEventId={drawerEvent?.id ?? null}
              />
            </div>

            {/* Drag handle */}
            <div
              className="relative flex-shrink-0 h-0 z-10"
              onMouseDown={handleDragStart}
            >
              <div className="absolute inset-x-0 -top-[6px] h-[12px] cursor-row-resize flex items-center justify-center">
                <div className="w-10 h-[5px] rounded-full bg-border hover:bg-muted-foreground/40 transition-colors" />
              </div>
            </div>

            {/* Rules */}
            <div className="flex-1 min-h-0 border-t border-border">
              <RuleHeatmap
                rules={rules}
                events={events}
                selectedRuleId={drawerRule?.id ?? null}
                onSelectRule={handleSelectRule}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pinned sidebar (in-flow) */}
      {drawerPinned && (
        <EventDrawer
          isOpen={!!(drawerEvent || drawerRule)}
          event={drawerEvent}
          rule={drawerRule}
          pinned={drawerPinned}
          pinnedWidth={drawerWidth}
          onClose={handleCloseDrawer}
          onTogglePin={handleTogglePin}
          onWidthChange={setDrawerWidth}
        />
      )}

      {/* Overlay drawer (not pinned) */}
      {!drawerPinned && (
        <EventDrawer
          isOpen={!!(drawerEvent || drawerRule)}
          event={drawerEvent}
          rule={drawerRule}
          pinned={drawerPinned}
          pinnedWidth={drawerWidth}
          onClose={handleCloseDrawer}
          onTogglePin={handleTogglePin}
          onWidthChange={setDrawerWidth}
        />
      )}
    </div>
  );
}
