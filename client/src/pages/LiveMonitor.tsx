import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import type { RuleEvent, Rule } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useProject } from '@/hooks/useProjectContext';
import { SummaryCards } from '@/components/SummaryCards';
import { EventTimeline } from '@/components/EventTimeline';
import { RuleHeatmap } from '@/components/RuleHeatmap';
import { EventLog } from '@/components/EventLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectSelector } from '@/components/domain/ProjectSelector';
import { CreateProjectDialog } from '@/components/domain/CreateProjectDialog';
import { ClipboardCopy, Check } from 'lucide-react';
import { EVENT_CATEGORY_MAP } from '@/lib/event-types';

export function LiveMonitor() {
  const { projects, selectedProject, setSelectedProject, addProject } = useProject();
  const [copied, setCopied] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [events, setEvents] = useState<RuleEvent[]>([]);

  // Load rules & events when project changes
  useEffect(() => {
    if (!selectedProject) {
      setRules([]);
      setEvents([]);
      return;
    }
    api.getRules(selectedProject).then(setRules).catch(console.error);
    api.getEvents({ projectId: selectedProject, limit: '500' }).then(setEvents).catch(console.error);
  }, [selectedProject]);

  // WebSocket handler
  const handleEvent = useCallback((event: RuleEvent) => {
    setEvents((prev) => [event, ...prev]);
  }, []);

  const { connected } = useWebSocket({
    projectId: selectedProject || undefined,
    onEvent: handleEvent,
  });

  // Compute summary by category
  const categoryCounts = useMemo(() => {
    const counts = { exploration: 0, implementation: 0, verification: 0, debugging: 0, violation: 0 };
    for (const e of events) {
      const cat = EVENT_CATEGORY_MAP[e.type];
      if (cat === 'exploration') counts.exploration++;
      else if (cat === 'implementation') counts.implementation++;
      else if (cat === 'verification') counts.verification++;
      else if (cat === 'debugging') counts.debugging++;
      if (e.type === 'violation_found') counts.violation++;
    }
    return counts;
  }, [events]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-card/80 backdrop-blur">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          <span className="text-primary">B</span>aden
        </h1>

        <ProjectSelector
          projects={projects}
          value={selectedProject}
          onChange={setSelectedProject}
          placeholder="프로젝트 선택"
        />

        <CreateProjectDialog
          onCreated={(project) => {
            addProject(project);
            setSelectedProject(project.id);
          }}
        />

        {selectedProject && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const text = await api.getInstruction(selectedProject);
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="gap-1.5"
          >
            {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
            {copied ? '복사됨' : 'Baden 프로토콜 복사'}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs text-muted-foreground">{connected ? '연결됨' : '연결 끊김'}</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-4 p-6 min-h-0 overflow-hidden">
        {/* Summary Cards */}
        <SummaryCards
          events={events.length}
          explorations={categoryCounts.exploration}
          implementations={categoryCounts.implementation}
          verifications={categoryCounts.verification}
          errors={categoryCounts.debugging}
          violations={categoryCounts.violation}
        />

        {/* Timeline + Heatmap */}
        <div className="flex gap-4 flex-1 min-h-0">
          <Card className="w-3/5 flex flex-col py-4 gap-3">
            <CardContent className="flex-1 min-h-0 px-4">
              <EventTimeline events={events} />
            </CardContent>
          </Card>
          <div className="w-2/5">
            <RuleHeatmap rules={rules} events={events} />
          </div>
        </div>

        {/* Event Log */}
        <Card className="h-[300px] flex flex-col py-4 gap-3">
          <CardHeader className="px-4 py-0">
            <CardTitle className="text-sm">상세 로그</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4">
            <EventLog events={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
