export type EventCategory =
  | 'user'
  | 'exploration'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'debugging'
  | 'rule_compliance';

export const EVENT_CATEGORY_MAP: Record<string, EventCategory> = {
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

export const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  // exploration
  code_search: { icon: '⌕', color: 'text-teal-600' },
  doc_read: { icon: '📄', color: 'text-teal-600' },
  dependency_check: { icon: '📦', color: 'text-teal-600' },
  file_read: { icon: '◇', color: 'text-teal-600' },
  // planning
  task_analysis: { icon: '🧠', color: 'text-purple-600' },
  approach_decision: { icon: '⑂', color: 'text-purple-600' },
  task_complete: { icon: '✔', color: 'text-purple-600' },
  // implementation
  code_create: { icon: '＋', color: 'text-orange-600' },
  code_modify: { icon: '✎', color: 'text-orange-600' },
  refactor: { icon: '⟲', color: 'text-orange-600' },
  file_write: { icon: '◆', color: 'text-orange-600' },
  // verification
  test_run: { icon: '⚡', color: 'text-yellow-600' },
  build_run: { icon: '🔧', color: 'text-yellow-600' },
  lint_run: { icon: '✦', color: 'text-yellow-600' },
  // debugging
  error_encountered: { icon: '✕', color: 'text-amber-600' },
  error_resolved: { icon: '✓', color: 'text-emerald-600' },
  // rule_compliance
  rule_match: { icon: '◎', color: 'text-rose-600' },
  violation_found: { icon: '⊘', color: 'text-rose-600' },
  fix_applied: { icon: '✓', color: 'text-green-600' },
  // query protocol
  query: { icon: '▸', color: 'text-cyan-600' },
};

export interface EventTypeGroup {
  label: string;
  types: string[];
}

export const EVENT_TYPE_GROUPS: EventTypeGroup[] = [
  { label: 'Exploration', types: ['code_search', 'doc_read', 'dependency_check', 'file_read'] },
  { label: 'Planning', types: ['task_analysis', 'approach_decision', 'task_complete'] },
  { label: 'Implementation', types: ['code_create', 'code_modify', 'refactor', 'file_write'] },
  { label: 'Verification', types: ['test_run', 'build_run', 'lint_run'] },
  { label: 'Debugging', types: ['error_encountered', 'error_resolved'] },
  { label: 'Rules', types: ['rule_match', 'violation_found', 'fix_applied'] },
];

export const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string }> = {
  user: { label: 'User', color: 'blue' },
  exploration: { label: 'Exploration', color: 'teal' },
  planning: { label: 'Planning', color: 'purple' },
  implementation: { label: 'Implementation', color: 'orange' },
  verification: { label: 'Verification', color: 'yellow' },
  debugging: { label: 'Debugging', color: 'amber' },
  rule_compliance: { label: 'Rules', color: 'rose' },
};
