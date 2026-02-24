import { Router } from 'express';
import db from '../db/connection.js';
import { processEvent } from '../services/event-processor.js';
import type { EventInput } from '../types.js';

export const eventsRouter = Router();

// POST /api/events - 이벤트 수신 (단건 또는 배열)
eventsRouter.post('/', (req, res) => {
  try {
    const body = req.body;
    const inputs: EventInput[] = Array.isArray(body) ? body : [body];
    console.log(`[Events] POST ${inputs.length} event(s): ${inputs.map((i) => i.type).join(', ')}`);
    const results = inputs.map((input) => processEvent(input));
    res.status(201).json(Array.isArray(body) ? results : results[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Events] Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// GET /api/events/dates - 이벤트가 있는 날짜 목록
eventsRouter.get('/dates', (req, res) => {
  const { projectId } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (projectId) {
    conditions.push('project_id = ?');
    params.push(projectId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT DISTINCT date(timestamp) as date FROM events ${where} ORDER BY date DESC`;
  const rows = db.prepare(sql).all(...params) as { date: string }[];
  res.json(rows.map((r) => r.date));
});

// GET /api/events - 이벤트 조회
eventsRouter.get('/', (req, res) => {
  const { projectId, type, ruleId, taskId, date, limit = '100', offset = '0' } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (projectId) {
    conditions.push('project_id = ?');
    params.push(projectId);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (ruleId) {
    conditions.push('rule_id = ?');
    params.push(ruleId);
  }
  if (taskId) {
    conditions.push('task_id = ?');
    params.push(taskId);
  }
  if (date && typeof date === 'string') {
    conditions.push("date(timestamp) = ?");
    params.push(date);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const events = db.prepare(sql).all(...params) as Record<string, unknown>[];
  // SQLite datetime('now')는 UTC지만 'Z' 접미사가 없으므로 명시적으로 추가
  res.json(events.map((e) => ({
    ...e,
    timestamp: e.timestamp ? `${e.timestamp}Z` : e.timestamp,
  })));
});
