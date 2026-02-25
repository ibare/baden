import crypto from 'crypto';
import db from '../db/connection.js';
import { broadcast } from '../ws.js';
import type { EventInput, RuleEvent } from '../types.js';

const insertEvent = db.prepare(`
  INSERT INTO events (id, timestamp, type, project_id, rule_id, severity, file, line, message, detail, action, agent, step, duration_ms, prompt, summary, result, task_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectEvent = db.prepare(`SELECT * FROM events WHERE id = ?`);

export function processEvent(input: EventInput): RuleEvent {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  console.log(`[Event] ${input.type} | project=${input.projectId}${input.file ? ` | file=${input.file}` : ''}${input.message ? ` | ${input.message}` : ''}`);

  insertEvent.run(
    id,
    timestamp,
    input.type,
    input.projectId,
    input.ruleId || null,
    input.severity || null,
    input.file || null,
    input.line || null,
    input.message || null,
    input.detail || null,
    input.action || null,
    input.agent || null,
    input.step || null,
    input.durationMs || null,
    input.prompt || null,
    input.summary || null,
    input.result || null,
    input.taskId || null,
  );

  const row = selectEvent.get(id) as Record<string, unknown>;
  const event: RuleEvent = row as unknown as RuleEvent;

  broadcast(event, input.projectId);

  return event;
}
