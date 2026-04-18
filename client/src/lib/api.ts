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

export type AgentType = 'claude_code' | 'codex';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  rules_path: string | null;
  agent: AgentType;
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

export interface DetailKeyword {
  id: number;
  project_id: string;
  keyword: string;
  category: string;
}

export interface ProjectInsight {
  project: { id: string; name: string; description: string | null; agent: AgentType };
  stats: { totalEvents: number; ruleCount: number; lastActivityAt: string | null };
  categoryDistribution: { category: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
  weeklyTrend: { week: string; date: string; count: number }[];
}

export interface InsightsResponse {
  global: {
    totalEvents: number;
    totalProjects: number;
    firstEventAt: string | null;
  };
  projects: ProjectInsight[];
}

// ─── Analytics Types ────────────────────────────────────

export type RuleQualityLabel = 'healthy' | 'dormant' | 'ineffective' | 'over_triggered';

export interface RuleEffectivenessItem {
  ruleId: string;
  description: string | null;
  category: string;
  itemCount: number;
  matchCount: number;
  violationCount: number;
  fixCount: number;
  violationRate: number;
  fixRate: number;
  avgFixTimeMs: number | null;
  trend: { week: string; violations: number; matches: number; fixes: number }[];
  repeatedViolations: number;
}

export interface RuleEffectivenessResponse {
  rules: RuleEffectivenessItem[];
}

export interface RuleQualityItem {
  ruleId: string;
  description: string | null;
  category: string;
  itemCount: number;
  quality: RuleQualityLabel;
  reason: string;
  matchCount: number;
  violationCount: number;
  fixCount: number;
  lastMatchAt: string | null;
  lastViolationAt: string | null;
  avgFixTimeMs: number | null;
}

export interface RuleQualityResponse {
  rules: RuleQualityItem[];
  summary: Record<RuleQualityLabel, number>;
}

export interface AgentEfficiencyResponse {
  summary: {
    totalTasks: number;
    totalViolations: number;
    totalFixes: number;
    violationRate: number;
    fixSuccessRate: number;
    avgFixTimeMs: number | null;
  };
  taskBreakdown: {
    taskId: string;
    startedAt: string;
    completedAt: string | null;
    eventCount: number;
    violationCount: number;
    fixCount: number;
    fixRate: number;
  }[];
  trend: {
    week: string;
    tasks: number;
    violations: number;
    fixes: number;
  }[];
}

export interface RuleDetailResponse {
  rule: {
    id: string;
    category: string;
    filePath: string;
    description: string | null;
    triggers: Record<string, unknown> | null;
    itemCount: number;
  };
  stats: {
    matchCount: number;
    violationCount: number;
    fixCount: number;
    avgFixTimeMs: number | null;
    quality: RuleQualityLabel;
    reason: string;
  };
  violations: {
    id: string;
    timestamp: string;
    file: string | null;
    message: string | null;
    severity: string | null;
    taskId: string | null;
    fixed: boolean;
    fixTimeMs: number | null;
  }[];
  trend: { week: string; matches: number; violations: number; fixes: number }[];
  topFiles: { file: string; violation_count: number; last_at: string }[];
}

export interface ProjectComparisonItem {
  projectId: string;
  projectName: string;
  totalEvents: number;
  ruleCount: number;
  itemCount: number;
  categoryDistribution: Record<string, number>;
  complianceRate: number;
  ruleRefIntensity: number;
  fixRate: number;
  avgFixTimeMs: number | null;
  maturityScore: number;
}

export interface ProjectComparisonResponse {
  projects: ProjectComparisonItem[];
}

// ─── Insights Types ─────────────────────────────────────

export type Phase = 'receive' | 'plan' | 'explore' | 'rule_check' | 'implement' | 'verify' | 'complete' | 'other';

export interface ViolationCluster {
  rule: string;
  count: number;
  examples: string[];
}

export interface HotspotFile {
  file: string;
  totalViolations: number;
  rules: Record<string, number>;
}

export interface RuleCoOccurrence {
  ruleA: string;
  ruleB: string;
  count: number;
}

export interface ViolationStory {
  taskId: string;
  durationSec: number;
  steps: {
    action: string;
    phase: Phase;
    ruleId: string | null;
    kind: 'match' | 'violation' | 'fix' | null;
    timestamp: string;
  }[];
  violationCount: number;
  resolved: boolean;
}

export interface BehaviorFlowItem {
  phase: Phase;
  totalEvents: number;
  avgPerTask: number;
}

export interface DurationBucket {
  bucket: string;
  count: number;
}

export interface PhaseTimeItem {
  phase: Phase;
  timeMs: number;
  percentage: number;
}

export interface HourlyItem {
  hour: number;
  count: number;
}

export interface ComplexityItem {
  taskId: string;
  events: number;
  files: number;
  durationMin: number;
}

export interface DailyProductivityItem {
  date: string;
  tasks: number;
  events: number;
}

export interface AnalyticsInsightsResponse {
  violationClusters: ViolationCluster[];
  hotspotFiles: HotspotFile[];
  ruleCoOccurrence: RuleCoOccurrence[];
  violationStories: ViolationStory[];
  behaviorFlow: BehaviorFlowItem[];
  durationDistribution: DurationBucket[];
  phaseTimeDistribution: PhaseTimeItem[];
  hourlyDistribution: HourlyItem[];
  complexityData: ComplexityItem[];
  dailyProductivity: DailyProductivityItem[];
}

// ─── Deep Comparison Types ──────────────────────────────

export interface ProjectProfileData {
  totalEvents: number;
  totalTasks: number;
  totalFiles: number;
  ruleCount: number;
  itemCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  activeDays: number;
  avgEventsPerDay: number;
  dailySparkline: { date: string; count: number }[];
}

export interface WorkflowDNAItem {
  phase: Phase;
  eventRatio: number;
  timeRatio: number;
}

export interface TaskProfileData {
  avgDurationMin: number;
  avgEventsPerTask: number;
  avgFilesPerTask: number;
  durationDistribution: DurationBucket[];
}

export interface RuleComplianceData {
  matchCount: number;
  violationCount: number;
  fixCount: number;
  complianceRate: number;
  topViolatedRules: { ruleId: string; count: number }[];
}

export interface DeepProjectData {
  projectId: string;
  projectName: string;
  agent: AgentType;
  profile: ProjectProfileData;
  workflowDNA: WorkflowDNAItem[];
  taskProfile: TaskProfileData;
  hourlyActivity: number[];
  ruleCompliance: RuleComplianceData;
}

export interface RuleHeatmapItem {
  ruleId: string;
  total: number;
  byProject: Record<string, number>;
}

export interface HourlyHeatmapItem {
  projectId: string;
  projectName: string;
  hours: number[];
}

export interface DeepComparisonResponse {
  projects: DeepProjectData[];
  productivityTimeline: Record<string, unknown>[];
  ruleHeatmap: RuleHeatmapItem[];
  hourlyHeatmap: HourlyHeatmapItem[];
}

export const api = {
  getInsights: () => request<InsightsResponse>('/insights'),
  getProjects: () => request<Project[]>('/projects'),
  getProject: (id: string) => request<Project & { rules: Rule[] }>(`/projects/${id}`),
  getRules: (projectId: string) => request<Rule[]>(`/projects/${projectId}/rules`),
  getRuleContent: (projectId: string, ruleId: string) =>
    request<{ title: string; body: string }>(`/projects/${projectId}/rules/${ruleId}/content`),

  getEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<RuleEvent[]>(`/events${qs}`);
  },

  getEventDates: (projectId: string) =>
    request<{ date: string; count: number }[]>(`/events/dates?projectId=${projectId}`),

  createProject: (data: { name: string; description?: string; rulesPath?: string; agent?: AgentType }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  updateProject: (id: string, data: { name: string; description?: string; rulesPath?: string; agent?: AgentType }) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

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

  // Detail Keywords
  getKeywords: (projectId: string) =>
    request<DetailKeyword[]>(`/projects/${projectId}/action-registry/keywords`),

  createKeyword: (projectId: string, data: { keyword: string; category: string }) =>
    request<DetailKeyword>(`/projects/${projectId}/action-registry/keywords`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateKeyword: (projectId: string, id: number, data: Partial<Pick<DetailKeyword, 'keyword' | 'category'>>) =>
    request<DetailKeyword>(`/projects/${projectId}/action-registry/keywords/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteKeyword: (projectId: string, id: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/action-registry/keywords/${id}`, { method: 'DELETE' }),

  // Analytics
  getAnalyticsRuleEffectiveness: (projectId: string, params?: { ruleId?: string; days?: number }) => {
    const qs = new URLSearchParams({ projectId });
    if (params?.ruleId) qs.set('ruleId', params.ruleId);
    if (params?.days) qs.set('days', String(params.days));
    return request<RuleEffectivenessResponse>(`/analytics/rules/effectiveness?${qs}`);
  },

  getAnalyticsRuleQuality: (projectId: string) =>
    request<RuleQualityResponse>(`/analytics/rules/quality?projectId=${projectId}`),

  getAnalyticsAgentEfficiency: (projectId: string, params?: { days?: number }) => {
    const qs = new URLSearchParams({ projectId });
    if (params?.days) qs.set('days', String(params.days));
    return request<AgentEfficiencyResponse>(`/analytics/agent/efficiency?${qs}`);
  },

  getAnalyticsRuleDetail: (projectId: string, ruleId: string) =>
    request<RuleDetailResponse>(`/analytics/rules/${ruleId}?projectId=${projectId}`),

  getAnalyticsCompare: (projectIds?: string[]) => {
    const qs = projectIds ? `?projectIds=${projectIds.join(',')}` : '';
    return request<ProjectComparisonResponse>(`/analytics/compare${qs}`);
  },

  getAnalyticsInsights: (projectId: string, params?: { days?: number }) => {
    const qs = new URLSearchParams({ projectId });
    if (params?.days) qs.set('days', String(params.days));
    return request<AnalyticsInsightsResponse>(`/analytics/insights?${qs}`);
  },

  getAnalyticsCompareDeep: (projectIds?: string[]) => {
    const qs = projectIds ? `?projectIds=${projectIds.join(',')}` : '';
    return request<DeepComparisonResponse>(`/analytics/compare/deep${qs}`);
  },
};
