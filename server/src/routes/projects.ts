import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db/connection.js';
import { parseRules } from '../services/rule-parser.js';
import type { Project, Rule } from '../types.js';

export const projectsRouter = Router();

const insertProject = db.prepare(`
  INSERT INTO projects (id, name, description, rules_path)
  VALUES (?, ?, ?, ?)
`);

const insertRule = db.prepare(`
  INSERT OR REPLACE INTO rules (id, project_id, category, file_path, description, triggers, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const updateProject = db.prepare(`
  UPDATE projects SET name = ?, description = ?, rules_path = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const deleteRulesByProject = db.prepare(`
  DELETE FROM rules WHERE project_id = ?
`);

// POST /api/projects - 프로젝트 등록
projectsRouter.post('/', (req, res) => {
  try {
    const { name, description, rulesPath } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const id = `bdn_${nanoid(8)}`;

    // Insert project
    insertProject.run(id, name, description || null, rulesPath || null);

    // Parse and insert rules if rulesPath provided
    let parsedRules: ReturnType<typeof parseRules> = [];
    if (rulesPath) {
      parsedRules = parseRules(rulesPath);
      for (const rule of parsedRules) {
        insertRule.run(
          rule.id,
          id,
          rule.category,
          rule.filePath,
          rule.description,
          rule.triggers ? JSON.stringify(rule.triggers) : null,
          rule.contentHash,
        );
      }
    }

    res.status(201).json({
      id,
      name,
      rulesPath: rulesPath || null,
      rules: parsedRules,
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

// GET /api/projects/:id - 프로젝트 상세
projectsRouter.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const rules = db.prepare('SELECT * FROM rules WHERE project_id = ?').all(req.params.id);
  res.json({ ...project as object, rules });
});

// GET /api/projects/:id/rules - 규칙 목록
projectsRouter.get('/:id/rules', (req, res) => {
  const rules = db.prepare('SELECT * FROM rules WHERE project_id = ?').all(req.params.id);
  res.json(rules);
});

// GET /api/projects/:id/rules/:ruleId - 규칙 상세 + 이벤트 통계
projectsRouter.get('/:id/rules/:ruleId', (req, res) => {
  const rule = db.prepare('SELECT * FROM rules WHERE project_id = ? AND id = ?')
    .get(req.params.id, req.params.ruleId);

  if (!rule) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }

  const stats = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM events
    WHERE project_id = ? AND rule_id = ?
    GROUP BY type
  `).all(req.params.id, req.params.ruleId);

  res.json({ ...rule as object, stats });
});

// GET /api/projects/:id/rules/:ruleId/content - 규칙 파일 마크다운 원문
projectsRouter.get('/:id/rules/:ruleId/content', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const rule = db.prepare('SELECT * FROM rules WHERE project_id = ? AND id = ?')
    .get(req.params.id, req.params.ruleId) as Rule | undefined;
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
    res.status(404).json({ error: 'File not found' });
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
});

// PUT /api/projects/:id - 프로젝트 정보 수정
projectsRouter.put('/:id', (req, res) => {
  try {
    const { name, description, rulesPath } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    updateProject.run(name, description || null, rulesPath || null, req.params.id);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(updated);
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

    const parsedRules = parseRules(project.rules_path);

    // Replace all rules
    deleteRulesByProject.run(project.id);
    for (const rule of parsedRules) {
      insertRule.run(
        rule.id,
        project.id,
        rule.category,
        rule.filePath,
        rule.description,
        rule.triggers ? JSON.stringify(rule.triggers) : null,
        rule.contentHash,
      );
    }

    db.prepare('UPDATE projects SET updated_at = datetime(\'now\') WHERE id = ?').run(project.id);

    res.json({ synced: parsedRules.length, rules: parsedRules });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
