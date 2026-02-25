import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../../data/baden.db');

const db: DatabaseType = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// Initialize schema immediately so prepared statements in other modules work
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rules_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rules (
    id TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    category TEXT NOT NULL,
    file_path TEXT NOT NULL,
    description TEXT,
    triggers TEXT,
    content_hash TEXT,
    parsed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (id, project_id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    type TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    rule_id TEXT,
    severity TEXT,
    file TEXT,
    line INTEGER,
    message TEXT,
    detail TEXT,
    action TEXT,
    agent TEXT,
    step TEXT,
    duration_ms INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  CREATE INDEX IF NOT EXISTS idx_events_rule ON events(rule_id);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`);

// Migration: remove sessions table and session_id FK from events
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
if (tables) {
  console.log('[DB] Migrating: removing sessions...');
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE events_new (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      type TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id),
      rule_id TEXT,
      severity TEXT,
      file TEXT,
      line INTEGER,
      message TEXT,
      detail TEXT,
      action TEXT,
      agent TEXT,
      step TEXT,
      duration_ms INTEGER
    );
    INSERT INTO events_new (id, timestamp, type, project_id, rule_id, severity, file, line, message, detail, action, agent, step, duration_ms)
      SELECT id, timestamp, type, project_id, rule_id, severity, file, line, message, detail, action, agent, step, duration_ms FROM events;
    DROP TABLE events;
    ALTER TABLE events_new RENAME TO events;
    CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_rule ON events(rule_id);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    DROP TABLE sessions;
  `);
  console.log('[DB] Migration complete: sessions removed');
}

// Migration: add prompt, summary, result, task_id columns
const hasTaskId = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('events') WHERE name='task_id'").get() as { cnt: number };
if (hasTaskId.cnt === 0) {
  console.log('[DB] Migrating: adding prompt, summary, result, task_id columns...');
  db.exec(`
    ALTER TABLE events ADD COLUMN prompt TEXT;
    ALTER TABLE events ADD COLUMN summary TEXT;
    ALTER TABLE events ADD COLUMN result TEXT;
    ALTER TABLE events ADD COLUMN task_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
  `);
  console.log('[DB] Migration complete: new columns added');
}

// Migration: convert old datetime('now') timestamps to ISO 8601
const oldTimestamp = db.prepare("SELECT id FROM events WHERE timestamp NOT LIKE '%T%' LIMIT 1").get();
if (oldTimestamp) {
  console.log('[DB] Migrating: converting timestamps to ISO 8601...');
  db.exec(`
    UPDATE events SET timestamp = replace(timestamp, ' ', 'T') || '.000Z'
    WHERE timestamp NOT LIKE '%T%';
  `);
  console.log('[DB] Migration complete: timestamps converted');
}

db.pragma('foreign_keys = ON');

export default db;
