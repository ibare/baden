import crypto from 'crypto';
import db from '../db/connection.js';
import { broadcast } from '../ws.js';
import type { EventInput, RuleEvent } from '../types.js';

const insertEvent = db.prepare(`
  INSERT INTO events (id, timestamp, type, project_id, rule_id, severity, file, line, message, detail, action, agent, step, duration_ms)
  VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export function processEvent(input: EventInput): RuleEvent {
  const id = crypto.randomUUID();

  console.log(`[Event] ${input.type} | project=${input.projectId}${input.file ? ` | file=${input.file}` : ''}${input.message ? ` | ${input.message}` : ''}`);

  insertEvent.run(
    id,
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
  );

  const event: RuleEvent = {
    id,
    timestamp: new Date().toISOString(),
    type: input.type,
    project_id: input.projectId,
    rule_id: input.ruleId || null,
    severity: input.severity || null,
    file: input.file || null,
    line: input.line || null,
    message: input.message || null,
    detail: input.detail || null,
    action: input.action || null,
    agent: input.agent || null,
    step: input.step || null,
    duration_ms: input.durationMs || null,
  };

  broadcast(event, input.projectId);

  return event;
}
