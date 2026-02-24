const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  rules_path: string;
  created_at: string;
  updated_at: string;
}

export interface Rule {
  id: string;
  project_id: string;
  category: string;
  file_path: string;
  description: string | null;
  triggers: string | null;
  content_hash: string | null;
}

export interface RuleEvent {
  id: string;
  timestamp: string;
  type: string;
  project_id: string;
  rule_id: string | null;
  severity: string | null;
  file: string | null;
  line: number | null;
  message: string | null;
  detail: string | null;
  action: string | null;
  agent: string | null;
  step: string | null;
  duration_ms: number | null;
  prompt: string | null;
  summary: string | null;
  result: string | null;
  task_id: string | null;
}

export const api = {
  getProjects: () => request<Project[]>('/projects'),
  getProject: (id: string) => request<Project & { rules: Rule[] }>(`/projects/${id}`),
  getInstruction: async (id: string) => {
    const res = await fetch(`${BASE}/projects/${id}/instruction`);
    return res.text();
  },
  getRules: (projectId: string) => request<Rule[]>(`/projects/${projectId}/rules`),

  getEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<RuleEvent[]>(`/events${qs}`);
  },

  getEventDates: (projectId: string) =>
    request<string[]>(`/events/dates?projectId=${projectId}`),

  createProject: (data: { name: string; description?: string; rulesPath: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
};
