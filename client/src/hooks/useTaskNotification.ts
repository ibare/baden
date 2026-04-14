import { useEffect } from 'react';
import type { RuleEvent, Project } from '@/lib/api';

let projects: Project[] = [];

// Deduplicate: prevent multiple useWebSocket instances from firing duplicate notifications
const notifiedIds = new Set<string>();

export function notifyTaskComplete(event: RuleEvent): void {
  if (event.type !== 'task_complete') return;
  if (notifiedIds.has(event.id)) return;
  notifiedIds.add(event.id);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const project = projects.find((p) => p.id === event.project_id);
  const projectName = project?.name ?? event.project_id.slice(0, 8);

  const notification = new Notification(`✔ Task Complete — ${projectName}`, {
    body: event.summary ?? 'Task completed',
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

/** Call once in RootLayout to request permission and sync project list */
export function useTaskNotification(projectList: Project[]) {
  projects = projectList;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
}
