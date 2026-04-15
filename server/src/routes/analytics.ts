import { Router } from 'express';
import db from '../db/connection.js';

export const analyticsRouter = Router();

// ─── 공통 타입 ─────────────────────────────────────────

interface TypeCount {
  rule_id: string;
  type: string;
  count: number;
}

interface AvgFixRow {
  rule_id: string;
  avg_fix_ms: number;
}

interface WeeklyRow {
  rule_id: string;
  week: string;
  count: number;
}

interface RepeatRow {
  rule_id: string;
  file: string;
  cnt: number;
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

// ─── 공통 쿼리 헬퍼 ────────────────────────────────────

function getRuleTypeCounts(projectId: string, days: number) {
  const sql = days > 0
    ? `SELECT rule_id, type, COUNT(*) as count
       FROM events
       WHERE project_id = ? AND type IN ('rule_match','violation_found','fix_applied')
         AND rule_id IS NOT NULL
         AND timestamp >= datetime('now', '-${days} days')
       GROUP BY rule_id, type`
    : `SELECT rule_id, type, COUNT(*) as count
       FROM events
       WHERE project_id = ? AND type IN ('rule_match','violation_found','fix_applied')
         AND rule_id IS NOT NULL
       GROUP BY rule_id, type`;
  return db.prepare(sql).all(projectId) as TypeCount[];
}

function getAvgFixTimes(projectId: string) {
  return db.prepare(`
    SELECT v.rule_id,
      AVG((julianday(f.timestamp) - julianday(v.timestamp)) * 86400000) as avg_fix_ms
    FROM events v
    JOIN events f ON v.task_id = f.task_id AND v.rule_id = f.rule_id
    WHERE v.project_id = ? AND v.type = 'violation_found'
      AND f.type = 'fix_applied' AND f.timestamp > v.timestamp
      AND v.task_id IS NOT NULL
    GROUP BY v.rule_id
  `).all(projectId) as AvgFixRow[];
}

function getWeeklyTrend(projectId: string, days: number) {
  const sql = days > 0
    ? `SELECT rule_id, strftime('%Y-W%W', timestamp) as week, type, COUNT(*) as count
       FROM events
       WHERE project_id = ? AND type IN ('rule_match','violation_found','fix_applied')
         AND rule_id IS NOT NULL
         AND timestamp >= datetime('now', '-${days} days')
       GROUP BY rule_id, week, type
       ORDER BY week`
    : `SELECT rule_id, strftime('%Y-W%W', timestamp) as week, type, COUNT(*) as count
       FROM events
       WHERE project_id = ? AND type IN ('rule_match','violation_found','fix_applied')
         AND rule_id IS NOT NULL
       GROUP BY rule_id, week, type
       ORDER BY week`;
  return db.prepare(sql).all(projectId) as (WeeklyRow & { type: string })[];
}

function getRepeatedViolations(projectId: string) {
  return db.prepare(`
    SELECT rule_id, file, COUNT(*) as cnt
    FROM events
    WHERE project_id = ? AND type = 'violation_found'
      AND rule_id IS NOT NULL AND file IS NOT NULL
    GROUP BY rule_id, file
    HAVING cnt > 1
  `).all(projectId) as RepeatRow[];
}

function getProjectRules(projectId: string) {
  return db.prepare(
    'SELECT id, category, file_path, description, triggers, item_count FROM rules WHERE project_id = ?',
  ).all(projectId) as RuleRow[];
}

function getLastEventDates(projectId: string) {
  return db.prepare(`
    SELECT rule_id, type, MAX(timestamp) as last_at
    FROM events
    WHERE project_id = ? AND type IN ('rule_match', 'violation_found')
      AND rule_id IS NOT NULL
    GROUP BY rule_id, type
  `).all(projectId) as { rule_id: string; type: string; last_at: string }[];
}

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
    const typeCounts = getRuleTypeCounts(projectId, days);
    const avgFixes = getAvgFixTimes(projectId);
    const weeklyRaw = getWeeklyTrend(projectId, days);
    const repeats = getRepeatedViolations(projectId);

    // 맵 구성
    const countMap = new Map<string, { match: number; violation: number; fix: number }>();
    for (const row of typeCounts) {
      if (!countMap.has(row.rule_id)) countMap.set(row.rule_id, { match: 0, violation: 0, fix: 0 });
      const entry = countMap.get(row.rule_id)!;
      if (row.type === 'rule_match') entry.match = row.count;
      else if (row.type === 'violation_found') entry.violation = row.count;
      else if (row.type === 'fix_applied') entry.fix = row.count;
    }

    const avgFixMap = new Map(avgFixes.map((r) => [r.rule_id, r.avg_fix_ms]));

    // 주간 추이: { ruleId -> { week -> { matches, violations, fixes } } }
    const trendMap = new Map<string, Map<string, { matches: number; violations: number; fixes: number }>>();
    for (const row of weeklyRaw) {
      if (!trendMap.has(row.rule_id)) trendMap.set(row.rule_id, new Map());
      const weekMap = trendMap.get(row.rule_id)!;
      if (!weekMap.has(row.week)) weekMap.set(row.week, { matches: 0, violations: 0, fixes: 0 });
      const entry = weekMap.get(row.week)!;
      if (row.type === 'rule_match') entry.matches = row.count;
      else if (row.type === 'violation_found') entry.violations = row.count;
      else if (row.type === 'fix_applied') entry.fixes = row.count;
    }

    // 반복 위반 맵
    const repeatMap = new Map<string, number>();
    for (const row of repeats) {
      repeatMap.set(row.rule_id, (repeatMap.get(row.rule_id) ?? 0) + row.cnt);
    }

    // 필터
    const targetRules = ruleId ? rules.filter((r) => r.id === ruleId) : rules;

    const result = targetRules.map((rule) => {
      const counts = countMap.get(rule.id) ?? { match: 0, violation: 0, fix: 0 };
      const trend = trendMap.get(rule.id);
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
        avgFixTimeMs: avgFixMap.get(rule.id) ?? null,
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
    const typeCounts = getRuleTypeCounts(projectId, 0); // 전체 기간
    const avgFixes = getAvgFixTimes(projectId);
    const repeats = getRepeatedViolations(projectId);
    const lastDates = getLastEventDates(projectId);

    const countMap = new Map<string, { match: number; violation: number; fix: number }>();
    for (const row of typeCounts) {
      if (!countMap.has(row.rule_id)) countMap.set(row.rule_id, { match: 0, violation: 0, fix: 0 });
      const entry = countMap.get(row.rule_id)!;
      if (row.type === 'rule_match') entry.match = row.count;
      else if (row.type === 'violation_found') entry.violation = row.count;
      else if (row.type === 'fix_applied') entry.fix = row.count;
    }

    const avgFixMap = new Map(avgFixes.map((r) => [r.rule_id, r.avg_fix_ms]));

    // 반복 위반 파일 수
    const repeatFileCountMap = new Map<string, number>();
    for (const row of repeats) {
      repeatFileCountMap.set(row.rule_id, (repeatFileCountMap.get(row.rule_id) ?? 0) + 1);
    }

    // 마지막 이벤트 날짜
    const lastMatchMap = new Map<string, string>();
    const lastViolationMap = new Map<string, string>();
    for (const row of lastDates) {
      if (row.type === 'rule_match') lastMatchMap.set(row.rule_id, row.last_at);
      else if (row.type === 'violation_found') lastViolationMap.set(row.rule_id, row.last_at);
    }

    const summary: Record<RuleQualityLabel, number> = {
      healthy: 0,
      dormant: 0,
      ineffective: 0,
      over_triggered: 0,
    };

    const result = rules.map((rule) => {
      const counts = countMap.get(rule.id) ?? { match: 0, violation: 0, fix: 0 };
      const avgFixTimeMs = avgFixMap.get(rule.id) ?? null;
      const repeatFiles = repeatFileCountMap.get(rule.id) ?? 0;
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

    // 태스크별 통계
    const taskBreakdown = db.prepare(`
      SELECT task_id,
        MIN(timestamp) as started_at,
        MAX(timestamp) as completed_at,
        COUNT(*) as event_count,
        SUM(CASE WHEN type = 'violation_found' THEN 1 ELSE 0 END) as violations,
        SUM(CASE WHEN type = 'fix_applied' THEN 1 ELSE 0 END) as fixes
      FROM events
      WHERE project_id = ? AND task_id IS NOT NULL ${timeFilter}
      GROUP BY task_id
      ORDER BY started_at DESC
    `).all(projectId) as {
      task_id: string;
      started_at: string;
      completed_at: string | null;
      event_count: number;
      violations: number;
      fixes: number;
    }[];

    // 주간 추이
    const weeklyTrend = db.prepare(`
      SELECT strftime('%Y-W%W', timestamp) as week,
        COUNT(DISTINCT task_id) as tasks,
        SUM(CASE WHEN type = 'violation_found' THEN 1 ELSE 0 END) as violations,
        SUM(CASE WHEN type = 'fix_applied' THEN 1 ELSE 0 END) as fixes
      FROM events
      WHERE project_id = ? AND task_id IS NOT NULL ${timeFilter}
      GROUP BY week
      ORDER BY week
    `).all(projectId) as { week: string; tasks: number; violations: number; fixes: number }[];

    // 전체 평균 수정 시간
    const avgFixRow = db.prepare(`
      SELECT AVG((julianday(f.timestamp) - julianday(v.timestamp)) * 86400000) as avg_fix_ms
      FROM events v
      JOIN events f ON v.task_id = f.task_id AND v.rule_id = f.rule_id
      WHERE v.project_id = ? AND v.type = 'violation_found'
        AND f.type = 'fix_applied' AND f.timestamp > v.timestamp
        AND v.task_id IS NOT NULL
    `).get(projectId) as { avg_fix_ms: number | null } | undefined;

    const totalTasks = taskBreakdown.length;
    const totalViolations = taskBreakdown.reduce((s, t) => s + t.violations, 0);
    const totalFixes = taskBreakdown.reduce((s, t) => s + t.fixes, 0);

    res.json({
      summary: {
        totalTasks,
        totalViolations,
        totalFixes,
        violationRate: totalTasks > 0 ? totalViolations / totalTasks : 0,
        fixSuccessRate: totalViolations > 0 ? totalFixes / totalViolations : 0,
        avgFixTimeMs: avgFixRow?.avg_fix_ms ?? null,
      },
      taskBreakdown: taskBreakdown.map((t) => ({
        taskId: t.task_id,
        startedAt: t.started_at,
        completedAt: t.completed_at,
        eventCount: t.event_count,
        violationCount: t.violations,
        fixCount: t.fixes,
        fixRate: t.violations > 0 ? t.fixes / t.violations : 0,
      })),
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

    const rule = db.prepare(
      'SELECT id, category, file_path, description, triggers, item_count FROM rules WHERE id = ? AND project_id = ?',
    ).get(ruleId, projectId) as RuleRow | undefined;

    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    // 카운트
    const typeCounts = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM events
      WHERE project_id = ? AND rule_id = ? AND type IN ('rule_match','violation_found','fix_applied')
      GROUP BY type
    `).all(projectId, ruleId) as { type: string; count: number }[];

    const counts = { match: 0, violation: 0, fix: 0 };
    for (const row of typeCounts) {
      if (row.type === 'rule_match') counts.match = row.count;
      else if (row.type === 'violation_found') counts.violation = row.count;
      else if (row.type === 'fix_applied') counts.fix = row.count;
    }

    // 평균 수정 시간
    const avgRow = db.prepare(`
      SELECT AVG((julianday(f.timestamp) - julianday(v.timestamp)) * 86400000) as avg_fix_ms
      FROM events v
      JOIN events f ON v.task_id = f.task_id AND v.rule_id = f.rule_id
      WHERE v.project_id = ? AND v.rule_id = ? AND v.type = 'violation_found'
        AND f.type = 'fix_applied' AND f.timestamp > v.timestamp
        AND v.task_id IS NOT NULL
    `).get(projectId, ruleId) as { avg_fix_ms: number | null } | undefined;

    // 품질 판정 (quality 엔드포인트와 동일 로직)
    const repeats = db.prepare(`
      SELECT file, COUNT(*) as cnt
      FROM events
      WHERE project_id = ? AND rule_id = ? AND type = 'violation_found'
        AND file IS NOT NULL
      GROUP BY file
      HAVING cnt > 1
    `).all(projectId, ruleId) as { file: string; cnt: number }[];

    const repeatFiles = repeats.length;
    const violationRate = counts.match > 0 ? counts.violation / counts.match : 0;
    const avgFixTimeMs = avgRow?.avg_fix_ms ?? null;

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

    // 위반 이력
    const violations = db.prepare(`
      SELECT id, timestamp, file, message, severity, task_id
      FROM events
      WHERE project_id = ? AND rule_id = ? AND type = 'violation_found'
      ORDER BY timestamp DESC
      LIMIT 100
    `).all(projectId, ruleId) as {
      id: string; timestamp: string; file: string | null;
      message: string | null; severity: string | null; task_id: string | null;
    }[];

    // 각 위반에 대해 fix 여부 + fix 시간 확인
    const fixCheck = db.prepare(`
      SELECT MIN(timestamp) as fix_at
      FROM events
      WHERE project_id = ? AND rule_id = ? AND task_id = ? AND type = 'fix_applied'
        AND timestamp > ?
    `);

    const violationDetails = violations.map((v) => {
      let fixed = false;
      let fixTimeMs: number | null = null;
      if (v.task_id) {
        const fixRow = fixCheck.get(projectId, ruleId, v.task_id, v.timestamp) as { fix_at: string | null } | undefined;
        if (fixRow?.fix_at) {
          fixed = true;
          fixTimeMs = (new Date(fixRow.fix_at).getTime() - new Date(v.timestamp).getTime());
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

    // 주간 추이
    const weeklyTrend = db.prepare(`
      SELECT strftime('%Y-W%W', timestamp) as week, type, COUNT(*) as count
      FROM events
      WHERE project_id = ? AND rule_id = ? AND type IN ('rule_match','violation_found','fix_applied')
      GROUP BY week, type
      ORDER BY week
    `).all(projectId, ruleId) as { week: string; type: string; count: number }[];

    const trendMap = new Map<string, { matches: number; violations: number; fixes: number }>();
    for (const row of weeklyTrend) {
      if (!trendMap.has(row.week)) trendMap.set(row.week, { matches: 0, violations: 0, fixes: 0 });
      const entry = trendMap.get(row.week)!;
      if (row.type === 'rule_match') entry.matches = row.count;
      else if (row.type === 'violation_found') entry.violations = row.count;
      else if (row.type === 'fix_applied') entry.fixes = row.count;
    }

    // 상위 위반 파일
    const topFiles = db.prepare(`
      SELECT file, COUNT(*) as violation_count, MAX(timestamp) as last_at
      FROM events
      WHERE project_id = ? AND rule_id = ? AND type = 'violation_found' AND file IS NOT NULL
      GROUP BY file
      ORDER BY violation_count DESC
      LIMIT 10
    `).all(projectId, ruleId) as { file: string; violation_count: number; last_at: string }[];

    res.json({
      rule: {
        id: rule.id,
        category: rule.category,
        filePath: rule.file_path,
        description: rule.description,
        triggers: rule.triggers ? JSON.parse(rule.triggers) : null,
        itemCount: rule.item_count,
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
      'SELECT project_id, COUNT(*) as group_count, COALESCE(SUM(item_count), 0) as item_count FROM rules GROUP BY project_id',
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

    // 프로젝트별 규칙 관련 카운트
    const ruleEventCounts = db.prepare(`
      SELECT project_id, type, COUNT(*) as count
      FROM events
      WHERE type IN ('rule_match', 'violation_found', 'fix_applied')
      GROUP BY project_id, type
    `).all() as { project_id: string; type: string; count: number }[];

    const ruleEventMap = new Map<string, { match: number; violation: number; fix: number }>();
    for (const row of ruleEventCounts) {
      if (!ruleEventMap.has(row.project_id)) ruleEventMap.set(row.project_id, { match: 0, violation: 0, fix: 0 });
      const entry = ruleEventMap.get(row.project_id)!;
      if (row.type === 'rule_match') entry.match = row.count;
      else if (row.type === 'violation_found') entry.violation = row.count;
      else if (row.type === 'fix_applied') entry.fix = row.count;
    }

    // 프로젝트별 평균 수정 시간
    const avgFixAll = db.prepare(`
      SELECT v.project_id,
        AVG((julianday(f.timestamp) - julianday(v.timestamp)) * 86400000) as avg_fix_ms
      FROM events v
      JOIN events f ON v.task_id = f.task_id AND v.rule_id = f.rule_id AND v.project_id = f.project_id
      WHERE v.type = 'violation_found'
        AND f.type = 'fix_applied' AND f.timestamp > v.timestamp
        AND v.task_id IS NOT NULL
      GROUP BY v.project_id
    `).all() as { project_id: string; avg_fix_ms: number }[];
    const avgFixAllMap = new Map(avgFixAll.map((r) => [r.project_id, r.avg_fix_ms]));

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
