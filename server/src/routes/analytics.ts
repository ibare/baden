import { Router } from 'express';
import db from '../db/connection.js';
import {
  resolveRuleId,
  collectRuleIdChain,
  getAliasMap,
  getRemovedRuleIds,
} from '../services/rule-sync.js';

export const analyticsRouter = Router();

// ─── 공통 타입 ─────────────────────────────────────────

interface RuleEventRow {
  rule_id: string;
  action: string;
  type: string;
  timestamp: string;
  file: string | null;
  task_id: string | null;
  week: string;
}

interface RuleRow {
  id: string;
  category: string;
  file_path: string;
  description: string | null;
  triggers: string | null;
  item_count: number;
}

type RuleQualityLabel = 'healthy' | 'dormant' | 'ineffective' | 'over_triggered';
type RuleEventKind = 'match' | 'violation' | 'fix';

// ─── action 기반 이벤트 분류 ───────────────────────────
//
// MCP 도구가 이벤트를 저장할 때 type 필드가 일관되지 않음 (대부분 'query').
// 실제 의미는 action 필드에 있으므로 action 패턴으로 분류한다.
// - match: check_rule, rule_pass, rule_guard_* 등 규칙 검토/통과
// - violation: violation_*, grep_violation_* 등 위반 발견
// - fix: fix_* 등 수정 적용
// - type 기반 fallback: type이 정확히 rule_match/violation_found/fix_applied인 경우

function classifyRuleEvent(action: string | null, type: string): RuleEventKind {
  if (action) {
    const a = action.toLowerCase();
    // violation 패턴 (rule_violation, violation_found 등)
    if (a.includes('violation')) return 'violation';
    // fix 패턴 (fix_*, modify_fix_*, modify_marker_add_rule_violation은 위에서 걸림)
    if (a.startsWith('fix_') || a === 'fix') return 'fix';
    // match 패턴 (check_rule, rule_pass, rule_guard 등)
    if (a.startsWith('check_') || a.startsWith('rule_')) return 'match';
  }
  // type 기반 fallback (향후 올바르게 저장되는 데이터용)
  if (type === 'violation_found') return 'violation';
  if (type === 'fix_applied') return 'fix';
  if (type === 'rule_match') return 'match';
  return 'match';
}

// ─── 공통 쿼리 헬퍼 ────────────────────────────────────

function getRuleEvents(projectId: string, days: number): RuleEventRow[] {
  const sql = days > 0
    ? `SELECT rule_id, action, type, timestamp, file, task_id,
         strftime('%Y-W%W', timestamp) as week
       FROM events
       WHERE project_id = ? AND rule_id IS NOT NULL
         AND timestamp >= datetime('now', '-${days} days')
       ORDER BY timestamp`
    : `SELECT rule_id, action, type, timestamp, file, task_id,
         strftime('%Y-W%W', timestamp) as week
       FROM events
       WHERE project_id = ? AND rule_id IS NOT NULL
       ORDER BY timestamp`;
  return db.prepare(sql).all(projectId) as RuleEventRow[];
}

interface RuleCountMap {
  counts: Map<string, { match: number; violation: number; fix: number }>;
  weekly: Map<string, Map<string, { matches: number; violations: number; fixes: number }>>;
  repeats: Map<string, number>;
  avgFixMs: Map<string, number>;
  lastMatch: Map<string, string>;
  lastViolation: Map<string, string>;
}

function buildRuleCountMap(rows: RuleEventRow[]): RuleCountMap {
  const counts = new Map<string, { match: number; violation: number; fix: number }>();
  const weekly = new Map<string, Map<string, { matches: number; violations: number; fixes: number }>>();
  const fileViolations = new Map<string, Map<string, number>>(); // rule_id -> file -> count
  const lastMatch = new Map<string, string>();
  const lastViolation = new Map<string, string>();

  // violation→fix 시간 추적: task_id+rule_id → violation timestamp
  const violationTimes = new Map<string, string[]>(); // key → timestamps
  const fixTimes: { ruleId: string; fixMs: number }[] = [];

  for (const row of rows) {
    const kind = classifyRuleEvent(row.action, row.type);
    const ruleId = row.rule_id;

    // 카운트
    if (!counts.has(ruleId)) counts.set(ruleId, { match: 0, violation: 0, fix: 0 });
    const c = counts.get(ruleId)!;
    c[kind]++;

    // 주간 추이
    if (!weekly.has(ruleId)) weekly.set(ruleId, new Map());
    const weekMap = weekly.get(ruleId)!;
    if (!weekMap.has(row.week)) weekMap.set(row.week, { matches: 0, violations: 0, fixes: 0 });
    const w = weekMap.get(row.week)!;
    if (kind === 'match') w.matches++;
    else if (kind === 'violation') w.violations++;
    else if (kind === 'fix') w.fixes++;

    // 마지막 이벤트 날짜
    if (kind === 'match') lastMatch.set(ruleId, row.timestamp);
    else if (kind === 'violation') lastViolation.set(ruleId, row.timestamp);

    // 반복 위반 파일 추적
    if (kind === 'violation' && row.file) {
      if (!fileViolations.has(ruleId)) fileViolations.set(ruleId, new Map());
      const fm = fileViolations.get(ruleId)!;
      fm.set(row.file, (fm.get(row.file) ?? 0) + 1);
    }

    // fix 시간 계산용 추적
    if (kind === 'violation' && row.task_id) {
      const key = `${row.task_id}:${ruleId}`;
      if (!violationTimes.has(key)) violationTimes.set(key, []);
      violationTimes.get(key)!.push(row.timestamp);
    }
    if (kind === 'fix' && row.task_id) {
      const key = `${row.task_id}:${ruleId}`;
      const vTimes = violationTimes.get(key);
      if (vTimes && vTimes.length > 0) {
        // 가장 최근 violation과 매칭
        const vTime = vTimes[vTimes.length - 1];
        const ms = new Date(row.timestamp).getTime() - new Date(vTime).getTime();
        if (ms > 0) fixTimes.push({ ruleId, fixMs: ms });
      }
    }
  }

  // 반복 위반 수 (동일 rule+file 2회 이상인 파일 수)
  const repeats = new Map<string, number>();
  for (const [ruleId, fm] of fileViolations) {
    let count = 0;
    for (const cnt of fm.values()) {
      if (cnt > 1) count++;
    }
    if (count > 0) repeats.set(ruleId, count);
  }

  // 평균 fix 시간
  const fixByRule = new Map<string, number[]>();
  for (const { ruleId, fixMs } of fixTimes) {
    if (!fixByRule.has(ruleId)) fixByRule.set(ruleId, []);
    fixByRule.get(ruleId)!.push(fixMs);
  }
  const avgFixMs = new Map<string, number>();
  for (const [ruleId, times] of fixByRule) {
    avgFixMs.set(ruleId, times.reduce((a, b) => a + b, 0) / times.length);
  }

  return { counts, weekly, repeats, avgFixMs, lastMatch, lastViolation };
}

function getProjectRules(projectId: string) {
  return db.prepare(
    "SELECT id, category, file_path, description, triggers, item_count FROM rules WHERE project_id = ? AND status = 'active'",
  ).all(projectId) as RuleRow[];
}

/** 규칙 상세는 삭제된 규칙도 조회한다 — 과거 이벤트에서 도달하는 경로가 있다 */
const selectRuleDetail = db.prepare(`
  SELECT id, category, file_path, description, triggers, item_count, status
  FROM rules WHERE id = ? AND project_id = ?
`);

const selectRuleDetailEvents = db.prepare(`
  SELECT id, action, type, timestamp, file, message, severity, task_id,
    strftime('%Y-W%W', timestamp) as week
  FROM events
  WHERE project_id = ? AND rule_id = ?
  ORDER BY timestamp
`);

// ─── 1. GET /rules/effectiveness ────────────────────────

analyticsRouter.get('/rules/effectiveness', (req, res) => {
  try {
    const { projectId, ruleId, days: daysParam } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    const days = daysParam ? Number(daysParam) : 90;

    const rules = getProjectRules(projectId);
    const rows = getRuleEvents(projectId, days);
    const { counts: countMap, weekly, repeats: repeatMap, avgFixMs } = buildRuleCountMap(rows);

    const targetRules = ruleId ? rules.filter((r) => r.id === ruleId) : rules;

    const result = targetRules.map((rule) => {
      const counts = countMap.get(rule.id) ?? { match: 0, violation: 0, fix: 0 };
      const trend = weekly.get(rule.id);
      const trendArr = trend
        ? [...trend.entries()].map(([week, v]) => ({ week, ...v }))
        : [];

      return {
        ruleId: rule.id,
        description: rule.description,
        category: rule.category,
        itemCount: rule.item_count,
        matchCount: counts.match,
        violationCount: counts.violation,
        fixCount: counts.fix,
        violationRate: counts.match > 0 ? counts.violation / counts.match : 0,
        fixRate: counts.violation > 0 ? counts.fix / counts.violation : 0,
        avgFixTimeMs: avgFixMs.get(rule.id) ?? null,
        trend: trendArr,
        repeatedViolations: repeatMap.get(rule.id) ?? 0,
      };
    });

    res.json({ rules: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── 2. GET /rules/quality ──────────────────────────────

analyticsRouter.get('/rules/quality', (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    const rules = getProjectRules(projectId);
    const rows = getRuleEvents(projectId, 0); // 전체 기간
    const { counts: countMap, repeats: repeatMap, avgFixMs, lastMatch: lastMatchMap, lastViolation: lastViolationMap } = buildRuleCountMap(rows);

    const summary: Record<RuleQualityLabel, number> = {
      healthy: 0,
      dormant: 0,
      ineffective: 0,
      over_triggered: 0,
    };

    const result = rules.map((rule) => {
      const counts = countMap.get(rule.id) ?? { match: 0, violation: 0, fix: 0 };
      const avgFixTimeMs = avgFixMs.get(rule.id) ?? null;
      const repeatFiles = repeatMap.get(rule.id) ?? 0;
      const violationRate = counts.match > 0 ? counts.violation / counts.match : 0;

      // 품질 판정
      let quality: RuleQualityLabel = 'healthy';
      let reason = '정상 운영 중';

      if (counts.match > 0 && counts.violation === 0) {
        quality = 'dormant';
        reason = `매칭 ${counts.match}건이지만 위반 0건 — PREFER로 완화 검토`;
      } else if (
        repeatFiles >= 3 ||
        (counts.violation > 5 && avgFixTimeMs !== null && avgFixTimeMs > 300000)
      ) {
        quality = 'ineffective';
        reason = repeatFiles >= 3
          ? `${repeatFiles}개 파일에서 반복 위반 — 규칙 문구 개선 필요`
          : `위반 ${counts.violation}건, 평균 수정 ${Math.round((avgFixTimeMs ?? 0) / 1000)}초 — 규칙 명확성 부족`;
      } else if (counts.match >= 20 && violationRate < 0.05) {
        quality = 'over_triggered';
        reason = `매칭 ${counts.match}건 중 위반 ${counts.violation}건(${(violationRate * 100).toFixed(1)}%) — 트리거 정밀도 개선`;
      }

      summary[quality]++;

      return {
        ruleId: rule.id,
        description: rule.description,
        category: rule.category,
        itemCount: rule.item_count,
        quality,
        reason,
        matchCount: counts.match,
        violationCount: counts.violation,
        fixCount: counts.fix,
        lastMatchAt: lastMatchMap.get(rule.id) ?? null,
        lastViolationAt: lastViolationMap.get(rule.id) ?? null,
        avgFixTimeMs,
      };
    });

    res.json({ rules: result, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── 3. GET /agent/efficiency ───────────────────────────

analyticsRouter.get('/agent/efficiency', (req, res) => {
  try {
    const { projectId, days: daysParam } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    const days = daysParam ? Number(daysParam) : 90;

    const timeFilter = days > 0
      ? `AND timestamp >= datetime('now', '-${days} days')`
      : '';

    // 태스크별 전체 이벤트 (action 기반 분류 필요)
    const taskEvents = db.prepare(`
      SELECT task_id, action, type, timestamp, rule_id,
        strftime('%Y-W%W', timestamp) as week
      FROM events
      WHERE project_id = ? AND task_id IS NOT NULL ${timeFilter}
      ORDER BY timestamp
    `).all(projectId) as {
      task_id: string; action: string; type: string;
      timestamp: string; rule_id: string | null; week: string;
    }[];

    // 태스크별 집계
    const taskMap = new Map<string, {
      startedAt: string; completedAt: string;
      eventCount: number; violations: number; fixes: number;
    }>();

    // 주간 집계
    const weekMap = new Map<string, { tasks: Set<string>; violations: number; fixes: number }>();

    // fix 시간 추적
    const violationTimes = new Map<string, string>(); // task+rule → timestamp
    const fixTimesAll: number[] = [];

    for (const row of taskEvents) {
      // 태스크별
      if (!taskMap.has(row.task_id)) {
        taskMap.set(row.task_id, {
          startedAt: row.timestamp, completedAt: row.timestamp,
          eventCount: 0, violations: 0, fixes: 0,
        });
      }
      const t = taskMap.get(row.task_id)!;
      t.eventCount++;
      if (row.timestamp > t.completedAt) t.completedAt = row.timestamp;

      // action 기반 분류 (rule_id 유무와 무관하게)
      const kind = classifyRuleEvent(row.action, row.type);
      if (kind === 'violation') {
        t.violations++;
        const vKey = row.rule_id ? `${row.task_id}:${row.rule_id}` : `${row.task_id}:_`;
        violationTimes.set(vKey, row.timestamp);
      } else if (kind === 'fix') {
        t.fixes++;
        // violation→fix 시간 계산: 같은 task의 마지막 violation과 매칭
        const vKey = row.rule_id ? `${row.task_id}:${row.rule_id}` : `${row.task_id}:_`;
        const vTime = violationTimes.get(vKey);
        if (vTime) {
          const ms = new Date(row.timestamp).getTime() - new Date(vTime).getTime();
          if (ms > 0) fixTimesAll.push(ms);
        }
      }

      // 주간별
      if (!weekMap.has(row.week)) weekMap.set(row.week, { tasks: new Set(), violations: 0, fixes: 0 });
      const w = weekMap.get(row.week)!;
      w.tasks.add(row.task_id);
      if (kind === 'violation') w.violations++;
      else if (kind === 'fix') w.fixes++;
    }

    const taskBreakdown = [...taskMap.entries()].map(([taskId, t]) => ({
      taskId,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      eventCount: t.eventCount,
      violationCount: t.violations,
      fixCount: t.fixes,
      fixRate: t.violations > 0 ? t.fixes / t.violations : 0,
    })).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    const totalTasks = taskBreakdown.length;
    const totalViolations = taskBreakdown.reduce((s, t) => s + t.violationCount, 0);
    const totalFixes = taskBreakdown.reduce((s, t) => s + t.fixCount, 0);
    const avgFixTimeMs = fixTimesAll.length > 0
      ? fixTimesAll.reduce((a, b) => a + b, 0) / fixTimesAll.length
      : null;

    const weeklyTrend = [...weekMap.entries()]
      .map(([week, w]) => ({ week, tasks: w.tasks.size, violations: w.violations, fixes: w.fixes }))
      .sort((a, b) => a.week.localeCompare(b.week));

    res.json({
      summary: {
        totalTasks,
        totalViolations,
        totalFixes,
        violationRate: totalTasks > 0 ? totalViolations / totalTasks : 0,
        fixSuccessRate: totalViolations > 0 ? totalFixes / totalViolations : 0,
        avgFixTimeMs,
      },
      taskBreakdown,
      trend: weeklyTrend,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── 4. GET /rules/:ruleId ──────────────────────────────

analyticsRouter.get('/rules/:ruleId', (req, res) => {
  try {
    const { ruleId } = req.params;
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    // 이름이 바뀐 규칙은 옛 id로 들어와도 현재 규칙으로 해석한다
    const resolvedId = resolveRuleId(projectId, ruleId);
    const rule = selectRuleDetail.get(resolvedId, projectId) as
      (RuleRow & { status: string }) | undefined;

    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    // action 기반 분류를 위해 원시 이벤트 조회. 옛 id로 쌓인 이벤트까지 모은다
    const chainIds = collectRuleIdChain(projectId, resolvedId);
    const ruleEvents = chainIds
      .flatMap((id) => selectRuleDetailEvents.all(projectId, id) as {
        id: string; action: string; type: string; timestamp: string;
        file: string | null; message: string | null; severity: string | null;
        task_id: string | null; week: string;
      }[])
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const counts = { match: 0, violation: 0, fix: 0 };
    const trendMap = new Map<string, { matches: number; violations: number; fixes: number }>();
    const fileViolationCount = new Map<string, number>();
    const fileLastAt = new Map<string, string>();
    const violationEvents: typeof ruleEvents = [];
    const violationTimes = new Map<string, string>(); // task_id → timestamp
    const fixTimesArr: number[] = [];

    for (const row of ruleEvents) {
      const kind = classifyRuleEvent(row.action, row.type);
      counts[kind]++;

      // 주간 추이
      if (!trendMap.has(row.week)) trendMap.set(row.week, { matches: 0, violations: 0, fixes: 0 });
      const w = trendMap.get(row.week)!;
      if (kind === 'match') w.matches++;
      else if (kind === 'violation') w.violations++;
      else if (kind === 'fix') w.fixes++;

      if (kind === 'violation') {
        violationEvents.push(row);
        if (row.file) {
          fileViolationCount.set(row.file, (fileViolationCount.get(row.file) ?? 0) + 1);
          fileLastAt.set(row.file, row.timestamp);
        }
        if (row.task_id) violationTimes.set(row.task_id, row.timestamp);
      }
      if (kind === 'fix' && row.task_id) {
        const vTime = violationTimes.get(row.task_id);
        if (vTime) {
          const ms = new Date(row.timestamp).getTime() - new Date(vTime).getTime();
          if (ms > 0) fixTimesArr.push(ms);
        }
      }
    }

    const avgFixTimeMs = fixTimesArr.length > 0
      ? fixTimesArr.reduce((a, b) => a + b, 0) / fixTimesArr.length
      : null;

    // 품질 판정
    const repeatFiles = [...fileViolationCount.values()].filter((c) => c > 1).length;
    const violationRate = counts.match > 0 ? counts.violation / counts.match : 0;

    let quality: RuleQualityLabel = 'healthy';
    let reason = '정상 운영 중';
    if (counts.match > 0 && counts.violation === 0) {
      quality = 'dormant';
      reason = `매칭 ${counts.match}건이지만 위반 0건`;
    } else if (repeatFiles >= 3 || (counts.violation > 5 && avgFixTimeMs !== null && avgFixTimeMs > 300000)) {
      quality = 'ineffective';
      reason = repeatFiles >= 3
        ? `${repeatFiles}개 파일에서 반복 위반`
        : `위반 ${counts.violation}건, 평균 수정 ${Math.round((avgFixTimeMs ?? 0) / 1000)}초`;
    } else if (counts.match >= 20 && violationRate < 0.05) {
      quality = 'over_triggered';
      reason = `매칭 ${counts.match}건 중 위반율 ${(violationRate * 100).toFixed(1)}%`;
    }

    // 위반 이력 상세 (최근 100건)
    const recentViolations = violationEvents.slice(-100).reverse();
    const violationDetails = recentViolations.map((v) => {
      let fixed = false;
      let fixTimeMs: number | null = null;
      if (v.task_id) {
        const vTime = new Date(v.timestamp).getTime();
        // 같은 task 내에서 이후 fix 이벤트 찾기
        const fixEvent = ruleEvents.find((e) =>
          e.task_id === v.task_id &&
          classifyRuleEvent(e.action, e.type) === 'fix' &&
          new Date(e.timestamp).getTime() > vTime,
        );
        if (fixEvent) {
          fixed = true;
          fixTimeMs = new Date(fixEvent.timestamp).getTime() - vTime;
        }
      }
      return {
        id: v.id,
        timestamp: v.timestamp,
        file: v.file,
        message: v.message,
        severity: v.severity,
        taskId: v.task_id,
        fixed,
        fixTimeMs,
      };
    });

    // 상위 위반 파일
    const topFiles = [...fileViolationCount.entries()]
      .map(([file, violation_count]) => ({
        file,
        violation_count,
        last_at: fileLastAt.get(file) ?? '',
      }))
      .sort((a, b) => b.violation_count - a.violation_count)
      .slice(0, 10);

    res.json({
      rule: {
        id: rule.id,
        category: rule.category,
        filePath: rule.file_path,
        description: rule.description,
        triggers: rule.triggers ? JSON.parse(rule.triggers) : null,
        itemCount: rule.item_count,
        removed: rule.status === 'removed',
        aliases: chainIds.filter((id) => id !== rule.id),
      },
      stats: {
        matchCount: counts.match,
        violationCount: counts.violation,
        fixCount: counts.fix,
        avgFixTimeMs,
        quality,
        reason,
      },
      violations: violationDetails,
      trend: [...trendMap.entries()].map(([week, v]) => ({ week, ...v })),
      topFiles,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── 5. GET /compare ────────────────────────────────────

const TYPE_TO_CATEGORY: Record<string, string> = {
  code_search: 'exploration',
  doc_read: 'exploration',
  dependency_check: 'exploration',
  file_read: 'exploration',
  query: 'exploration',
  task_analysis: 'planning',
  approach_decision: 'planning',
  task_complete: 'planning',
  code_create: 'implementation',
  code_modify: 'implementation',
  refactor: 'implementation',
  file_write: 'implementation',
  test_run: 'rule_compliance',
  build_run: 'rule_compliance',
  lint_run: 'rule_compliance',
  rule_match: 'rule_compliance',
  violation_found: 'rule_compliance',
  fix_applied: 'rule_compliance',
};

const IMPLEMENTATION_TYPES = new Set(['code_create', 'code_modify', 'refactor', 'file_write']);

analyticsRouter.get('/compare', (req, res) => {
  try {
    const { projectIds } = req.query;
    const filterIds = projectIds && typeof projectIds === 'string'
      ? projectIds.split(',').map((s) => s.trim())
      : null;

    // 프로젝트 목록
    const projects = db.prepare('SELECT id, name FROM projects ORDER BY created_at DESC')
      .all() as { id: string; name: string }[];
    const targetProjects = filterIds
      ? projects.filter((p) => filterIds.includes(p.id))
      : projects;

    // 프로젝트별 규칙 수
    const ruleCounts = db.prepare(
      "SELECT project_id, COUNT(*) as group_count, COALESCE(SUM(item_count), 0) as item_count FROM rules WHERE status = 'active' GROUP BY project_id",
    ).all() as { project_id: string; group_count: number; item_count: number }[];
    const ruleMap = new Map(ruleCounts.map((r) => [r.project_id, r]));

    // 프로젝트별 타입 분포
    const typeDist = db.prepare(
      'SELECT project_id, type, COUNT(*) as count FROM events GROUP BY project_id, type',
    ).all() as { project_id: string; type: string; count: number }[];

    const typeDistMap = new Map<string, Map<string, number>>();
    const typeCountMap = new Map<string, Map<string, number>>();
    for (const row of typeDist) {
      // 카테고리별 집계
      const cat = TYPE_TO_CATEGORY[row.type] ?? 'exploration';
      if (!typeDistMap.has(row.project_id)) typeDistMap.set(row.project_id, new Map());
      const catMap = typeDistMap.get(row.project_id)!;
      catMap.set(cat, (catMap.get(cat) ?? 0) + row.count);

      // 타입별 원시 카운트
      if (!typeCountMap.has(row.project_id)) typeCountMap.set(row.project_id, new Map());
      typeCountMap.get(row.project_id)!.set(row.type, row.count);
    }

    // 프로젝트별 규칙 관련 카운트 (action 기반 분류)
    const allRuleEvents = db.prepare(`
      SELECT project_id, action, type
      FROM events
      WHERE rule_id IS NOT NULL
    `).all() as { project_id: string; action: string; type: string }[];

    const ruleEventMap = new Map<string, { match: number; violation: number; fix: number }>();
    for (const row of allRuleEvents) {
      if (!ruleEventMap.has(row.project_id)) ruleEventMap.set(row.project_id, { match: 0, violation: 0, fix: 0 });
      const kind = classifyRuleEvent(row.action, row.type);
      ruleEventMap.get(row.project_id)![kind]++;
    }

    // 프로젝트별 평균 수정 시간 (action 기반)
    const avgFixAllMap = new Map<string, number>();
    for (const p of targetProjects) {
      const rows = getRuleEvents(p.id, 0);
      const { avgFixMs } = buildRuleCountMap(rows);
      // 전체 규칙의 평균
      const allMs: number[] = [];
      for (const ms of avgFixMs.values()) allMs.push(ms);
      if (allMs.length > 0) {
        avgFixAllMap.set(p.id, allMs.reduce((a, b) => a + b, 0) / allMs.length);
      }
    }

    // 최대 refIntensity (정규화 기준)
    let maxRefIntensity = 0;

    const projectResults = targetProjects.map((p) => {
      const catDist = typeDistMap.get(p.id);
      const totalEvents = catDist
        ? [...catDist.values()].reduce((s, v) => s + v, 0)
        : 0;

      const categoryDistribution: Record<string, number> = {};
      if (catDist && totalEvents > 0) {
        for (const [cat, count] of catDist) {
          categoryDistribution[cat] = count / totalEvents;
        }
      }

      const ruleStats = ruleEventMap.get(p.id) ?? { match: 0, violation: 0, fix: 0 };
      const complianceRate = ruleStats.match > 0
        ? 1 - ruleStats.violation / ruleStats.match
        : 1;

      // 구현 이벤트 수
      const typeMap = typeCountMap.get(p.id);
      let implEvents = 0;
      if (typeMap) {
        for (const t of IMPLEMENTATION_TYPES) {
          implEvents += typeMap.get(t) ?? 0;
        }
      }

      const ruleRefIntensity = implEvents > 0 ? ruleStats.match / implEvents : 0;
      if (ruleRefIntensity > maxRefIntensity) maxRefIntensity = ruleRefIntensity;

      const ruleInfo = ruleMap.get(p.id);

      return {
        projectId: p.id,
        projectName: p.name,
        totalEvents,
        ruleCount: ruleInfo?.group_count ?? 0,
        itemCount: ruleInfo?.item_count ?? 0,
        categoryDistribution,
        complianceRate,
        ruleRefIntensity,
        fixRate: ruleStats.violation > 0 ? ruleStats.fix / ruleStats.violation : 0,
        avgFixTimeMs: avgFixAllMap.get(p.id) ?? null,
        maturityScore: 0, // 아래에서 계산
      };
    });

    // 성숙도 점수 계산
    const maxItemCount = Math.max(...projectResults.map((p) => p.itemCount), 1);
    for (const p of projectResults) {
      const refNorm = maxRefIntensity > 0 ? Math.min(p.ruleRefIntensity / maxRefIntensity, 1) : 0;
      const itemFactor = p.itemCount / maxItemCount;
      const recency = p.totalEvents > 0 ? 1 : 0;

      p.maturityScore = Math.round(
        p.complianceRate * 40 +
        p.fixRate * 20 +
        refNorm * 20 +
        itemFactor * 10 +
        recency * 10,
      );
    }

    res.json({ projects: projectResults });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── 공통 phase 분류 ─────────────────────────────────

type Phase = 'receive' | 'plan' | 'explore' | 'rule_check' | 'implement' | 'verify' | 'complete' | 'other';

function classifyPhase(action: string): Phase {
  const a = action.toLowerCase();
  if (a.startsWith('receive_') || a === 'receive_task') return 'receive';
  if (/^(plan|analyze|review|decide|compile|synthesize|finalize|confirm|report|adjust)/.test(a)) return 'plan';
  if (/^(read|search|scan|find|trace|list|identify|understand)/.test(a)) return 'explore';
  if (/^(check|rule_)/.test(a)) return 'rule_check';
  if (/^(modify|create|fix|add|update|write|edit|delete|rewrite|implement|harden|apply)/.test(a)) return 'implement';
  if (/^(build|run|test|typecheck|verify|lint|validate)/.test(a)) return 'verify';
  if (/^(task_complete|commit)/.test(a)) return 'complete';
  return 'other';
}

// ─── 6. GET /compare/deep ────────────────────────────

const WORKFLOW_PHASES: Phase[] = ['receive', 'plan', 'explore', 'rule_check', 'implement', 'verify', 'complete'];

analyticsRouter.get('/compare/deep', (req, res) => {
  try {
    const { projectIds } = req.query;
    const filterIds = projectIds && typeof projectIds === 'string'
      ? projectIds.split(',').map((s) => s.trim())
      : null;

    const projects = db.prepare('SELECT id, name, agent FROM projects ORDER BY created_at DESC')
      .all() as { id: string; name: string; agent: string }[];
    const targetProjects = filterIds
      ? projects.filter((p) => filterIds.includes(p.id))
      : projects;

    if (targetProjects.length === 0) {
      res.json({ projects: [] });
      return;
    }

    // 전체 이벤트 로드 (대상 프로젝트)
    const placeholders = targetProjects.map(() => '?').join(',');
    const allEvents = db.prepare(`
      SELECT id, project_id, action, type, timestamp, rule_id, file, task_id, message,
        strftime('%H', timestamp) as hour
      FROM events
      WHERE project_id IN (${placeholders})
      ORDER BY timestamp
    `).all(...targetProjects.map((p) => p.id)) as {
      id: string; project_id: string; action: string; type: string;
      timestamp: string; rule_id: string | null; file: string | null;
      task_id: string | null; message: string | null; hour: string;
    }[];

    // 프로젝트별 이벤트 그룹핑
    const eventsByProject = new Map<string, typeof allEvents>();
    for (const e of allEvents) {
      if (!eventsByProject.has(e.project_id)) eventsByProject.set(e.project_id, []);
      eventsByProject.get(e.project_id)!.push(e);
    }

    // 프로젝트별 규칙 수
    const ruleCounts = db.prepare(
      "SELECT project_id, COUNT(*) as group_count, COALESCE(SUM(item_count), 0) as item_count FROM rules WHERE status = 'active' GROUP BY project_id",
    ).all() as { project_id: string; group_count: number; item_count: number }[];
    const ruleMap = new Map(ruleCounts.map((r) => [r.project_id, r]));

    // ─── 프로젝트별 계산 ───
    const projectData = targetProjects.map((p) => {
      const events = eventsByProject.get(p.id) ?? [];
      const ruleInfo = ruleMap.get(p.id);

      // 태스크별 이벤트 그룹핑
      const taskEvents = new Map<string, typeof events>();
      for (const e of events) {
        if (!e.task_id) continue;
        if (!taskEvents.has(e.task_id)) taskEvents.set(e.task_id, []);
        taskEvents.get(e.task_id)!.push(e);
      }

      // ─ Profile: 기본 통계
      const totalEvents = events.length;
      const totalTasks = taskEvents.size;
      const uniqueFiles = new Set(events.filter((e) => e.file).map((e) => e.file));
      const firstEvent = events[0]?.timestamp ?? null;
      const lastEvent = events.length > 0 ? events[events.length - 1].timestamp : null;

      // 일별 활동 (스파크라인용)
      const dailyEvents = new Map<string, number>();
      for (const e of events) {
        const day = e.timestamp.slice(0, 10);
        dailyEvents.set(day, (dailyEvents.get(day) ?? 0) + 1);
      }
      const dailySparkline = [...dailyEvents.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // ─ Workflow DNA: phase별 이벤트 수 + 시간 비율
      const phaseCounts = new Map<Phase, number>();
      const phaseTimeMs = new Map<Phase, number>();
      for (const e of events) {
        const phase = classifyPhase(e.action);
        phaseCounts.set(phase, (phaseCounts.get(phase) ?? 0) + 1);
      }
      // phase 시간 계산 (태스크 내 이벤트 간격 기반)
      for (const taskEvts of taskEvents.values()) {
        for (let i = 1; i < taskEvts.length; i++) {
          const dt = new Date(taskEvts[i].timestamp).getTime() - new Date(taskEvts[i - 1].timestamp).getTime();
          if (dt > 600000) continue; // 10분 이상은 idle
          const phase = classifyPhase(taskEvts[i - 1].action);
          phaseTimeMs.set(phase, (phaseTimeMs.get(phase) ?? 0) + dt);
        }
      }
      const totalPhaseTime = [...phaseTimeMs.values()].reduce((a, b) => a + b, 0);
      const totalPhaseCount = [...phaseCounts.values()].reduce((a, b) => a + b, 0);

      const workflowDNA = WORKFLOW_PHASES.map((phase) => ({
        phase,
        eventRatio: totalPhaseCount > 0
          ? Math.round(((phaseCounts.get(phase) ?? 0) / totalPhaseCount) * 1000) / 10
          : 0,
        timeRatio: totalPhaseTime > 0
          ? Math.round(((phaseTimeMs.get(phase) ?? 0) / totalPhaseTime) * 1000) / 10
          : 0,
      }));

      // ─ Task Profile: 소요시간 분포 + 평균 크기
      const durations: number[] = [];
      let totalTaskEvents = 0;
      let totalTaskFiles = 0;
      for (const taskEvts of taskEvents.values()) {
        if (taskEvts.length < 2) continue;
        const t0 = new Date(taskEvts[0].timestamp).getTime();
        const tN = new Date(taskEvts[taskEvts.length - 1].timestamp).getTime();
        durations.push((tN - t0) / 1000);
        totalTaskEvents += taskEvts.length;
        const files = new Set(taskEvts.filter((e) => e.file).map((e) => e.file));
        totalTaskFiles += files.size;
      }
      const durationBuckets = new Map<string, number>();
      for (const dur of durations) {
        const bucket = dur < 60 ? '<1m' : dur < 300 ? '1-5m' : dur < 600 ? '5-10m'
          : dur < 1800 ? '10-30m' : dur < 3600 ? '30-60m' : '60m+';
        durationBuckets.set(bucket, (durationBuckets.get(bucket) ?? 0) + 1);
      }
      const taskDurationDist = ['<1m', '1-5m', '5-10m', '10-30m', '30-60m', '60m+']
        .map((bucket) => ({ bucket, count: durationBuckets.get(bucket) ?? 0 }));

      const tasksWithDuration = durations.length;
      const avgDurationMin = tasksWithDuration > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / tasksWithDuration / 60) * 10) / 10
        : 0;
      const avgEventsPerTask = tasksWithDuration > 0
        ? Math.round((totalTaskEvents / tasksWithDuration) * 10) / 10
        : 0;
      const avgFilesPerTask = tasksWithDuration > 0
        ? Math.round((totalTaskFiles / tasksWithDuration) * 10) / 10
        : 0;

      // ─ Hourly activity
      const hourly = new Array(24).fill(0);
      for (const e of events) {
        hourly[parseInt(e.hour)]++;
      }

      // ─ Rule violations
      // 이름이 바뀐 규칙의 옛 id는 현재 id로 합산한다. 그러지 않으면 규칙 기준 집계와 숫자가 어긋난다
      const aliasMap = getAliasMap(p.id);
      const removedIds = getRemovedRuleIds(p.id);
      const ruleViolations = new Map<string, number>();
      let matchCount = 0;
      let violationCount = 0;
      let fixCount = 0;
      for (const e of events) {
        const kind = classifyRuleEvent(e.action, e.type);
        if (kind === 'match') matchCount++;
        if (kind === 'violation') {
          violationCount++;
          const raw = e.rule_id ?? 'unknown';
          const ruleId = aliasMap.get(raw) ?? raw;
          ruleViolations.set(ruleId, (ruleViolations.get(ruleId) ?? 0) + 1);
        }
        if (kind === 'fix') fixCount++;
      }

      const topViolatedRules = [...ruleViolations.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ruleId, count]) => ({ ruleId, count, removed: removedIds.has(ruleId) }));

      const complianceRate = matchCount > 0 ? 1 - violationCount / matchCount : 1;

      return {
        projectId: p.id,
        projectName: p.name,
        agent: p.agent,
        // Profile
        profile: {
          totalEvents,
          totalTasks,
          totalFiles: uniqueFiles.size,
          ruleCount: ruleInfo?.group_count ?? 0,
          itemCount: ruleInfo?.item_count ?? 0,
          firstEventAt: firstEvent,
          lastEventAt: lastEvent,
          activeDays: dailyEvents.size,
          avgEventsPerDay: dailyEvents.size > 0
            ? Math.round(totalEvents / dailyEvents.size)
            : 0,
          dailySparkline: dailySparkline.slice(-30), // 최근 30일
        },
        // Workflow DNA
        workflowDNA,
        // Task Profile
        taskProfile: {
          avgDurationMin,
          avgEventsPerTask,
          avgFilesPerTask,
          durationDistribution: taskDurationDist,
        },
        // Hourly Activity
        hourlyActivity: hourly,
        // Rule Compliance
        ruleCompliance: {
          matchCount,
          violationCount,
          fixCount,
          complianceRate,
          topViolatedRules,
        },
      };
    });

    // ─── 크로스 프로젝트 분석 ───

    // 프로젝트별 일별 생산성 (겹친 라인 차트용)
    const allDates = new Set<string>();
    for (const p of projectData) {
      for (const d of p.profile.dailySparkline) {
        allDates.add(d.date);
      }
    }
    const sortedDates = [...allDates].sort();
    const productivityTimeline = sortedDates.map((date) => {
      const entry: Record<string, unknown> = { date };
      for (const p of projectData) {
        const dayData = p.profile.dailySparkline.find((d) => d.date === date);
        entry[p.projectName] = dayData?.count ?? 0;
      }
      return entry;
    });

    // 규칙 히트맵 (행: ruleId, 열: project, 셀: 위반 횟수)
    const allRuleIds = new Set<string>();
    const ruleViolationMap = new Map<string, Map<string, number>>(); // ruleId → projectId → count
    for (const p of projectData) {
      for (const r of p.ruleCompliance.topViolatedRules) {
        allRuleIds.add(r.ruleId);
      }
    }
    // 전체 이벤트에서 다시 집계 (top 5 외 규칙도 포함)
    for (const e of allEvents) {
      if (classifyRuleEvent(e.action, e.type) !== 'violation' || !e.rule_id) continue;
      if (!ruleViolationMap.has(e.rule_id)) ruleViolationMap.set(e.rule_id, new Map());
      const pm = ruleViolationMap.get(e.rule_id)!;
      pm.set(e.project_id, (pm.get(e.project_id) ?? 0) + 1);
    }
    const ruleHeatmap = [...ruleViolationMap.entries()]
      .map(([ruleId, projectMap]) => ({
        ruleId,
        total: [...projectMap.values()].reduce((a, b) => a + b, 0),
        byProject: Object.fromEntries(projectMap),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // 시간대 히트맵 (프로젝트 × 시간)
    const hourlyHeatmap = projectData.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      hours: p.hourlyActivity,
    }));

    res.json({
      projects: projectData,
      productivityTimeline,
      ruleHeatmap,
      hourlyHeatmap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── 7. GET /insights ─────────────────────────────────

analyticsRouter.get('/insights', (req, res) => {
  try {
    const { projectId, days: daysParam } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    const days = daysParam ? Number(daysParam) : 90;
    const timeFilter = days > 0
      ? `AND timestamp >= datetime('now', '-${days} days')`
      : '';

    // 전체 이벤트 조회 (태스크 분석용)
    const allEvents = db.prepare(`
      SELECT id, action, type, timestamp, rule_id, file, task_id, message,
        strftime('%H', timestamp) as hour
      FROM events
      WHERE project_id = ? ${timeFilter}
      ORDER BY timestamp
    `).all(projectId) as {
      id: string; action: string; type: string; timestamp: string;
      rule_id: string | null; file: string | null; task_id: string | null;
      message: string | null; hour: string;
    }[];

    // ─── 규칙 인사이트 ─────────────────────────────

    // 이름이 바뀐 규칙의 옛 id를 현재 id로 모아야 규칙 기준 집계와 숫자가 맞는다
    const aliasMap = getAliasMap(projectId);
    const removedIds = getRemovedRuleIds(projectId);
    const currentRuleId = (raw: string | null): string => {
      const id = raw ?? 'unknown';
      return aliasMap.get(id) ?? id;
    };

    // (A) Violation Pattern Clustering
    const violationPatterns = new Map<string, { rule: string; removed: boolean; count: number; examples: string[] }>();
    for (const e of allEvents) {
      if (classifyRuleEvent(e.action, e.type) !== 'violation' || !e.message) continue;
      // "MUST: <규칙 문구>" 또는 "MUST NOT: <규칙 문구>" 추출
      const match = e.message.match(/^(MUST NOT|MUST|PREFER):\s*(.+?)(?:\s*[—\-–]|$)/);
      const pattern = match ? match[2].trim().substring(0, 60) : e.message.substring(0, 60);
      const ruleId = currentRuleId(e.rule_id);
      const key = `${ruleId}::${pattern}`;
      if (!violationPatterns.has(key)) {
        violationPatterns.set(key, { rule: ruleId, removed: removedIds.has(ruleId), count: 0, examples: [] });
      }
      const entry = violationPatterns.get(key)!;
      entry.count++;
      if (entry.examples.length < 2) entry.examples.push(e.message.substring(0, 120));
    }
    const violationClusters = [...violationPatterns.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // (B) Hotspot Files (규칙 횡단 파일별 위반 집계)
    const fileViolations = new Map<string, Map<string, number>>();
    for (const e of allEvents) {
      if (classifyRuleEvent(e.action, e.type) !== 'violation' || !e.file) continue;
      if (!fileViolations.has(e.file)) fileViolations.set(e.file, new Map());
      const rm = fileViolations.get(e.file)!;
      const ruleId = currentRuleId(e.rule_id);
      rm.set(ruleId, (rm.get(ruleId) ?? 0) + 1);
    }
    const hotspotFiles = [...fileViolations.entries()]
      .map(([file, ruleMap]) => ({
        file,
        totalViolations: [...ruleMap.values()].reduce((a, b) => a + b, 0),
        rules: Object.fromEntries(ruleMap),
        removedRules: [...ruleMap.keys()].filter((id) => removedIds.has(id)),
      }))
      .sort((a, b) => b.totalViolations - a.totalViolations)
      .slice(0, 10);

    // (C) Rule Co-occurrence (같은 태스크에서 동시 위반)
    const taskViolatedRules = new Map<string, Set<string>>();
    for (const e of allEvents) {
      if (classifyRuleEvent(e.action, e.type) !== 'violation' || !e.task_id || !e.rule_id) continue;
      if (!taskViolatedRules.has(e.task_id)) taskViolatedRules.set(e.task_id, new Set());
      taskViolatedRules.get(e.task_id)!.add(currentRuleId(e.rule_id));
    }
    const pairCount = new Map<string, number>();
    for (const rules of taskViolatedRules.values()) {
      const arr = [...rules].sort();
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = `${arr[i]}+${arr[j]}`;
          pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
        }
      }
    }
    const ruleCoOccurrence = [...pairCount.entries()]
      .map(([pair, count]) => {
        const [ruleA, ruleB] = pair.split('+');
        return { ruleA, ruleB, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // (D) Violation Stories (위반 포함 태스크의 행동 시퀀스)
    const violationTaskIds = new Set<string>();
    for (const e of allEvents) {
      if (classifyRuleEvent(e.action, e.type) === 'violation' && e.task_id) {
        violationTaskIds.add(e.task_id);
      }
    }
    const violationStories: {
      taskId: string; durationSec: number;
      steps: { action: string; phase: Phase; ruleId: string | null; kind: RuleEventKind | null; timestamp: string }[];
      violationCount: number; resolved: boolean;
    }[] = [];
    const taskEventsMap = new Map<string, typeof allEvents>();
    for (const e of allEvents) {
      if (!e.task_id || !violationTaskIds.has(e.task_id)) continue;
      if (!taskEventsMap.has(e.task_id)) taskEventsMap.set(e.task_id, []);
      taskEventsMap.get(e.task_id)!.push(e);
    }
    for (const [taskId, events] of taskEventsMap) {
      if (events.length < 2) continue;
      const t0 = new Date(events[0].timestamp).getTime();
      const tN = new Date(events[events.length - 1].timestamp).getTime();
      let vCount = 0;
      let fCount = 0;
      const steps = events.map((e) => {
        const kind = e.rule_id ? classifyRuleEvent(e.action, e.type) : null;
        if (kind === 'violation') vCount++;
        if (kind === 'fix') fCount++;
        return {
          action: e.action,
          phase: classifyPhase(e.action),
          ruleId: e.rule_id,
          kind,
          timestamp: e.timestamp,
        };
      });
      violationStories.push({
        taskId,
        durationSec: Math.round((tN - t0) / 1000),
        steps,
        violationCount: vCount,
        resolved: fCount >= vCount && vCount > 0,
      });
    }
    // 최근 10건
    const recentViolationStories = violationStories
      .sort((a, b) => b.steps[0].timestamp.localeCompare(a.steps[0].timestamp))
      .slice(0, 10);

    // (E) Agent Behavior Flow (phase별 평균 이벤트 수)
    const allTaskPhases = new Map<string, Map<Phase, number>>();
    for (const e of allEvents) {
      if (!e.task_id) continue;
      if (!allTaskPhases.has(e.task_id)) allTaskPhases.set(e.task_id, new Map());
      const pm = allTaskPhases.get(e.task_id)!;
      const phase = classifyPhase(e.action);
      pm.set(phase, (pm.get(phase) ?? 0) + 1);
    }
    const phaseTotals = new Map<Phase, number>();
    const taskCount = allTaskPhases.size;
    for (const pm of allTaskPhases.values()) {
      for (const [phase, count] of pm) {
        phaseTotals.set(phase, (phaseTotals.get(phase) ?? 0) + count);
      }
    }
    const behaviorFlow = (['receive', 'plan', 'explore', 'rule_check', 'implement', 'verify', 'complete'] as Phase[])
      .map((phase) => ({
        phase,
        totalEvents: phaseTotals.get(phase) ?? 0,
        avgPerTask: taskCount > 0 ? Math.round(((phaseTotals.get(phase) ?? 0) / taskCount) * 10) / 10 : 0,
      }));

    // ─── 시간축 분석 ───────────────────────────────

    // (F) 태스크 소요시간 분포
    const taskDurations: { taskId: string; durationSec: number; eventCount: number; fileCount: number }[] = [];
    const taskMeta = new Map<string, { events: number; files: Set<string>; start: string; end: string }>();
    for (const e of allEvents) {
      if (!e.task_id) continue;
      if (!taskMeta.has(e.task_id)) {
        taskMeta.set(e.task_id, { events: 0, files: new Set(), start: e.timestamp, end: e.timestamp });
      }
      const m = taskMeta.get(e.task_id)!;
      m.events++;
      if (e.file) e.file.split(',').forEach((f) => m.files.add(f.trim()));
      if (e.timestamp > m.end) m.end = e.timestamp;
    }
    const durationBuckets = new Map<string, number>();
    for (const [taskId, m] of taskMeta) {
      const dur = (new Date(m.end).getTime() - new Date(m.start).getTime()) / 1000;
      taskDurations.push({ taskId, durationSec: dur, eventCount: m.events, fileCount: m.files.size });
      const bucket = dur < 60 ? '<1m' : dur < 300 ? '1-5m' : dur < 600 ? '5-10m'
        : dur < 1800 ? '10-30m' : dur < 3600 ? '30-60m' : '60m+';
      durationBuckets.set(bucket, (durationBuckets.get(bucket) ?? 0) + 1);
    }
    const durationDistribution = ['<1m', '1-5m', '5-10m', '10-30m', '30-60m', '60m+']
      .map((bucket) => ({ bucket, count: durationBuckets.get(bucket) ?? 0 }));

    // (G) Phase별 시간 비율 (태스크 내 이벤트 간 시간 간격을 해당 phase에 할당)
    const phaseTimeMs = new Map<Phase, number>();
    for (const events of taskEventsMap.values()) {
      for (let i = 1; i < events.length; i++) {
        const dt = new Date(events[i].timestamp).getTime() - new Date(events[i - 1].timestamp).getTime();
        if (dt > 600000) continue; // 10분 이상 간격은 idle로 간주하여 제외
        const phase = classifyPhase(events[i - 1].action);
        phaseTimeMs.set(phase, (phaseTimeMs.get(phase) ?? 0) + dt);
      }
    }
    // 전체 태스크에서도 계산 (violation task만이 아닌 전체)
    const allTaskEvents = new Map<string, typeof allEvents>();
    for (const e of allEvents) {
      if (!e.task_id) continue;
      if (!allTaskEvents.has(e.task_id)) allTaskEvents.set(e.task_id, []);
      allTaskEvents.get(e.task_id)!.push(e);
    }
    const phaseTimeMsAll = new Map<Phase, number>();
    for (const events of allTaskEvents.values()) {
      for (let i = 1; i < events.length; i++) {
        const dt = new Date(events[i].timestamp).getTime() - new Date(events[i - 1].timestamp).getTime();
        if (dt > 600000) continue;
        const phase = classifyPhase(events[i - 1].action);
        phaseTimeMsAll.set(phase, (phaseTimeMsAll.get(phase) ?? 0) + dt);
      }
    }
    const totalPhaseTime = [...phaseTimeMsAll.values()].reduce((a, b) => a + b, 0);
    const phaseTimeDistribution = (['plan', 'explore', 'rule_check', 'implement', 'verify'] as Phase[])
      .map((phase) => ({
        phase,
        timeMs: phaseTimeMsAll.get(phase) ?? 0,
        percentage: totalPhaseTime > 0 ? Math.round(((phaseTimeMsAll.get(phase) ?? 0) / totalPhaseTime) * 1000) / 10 : 0,
      }));

    // (H) 시간대별 활동량
    const hourlyActivity = new Array(24).fill(0);
    for (const e of allEvents) {
      hourlyActivity[parseInt(e.hour)]++;
    }
    const hourlyDistribution = hourlyActivity.map((count, hour) => ({ hour, count }));

    // (I) 태스크 복잡도 vs 소요시간
    const complexityData = taskDurations
      .filter((t) => t.durationSec > 0 && t.eventCount > 1)
      .map((t) => ({
        taskId: t.taskId,
        events: t.eventCount,
        files: t.fileCount,
        durationMin: Math.round(t.durationSec / 6) / 10,
      }))
      .sort((a, b) => b.durationMin - a.durationMin)
      .slice(0, 50);

    // (J) 일별 생산성 (완료 태스크 수 + 평균 소요시간)
    const dailyStats = new Map<string, { tasks: Set<string>; totalDur: number; events: number }>();
    for (const e of allEvents) {
      const day = e.timestamp.slice(0, 10);
      if (!dailyStats.has(day)) dailyStats.set(day, { tasks: new Set(), totalDur: 0, events: 0 });
      const d = dailyStats.get(day)!;
      if (e.task_id) d.tasks.add(e.task_id);
      d.events++;
    }
    const dailyProductivity = [...dailyStats.entries()]
      .map(([date, d]) => ({
        date,
        tasks: d.tasks.size,
        events: d.events,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      // 규칙 인사이트
      violationClusters,
      hotspotFiles,
      ruleCoOccurrence,
      violationStories: recentViolationStories,
      behaviorFlow,
      // 시간축 분석
      durationDistribution,
      phaseTimeDistribution,
      hourlyDistribution,
      complexityData,
      dailyProductivity,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
