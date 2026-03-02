import { Router } from 'express';
import { processEvent } from '../services/event-processor.js';
import { getProjectIdByName } from '../db/connection.js';
import { log, error as logError } from '../logger.js';
import type { QueryInput, EventInput, EventType, Severity } from '../types.js';

export const queryRouter = Router();

/**
 * 단어 → EventType 사전.
 * action을 _로 split 후 앞에서부터 순회, 첫 매칭 단어의 EventType을 반환.
 */
const WORD_TO_TYPE: Record<string, EventType> = {
  // rule_compliance
  rule: 'rule_match',
  violation: 'rule_match',
  check: 'rule_match',
  verify: 'build_run',
  test: 'build_run',
  build: 'build_run',
  typecheck: 'build_run',
  lint: 'build_run',
  validate: 'build_run',
  // planning
  plan: 'task_analysis',
  analyze: 'task_analysis',
  review: 'task_analysis',
  decide: 'task_analysis',
  receive: 'task_analysis',
  task: 'task_analysis',
  compile: 'task_analysis',
  synthesize: 'task_analysis',
  finalize: 'task_analysis',
  confirm: 'task_analysis',
  report: 'task_analysis',
  adjust: 'task_analysis',
  // exploration
  read: 'file_read',
  search: 'file_read',
  scan: 'file_read',
  find: 'file_read',
  trace: 'file_read',
  list: 'file_read',
  identify: 'file_read',
  understand: 'file_read',
  // implementation
  create: 'code_create',
  modify: 'code_modify',
  edit: 'code_modify',
  delete: 'code_modify',
  rewrite: 'code_modify',
  add: 'code_modify',
  implement: 'code_modify',
  update: 'code_modify',
  write: 'code_modify',
  fix: 'code_modify',
  harden: 'code_modify',
  protect: 'code_modify',
  apply: 'code_modify',
  start: 'code_modify',
  continue: 'code_modify',
  skip: 'code_modify',
};

/** run은 skip word — 다음 단어로 위임 */
const SKIP_WORDS = new Set(['run']);

function inferEventType(action: string, _phase?: string, ruleId?: string): EventType {
  // 정확히 알려진 EventType이면 그대로 사용
  if (action in WORD_TO_TYPE && !action.includes('_')) {
    return WORD_TO_TYPE[action];
  }

  // _로 분해 후 앞에서부터 순회
  const words = action.toLowerCase().split('_');
  for (const word of words) {
    if (SKIP_WORDS.has(word)) continue;
    const type = WORD_TO_TYPE[word];
    if (type) return type;
  }

  // 매칭 없으면: rule_id 존재 시 → rule_match
  if (ruleId) return 'rule_match';

  return 'query';
}

// POST /api/query - Query 프로토콜 수신
queryRouter.post('/', (req, res) => {
  try {
    const q: QueryInput = req.body;

    if (!q.action || !q.projectName) {
      log('Query', `SKIP missing=${!q.action ? 'action' : 'projectName'} received=${JSON.stringify(q)}`);
      res.json({ ok: true });
      return;
    }

    // Resolve projectId via projectName lookup
    const projectId = getProjectIdByName(q.projectName);
    if (!projectId) {
      log('Query', `SKIP project="${q.projectName}" not registered action="${q.action}"`);
      res.json({ ok: true });
      return;
    }

    const eventType = inferEventType(q.action, q.phase, q.ruleId);
    log('Query', `project="${q.projectName}" action="${q.action}" → ${eventType}${q.ruleId ? ` rule=${q.ruleId}` : ''}${q.target ? ` target=${q.target}` : ''}`);

    const input: EventInput = {
      type: eventType,
      projectId,
      step: q.phase,
      action: q.action,
      file: q.target,
      message: q.reason,
      detail: JSON.stringify(q),
      ruleId: q.ruleId,
      severity: q.severity as Severity | undefined,
      agent: q.agent,
      prompt: q.prompt,
      summary: q.summary,
      result: q.result,
      taskId: q.taskId,
    };
    processEvent(input);

    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('Query', message);
    res.status(500).json({ error: message });
  }
});
