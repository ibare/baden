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

export interface ActionRegistryEntry {
  id: number;
  project_id: string;
  pattern: string;
  pattern_type: 'exact' | 'wildcard';
  category: string | null;
  label: string | null;
  icon: string | null;
  confirmed: number;
  sample_count: number;
  first_seen: string;
  last_seen: string;
}

export interface ActionPrefix {
  id: number;
  project_id: string;
  prefix: string;
  category: string;
  label: string;
  icon: string | null;
  sort_order: number;
}

export const api = {
  getProjects: () => request<Project[]>('/projects'),
  getProject: (id: string) => request<Project & { rules: Rule[] }>(`/projects/${id}`),
  getInstruction: async (id: string) => {
    const res = await fetch(`${BASE}/projects/${id}/instruction`);
    return res.text();
  },
  getRules: (projectId: string) => request<Rule[]>(`/projects/${projectId}/rules`),
  getRuleContent: (projectId: string, ruleId: string) =>
    request<{ title: string; body: string }>(`/projects/${projectId}/rules/${ruleId}/content`),

  getEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<RuleEvent[]>(`/events${qs}`);
  },

  getEventDates: (projectId: string) =>
    request<string[]>(`/events/dates?projectId=${projectId}`),

  createProject: (data: { name: string; description?: string; rulesPath: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Action Registry
  getActionRegistry: (projectId: string) =>
    request<ActionRegistryEntry[]>(`/projects/${projectId}/action-registry`),

  updateRegistryEntry: (projectId: string, id: number, data: Partial<Pick<ActionRegistryEntry, 'category' | 'label' | 'icon' | 'confirmed' | 'pattern_type'>>) =>
    request<ActionRegistryEntry>(`/projects/${projectId}/action-registry/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  createRegistryEntry: (projectId: string, data: { pattern: string; pattern_type: string; category?: string; label?: string; icon?: string }) =>
    request<ActionRegistryEntry>(`/projects/${projectId}/action-registry`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRegistryEntry: (projectId: string, id: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/action-registry/${id}`, { method: 'DELETE' }),

  bulkConfirmRegistry: (projectId: string, ids: number[]) =>
    request<{ confirmed: number }>(`/projects/${projectId}/action-registry/bulk`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  testRegistryPattern: (projectId: string, pattern: string, patternType: string) =>
    request<{ matches: string[] }>(`/projects/${projectId}/action-registry/test`, {
      method: 'POST',
      body: JSON.stringify({ pattern, pattern_type: patternType }),
    }),

  // Action Prefixes
  getPrefixes: (projectId: string) =>
    request<ActionPrefix[]>(`/projects/${projectId}/action-registry/prefixes`),

  createPrefix: (projectId: string, data: { prefix: string; category: string; label: string; icon?: string | null }) =>
    request<ActionPrefix>(`/projects/${projectId}/action-registry/prefixes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePrefix: (projectId: string, id: number, data: Partial<Pick<ActionPrefix, 'prefix' | 'category' | 'label' | 'icon' | 'sort_order'>>) =>
    request<ActionPrefix>(`/projects/${projectId}/action-registry/prefixes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePrefix: (projectId: string, id: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/action-registry/prefixes/${id}`, { method: 'DELETE' }),
};
