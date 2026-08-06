import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db/connection.js';
import {
  syncProjectRules,
  resolveRuleId,
  collectRuleIdChain,
  invalidateSyncThrottle,
} from '../services/rule-sync.js';
import { invalidatePrefixCache, invalidateKeywordCache, invalidateCache as invalidateRegistryCache } from '../services/action-registry.js';
import type { AgentType, Project, Rule, RuleSyncResult } from '../types.js';

export const projectsRouter = Router();

const VALID_AGENTS: readonly AgentType[] = ['claude_code', 'codex'];

function normalizeAgent(value: unknown): AgentType {
  if (typeof value === 'string' && (VALID_AGENTS as readonly string[]).includes(value)) {
    return value as AgentType;
  }
  return 'claude_code';
}

const insertProject = db.prepare(`
  INSERT INTO projects (id, name, description, rules_path, agent)
  VALUES (?, ?, ?, ?, ?)
`);

const updateProject = db.prepare(`
  UPDATE projects SET name = ?, description = ?, rules_path = ?, agent = ?, updated_at = datetime('now')
  WHERE id = ?
`);

/** 프로젝트 삭제 전용 하드 삭제. foreign_keys=ON이라 projects보다 먼저 지워야 한다 */
const deleteRulesByProject = db.prepare(`
  DELETE FROM rules WHERE project_id = ?
`);

const deleteAliasesByProject = db.prepare(`
  DELETE FROM rule_aliases WHERE project_id = ?
`);

/** rulesPath가 사라진 경우 — 이력 보존을 위해 하드 삭제 대신 전량 removed 처리 */
const markAllRulesRemoved = db.prepare(`
  UPDATE rules SET status = 'removed', removed_at = datetime('now')
  WHERE project_id = ? AND status = 'active'
`);

const selectActiveRules = db.prepare(`
  SELECT * FROM rules WHERE project_id = ? AND status = 'active'
`);

const selectAllRules = db.prepare(`
  SELECT * FROM rules WHERE project_id = ?
`);

/** removed 규칙도 찾아야 한다 — 과거 이벤트에서 도달하는 경로가 있다 */
const selectRuleById = db.prepare(`
  SELECT * FROM rules WHERE project_id = ? AND id = ?
`);

const selectRuleStats = db.prepare(`
  SELECT type, COUNT(*) as count
  FROM events
  WHERE project_id = ? AND rule_id = ?
  GROUP BY type
`);

function listRules(projectId: string, includeRemoved: boolean): Rule[] {
  const stmt = includeRemoved ? selectAllRules : selectActiveRules;
  return stmt.all(projectId) as Rule[];
}

/** 옛 id로 들어와도 현재 규칙을 찾아준다 */
function findRule(projectId: string, ruleId: string): Rule | undefined {
  const direct = selectRuleById.get(projectId, ruleId) as Rule | undefined;
  if (direct) return direct;
  const resolved = resolveRuleId(projectId, ruleId);
  if (resolved === ruleId) return undefined;
  return selectRuleById.get(projectId, resolved) as Rule | undefined;
}

// POST /api/projects - 프로젝트 등록
projectsRouter.post('/', (req, res) => {
  try {
    const { name, description, rulesPath, agent } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const id = `bdn_${nanoid(8)}`;
    const agentValue = normalizeAgent(agent);

    // Insert project
    insertProject.run(id, name, description || null, rulesPath || null, agentValue);

    // Parse and insert rules if rulesPath provided
    let sync: RuleSyncResult | null = null;
    if (rulesPath) {
      sync = syncProjectRules(id, rulesPath);
    }
    invalidateSyncThrottle(id);

    res.status(201).json({
      id,
      name,
      rulesPath: rulesPath || null,
      agent: agentValue,
      rules: listRules(id, false),
      sync,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/projects - 프로젝트 목록
projectsRouter.get('/', (_req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

/** ?includeRemoved=1 — 삭제된 규칙까지. 과거 이벤트를 규칙에 이어붙이려면 필요하다 */
function wantsRemoved(value: unknown): boolean {
  return value === '1' || value === 'true';
}

// GET /api/projects/:id - 프로젝트 상세
projectsRouter.get('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const rules = listRules(req.params.id, wantsRemoved(req.query.includeRemoved));
    res.json({ ...project as object, rules });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/projects/:id/rules - 규칙 목록
projectsRouter.get('/:id/rules', (req, res) => {
  try {
    res.json(listRules(req.params.id, wantsRemoved(req.query.includeRemoved)));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/projects/:id/rules/:ruleId - 규칙 상세 + 이벤트 통계
projectsRouter.get('/:id/rules/:ruleId', (req, res) => {
  try {
    const rule = findRule(req.params.id, req.params.ruleId);
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    // 이름이 바뀌기 전 id로 쌓인 이벤트까지 합산한다
    const ids = collectRuleIdChain(req.params.id, rule.id);
    const totals = new Map<string, number>();
    for (const id of ids) {
      const rows = selectRuleStats.all(req.params.id, id) as { type: string; count: number }[];
      for (const row of rows) {
        totals.set(row.type, (totals.get(row.type) ?? 0) + row.count);
      }
    }
    const stats = [...totals.entries()].map(([type, count]) => ({ type, count }));

    res.json({ ...rule as object, stats, aliases: ids.filter((id) => id !== rule.id) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/projects/:id/rules/:ruleId/content - 규칙 파일 마크다운 원문
projectsRouter.get('/:id/rules/:ruleId/content', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const rule = findRule(req.params.id, req.params.ruleId);
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    if (!project.rules_path) {
      res.status(400).json({ error: 'Project has no rules_path configured' });
      return;
    }

    const fullPath = path.resolve(project.rules_path, rule.file_path);
    if (!fs.existsSync(fullPath)) {
      // 삭제된 규칙은 파일이 없는 게 정상이다
      res.status(404).json({ error: 'File not found', removed: rule.status === 'removed' });
      return;
    }

    const raw = fs.readFileSync(fullPath, 'utf-8');
    const cleaned = raw
      .replace(/^---\n[\s\S]*?\n---\n*/, '')   // YAML frontmatter
      .replace(/<!--\s*anchors:[\s\S]*?-->\n*/g, '') // anchors 주석
      .trimStart();

    // 첫 번째 # 헤딩을 title로 분리
    const headingMatch = cleaned.match(/^#\s+(.+)\n*/);
    const title = headingMatch ? headingMatch[1].trim() : rule.file_path;
    const body = headingMatch ? cleaned.slice(headingMatch[0].length) : cleaned;

    res.json({ title, body });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// PUT /api/projects/:id - 프로젝트 정보 수정
projectsRouter.put('/:id', (req, res) => {
  try {
    const { name, description, rulesPath, agent } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const agentValue = agent === undefined ? existing.agent : normalizeAgent(agent);
    updateProject.run(name, description || null, rulesPath || null, agentValue, req.params.id);

    // 경로가 그대로여도 항상 재싱크한다. 파일 내용만 바뀐 경우가 가장 흔하다
    const newPath = rulesPath || null;
    let sync: RuleSyncResult | null = null;
    if (newPath) {
      sync = syncProjectRules(req.params.id, newPath);
    } else if (existing.rules_path) {
      // 경로가 제거되면 규칙도 내린다. 다만 이력은 남긴다
      markAllRulesRemoved.run(req.params.id);
    }
    invalidateSyncThrottle(req.params.id);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ ...updated as object, sync });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/projects/:id - 프로젝트 삭제
projectsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM events WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM action_registry WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM action_prefixes WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM detail_keywords WHERE project_id = ?').run(id);
      deleteAliasesByProject.run(id);
      deleteRulesByProject.run(id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    });
    deleteAll();

    // Invalidate in-memory caches
    invalidatePrefixCache(id);
    invalidateKeywordCache(id);
    invalidateRegistryCache(id);
    invalidateSyncThrottle(id);

    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// PUT /api/projects/:id/sync - rules 디렉토리 재스캔
projectsRouter.put('/:id/sync', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!project.rules_path) {
      res.status(400).json({ error: 'Project has no rules_path configured' });
      return;
    }

    const sync = syncProjectRules(project.id, project.rules_path);
    invalidateSyncThrottle(project.id);

    db.prepare('UPDATE projects SET updated_at = datetime(\'now\') WHERE id = ?').run(project.id);

    const rules = listRules(project.id, false);
    res.json({ synced: rules.length, rules, sync });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
