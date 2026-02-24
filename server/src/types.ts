export type EventType =
  // exploration
  | 'code_search'
  | 'doc_read'
  | 'dependency_check'
  | 'file_read'
  // planning
  | 'task_analysis'
  | 'approach_decision'
  // implementation
  | 'code_create'
  | 'code_modify'
  | 'refactor'
  | 'file_write'
  // verification
  | 'test_run'
  | 'build_run'
  | 'lint_run'
  // debugging
  | 'error_encountered'
  | 'error_resolved'
  // rule_compliance
  | 'rule_match'
  | 'violation_found'
  | 'fix_applied'
  // completion
  | 'task_complete'
  // query protocol
  | 'query';

export type EventCategory =
  | 'exploration'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'debugging'
  | 'rule_compliance';

export const EVENT_CATEGORY_MAP: Record<EventType, EventCategory> = {
  code_search: 'exploration',
  doc_read: 'exploration',
  dependency_check: 'exploration',
  file_read: 'exploration',
  task_analysis: 'planning',
  approach_decision: 'planning',
  code_create: 'implementation',
  code_modify: 'implementation',
  refactor: 'implementation',
  file_write: 'implementation',
  test_run: 'verification',
  build_run: 'verification',
  lint_run: 'verification',
  error_encountered: 'debugging',
  error_resolved: 'debugging',
  rule_match: 'rule_compliance',
  violation_found: 'rule_compliance',
  fix_applied: 'rule_compliance',
  task_complete: 'planning',
  query: 'exploration',
};

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type RuleCategory = 'always' | 'concerns' | 'specifics';

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
  category: RuleCategory;
  file_path: string;
  description: string | null;
  triggers: string | null;
  content_hash: string | null;
  parsed_at: string;
}

export interface RuleEvent {
  id: string;
  timestamp: string;
  type: EventType;
  project_id: string;
  rule_id: string | null;
  severity: Severity | null;
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

export interface EventInput {
  type: EventType;
  projectId: string;
  ruleId?: string;
  severity?: Severity;
  file?: string;
  line?: number;
  message?: string;
  detail?: string;
  action?: string;
  agent?: string;
  step?: string;
  durationMs?: number;
  prompt?: string;
  summary?: string;
  result?: string;
  taskId?: string;
}

export interface QueryInput {
  projectId: string;
  phase?: string;
  action: string;
  target?: string;
  reason?: string;
  ruleId?: string;
  severity?: string;
  agent?: string;
  prompt?: string;
  summary?: string;
  result?: string;
  taskId?: string;
}

export interface ParsedRule {
  id: string;
  category: RuleCategory;
  filePath: string;
  description: string | null;
  triggers: {
    paths?: string[];
    patterns?: string[];
    imports?: string[];
    events?: string[];
  } | null;
  contentHash: string;
}

export interface IndexYamlEntry {
  id?: string;
  file: string;
  description?: string;
  triggers?: {
    paths?: string[];
    patterns?: string[];
    imports?: string[];
    events?: string[];
  };
}

export interface IndexYaml {
  always?: IndexYamlEntry[];
  concerns?: IndexYamlEntry[];
  specifics?: IndexYamlEntry[];
}
