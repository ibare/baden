import { Router } from 'express';
import { processEvent } from '../services/event-processor.js';
import type { QueryInput, EventInput, EventType, Severity } from '../types.js';

export const queryRouter = Router();

/**
 * 자유 서술 action 텍스트를 이벤트 타입으로 추론한다.
 * 키워드 매칭 — 먼저 매칭되는 규칙이 우선.
 */
const ACTION_PATTERNS: [RegExp, EventType][] = [
  // rule compliance
  [/\bviolation|위반.*발견/i, 'violation_found'],
  [/\bfix.?appli|위반.*수정|위반.*fix/i, 'fix_applied'],
  [/\brule.?match|규칙.*참조|규칙.*준수/i, 'rule_match'],
  // debugging
  [/\berror.?encounter|오류.*발생|exception|crash|fail(?!ed\s*0)/i, 'error_encountered'],
  [/\berror.?resolv|오류.*해결|오류.*수정|bug.?fix/i, 'error_resolved'],
  // verification
  [/\btest|테스트/i, 'test_run'],
  [/\bbuild|빌드|tsc|compil/i, 'build_run'],
  [/\blint|format|prettier|eslint/i, 'lint_run'],
  // exploration
  [/\bsearch|grep|find.*symbol|검색|찾/i, 'code_search'],
  [/\bread.*(?:doc|readme|api)|문서.*(?:읽|참조|확인)/i, 'doc_read'],
  [/\bdependenc|package\.json|requirements|의존/i, 'dependency_check'],
  [/\bread|읽/i, 'file_read'],
  // planning
  [/\btask.?complete|작업.*완료|작업.*마침/i, 'task_complete'],
  [/\banalyz|분석|요구사항|task.*break/i, 'task_analysis'],
  [/\bdecid|결정|approach|방식.*선택/i, 'approach_decision'],
  // implementation
  [/\bcreate|생성|새.*파일|new.*file|adding.*file/i, 'code_create'],
  [/\brefactor|리팩/i, 'refactor'],
  [/\bconfig|설정.*파일|\.json|\.yaml|\.env/i, 'file_write'],
  [/\bmodif|edit|updat|chang|수정|변경|추가|삭제|remov|delet|writ/i, 'code_modify'],
];

function inferEventType(action: string, phase?: string): EventType {
  // 정확히 알려진 이벤트 타입이면 그대로 사용
  for (const [, type] of ACTION_PATTERNS) {
    if (action === type) return type;
  }

  // 키워드 패턴 매칭
  for (const [pattern, type] of ACTION_PATTERNS) {
    if (pattern.test(action)) return type;
  }

  // phase로 fallback 추론
  if (phase) {
    const p = phase.toLowerCase();
    if (/explor|탐색/.test(p)) return 'file_read';
    if (/plan|계획|분석/.test(p)) return 'task_analysis';
    if (/implement|구현/.test(p)) return 'code_modify';
    if (/verif|검증|test/.test(p)) return 'test_run';
    if (/debug|디버/.test(p)) return 'error_encountered';
  }

  return 'query';
}

// POST /api/query - Query 프로토콜 수신
queryRouter.post('/', (req, res) => {
  try {
    const q: QueryInput = req.body;

    if (!q.projectId || !q.action) {
      res.status(400).json({ error: 'projectId and action are required' });
      return;
    }

    const eventType = inferEventType(q.action, q.phase);
    console.log(`[Query] action="${q.action}" → type=${eventType}`);

    const input: EventInput = {
      type: eventType,
      projectId: q.projectId,
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
    console.error(`[Query] Error: ${message}`);
    res.status(500).json({ error: message });
  }
});
