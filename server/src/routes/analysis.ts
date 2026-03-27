import { Router } from 'express';
import db from '../db/connection.js';

export const analysisRouter = Router();

/** EventType → category 매핑 (클라이언트 EVENT_CATEGORY_MAP과 동기화) */
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

// GET /api/insights
analysisRouter.get('/insights', (_req, res) => {
  try {
    // 1. 프로젝트 목록
    const projects = db
      .prepare('SELECT id, name, description FROM projects ORDER BY created_at DESC')
      .all() as { id: string; name: string; description: string | null }[];

    // 2. 프로젝트별 이벤트 통계
    const eventStats = db
      .prepare(
        `SELECT project_id, COUNT(*) as total_events, MAX(timestamp) as last_activity_at
         FROM events GROUP BY project_id`,
      )
      .all() as { project_id: string; total_events: number; last_activity_at: string | null }[];
    const eventStatsMap = new Map(eventStats.map((r) => [r.project_id, r]));

    // 3. 프로젝트별 세부 규칙 수 (MUST/MUST NOT/PREFER bullet 합산)
    const ruleCounts = db
      .prepare(
        `SELECT project_id,
                COUNT(*) as group_count,
                COALESCE(SUM(item_count), 0) as rule_count
         FROM rules GROUP BY project_id`,
      )
      .all() as { project_id: string; group_count: number; rule_count: number }[];
    const ruleCountMap = new Map(ruleCounts.map((r) => [r.project_id, r.rule_count]));

    // 4. 프로젝트별 이벤트 타입 분포
    const typeDist = db
      .prepare(
        `SELECT project_id, type, COUNT(*) as count
         FROM events GROUP BY project_id, type`,
      )
      .all() as { project_id: string; type: string; count: number }[];

    // 타입 → 카테고리로 집계
    const categoryDistMap = new Map<string, Map<string, number>>();
    for (const row of typeDist) {
      const cat = TYPE_TO_CATEGORY[row.type] ?? 'exploration';
      if (!categoryDistMap.has(row.project_id)) {
        categoryDistMap.set(row.project_id, new Map());
      }
      const m = categoryDistMap.get(row.project_id)!;
      m.set(cat, (m.get(cat) ?? 0) + row.count);
    }

    // 5. 프로젝트별 일별 이벤트 수 (최근 30일)
    const dailyTrends = db
      .prepare(
        `SELECT project_id, date(timestamp) as date, COUNT(*) as count
         FROM events
         WHERE timestamp >= datetime('now', '-30 days')
         GROUP BY project_id, date(timestamp)
         ORDER BY date`,
      )
      .all() as { project_id: string; date: string; count: number }[];

    const dailyTrendMap = new Map<string, { date: string; count: number }[]>();
    for (const row of dailyTrends) {
      if (!dailyTrendMap.has(row.project_id)) {
        dailyTrendMap.set(row.project_id, []);
      }
      dailyTrendMap.get(row.project_id)!.push({ date: row.date, count: row.count });
    }

    // 6. 프로젝트별 주간 트렌드 (전체 기간)
    const weeklyTrends = db
      .prepare(
        `SELECT project_id,
                strftime('%Y-W%W', timestamp) as week,
                MIN(date(timestamp)) as week_start,
                COUNT(*) as count
         FROM events
         GROUP BY project_id, strftime('%Y-W%W', timestamp)
         ORDER BY week`,
      )
      .all() as { project_id: string; week: string; week_start: string; count: number }[];

    const weeklyTrendMap = new Map<string, { week: string; date: string; count: number }[]>();
    for (const row of weeklyTrends) {
      if (!weeklyTrendMap.has(row.project_id)) {
        weeklyTrendMap.set(row.project_id, []);
      }
      weeklyTrendMap.get(row.project_id)!.push({ week: row.week, date: row.week_start, count: row.count });
    }

    // 7. 최초 이벤트 시점
    const firstEvent = db
      .prepare('SELECT MIN(timestamp) as first_at FROM events')
      .get() as { first_at: string | null } | undefined;

    // 조합
    const projectInsights = projects.map((p) => {
      const stats = eventStatsMap.get(p.id);
      const catDist = categoryDistMap.get(p.id);
      const categoryDistribution: { category: string; count: number }[] = [];
      if (catDist) {
        for (const [category, count] of catDist) {
          categoryDistribution.push({ category, count });
        }
      }

      return {
        project: { id: p.id, name: p.name, description: p.description },
        stats: {
          totalEvents: stats?.total_events ?? 0,
          ruleCount: ruleCountMap.get(p.id) ?? 0,
          lastActivityAt: stats?.last_activity_at ?? null,
        },
        categoryDistribution,
        dailyTrend: dailyTrendMap.get(p.id) ?? [],
        weeklyTrend: weeklyTrendMap.get(p.id) ?? [],
      };
    });

    const totalEvents = eventStats.reduce((sum, r) => sum + r.total_events, 0);

    res.json({
      global: {
        totalEvents,
        totalProjects: projects.length,
        firstEventAt: firstEvent?.first_at ?? null,
      },
      projects: projectInsights,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
