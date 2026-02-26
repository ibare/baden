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

// Migration: create action_registry table
const hasActionRegistry = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='action_registry'").get();
if (!hasActionRegistry) {
  console.log('[DB] Migrating: creating action_registry table...');
  db.exec(`
    CREATE TABLE action_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      pattern TEXT NOT NULL,
      pattern_type TEXT NOT NULL DEFAULT 'exact',
      category TEXT,
      label TEXT,
      icon TEXT,
      confirmed INTEGER NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, pattern)
    );
    CREATE INDEX idx_action_registry_project ON action_registry(project_id);
  `);
  console.log('[DB] Migration complete: action_registry table created');
}

// Migration: create action_prefixes table
const hasActionPrefixes = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='action_prefixes'").get();
if (!hasActionPrefixes) {
  console.log('[DB] Migrating: creating action_prefixes table...');
  db.exec(`
    CREATE TABLE action_prefixes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      prefix TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(project_id, prefix)
    );
  `);

  // Seed from existing wildcard entries if any projects exist
  const projectRows = db.prepare("SELECT id FROM projects").all() as { id: string }[];
  if (projectRows.length > 0) {
    console.log('[DB] Seeding action_prefixes from wildcard patterns...');
    const seedData: { prefix: string; category: string; label: string; icon: string | null }[] = [
      // exploration
      { prefix: 'read', category: 'exploration', label: '읽기', icon: 'BookOpen' },
      { prefix: 'search', category: 'exploration', label: '검색', icon: 'MagnifyingGlass' },
      { prefix: 'find', category: 'exploration', label: '찾기', icon: 'MagnifyingGlass' },
      { prefix: 'check', category: 'exploration', label: '확인', icon: 'Eye' },
      { prefix: 'list', category: 'exploration', label: '목록', icon: 'List' },
      { prefix: 'get', category: 'exploration', label: '조회', icon: 'Eye' },
      { prefix: 'view', category: 'exploration', label: '보기', icon: 'Eye' },
      // planning
      { prefix: 'plan', category: 'planning', label: '계획', icon: 'MapTrifold' },
      { prefix: 'analyze', category: 'planning', label: '분석', icon: 'ChartLine' },
      { prefix: 'analysis', category: 'planning', label: '분석', icon: 'ChartLine' },
      { prefix: 'decide', category: 'planning', label: '결정', icon: 'GitBranch' },
      { prefix: 'design', category: 'planning', label: '설계', icon: 'PencilRuler' },
      { prefix: 'evaluate', category: 'planning', label: '평가', icon: 'Scales' },
      // implementation
      { prefix: 'add', category: 'implementation', label: '추가', icon: 'Plus' },
      { prefix: 'create', category: 'implementation', label: '생성', icon: 'FilePlus' },
      { prefix: 'update', category: 'implementation', label: '수정', icon: 'PencilSimple' },
      { prefix: 'modify', category: 'implementation', label: '변경', icon: 'PencilSimple' },
      { prefix: 'remove', category: 'implementation', label: '제거', icon: 'Minus' },
      { prefix: 'delete', category: 'implementation', label: '삭제', icon: 'Trash' },
      { prefix: 'refactor', category: 'implementation', label: '리팩터', icon: 'ArrowsClockwise' },
      { prefix: 'implement', category: 'implementation', label: '구현', icon: 'Code' },
      { prefix: 'write', category: 'implementation', label: '작성', icon: 'PencilLine' },
      { prefix: 'configure', category: 'implementation', label: '설정', icon: 'Gear' },
      { prefix: 'set', category: 'implementation', label: '설정', icon: 'Gear' },
      { prefix: 'install', category: 'implementation', label: '설치', icon: 'Download' },
      { prefix: 'move', category: 'implementation', label: '이동', icon: 'ArrowRight' },
      { prefix: 'rename', category: 'implementation', label: '이름변경', icon: 'TextAa' },
      // verification
      { prefix: 'test', category: 'verification', label: '테스트', icon: 'Flask' },
      { prefix: 'verify', category: 'verification', label: '검증', icon: 'CheckCircle' },
      { prefix: 'validate', category: 'verification', label: '유효성', icon: 'ShieldCheck' },
      { prefix: 'run', category: 'verification', label: '실행', icon: 'Play' },
      { prefix: 'build', category: 'verification', label: '빌드', icon: 'Hammer' },
      // debugging
      { prefix: 'fix', category: 'debugging', label: '수정', icon: 'Wrench' },
      { prefix: 'debug', category: 'debugging', label: '디버그', icon: 'Bug' },
      { prefix: 'resolve', category: 'debugging', label: '해결', icon: 'CheckCircle' },
      // rule_compliance
      { prefix: 'apply', category: 'rule_compliance', label: '적용', icon: 'Check' },
      { prefix: 'enforce', category: 'rule_compliance', label: '강제', icon: 'Shield' },
      // misc
      { prefix: 'review', category: 'planning', label: '검토', icon: 'MagnifyingGlassPlus' },
      { prefix: 'report', category: 'verification', label: '보고', icon: 'FileText' },
      { prefix: 'deliver', category: 'implementation', label: '전달', icon: 'PaperPlaneRight' },
      { prefix: 'completed', category: 'verification', label: '완료', icon: 'CheckCircle' },
      { prefix: 'task', category: 'planning', label: '작업', icon: 'ClipboardText' },
      { prefix: 'invoke', category: 'implementation', label: '호출', icon: 'Lightning' },
      { prefix: 'invoke_rule', category: 'rule_compliance', label: '규칙호출', icon: 'BookBookmark' },
    ];
    const insertPrefix = db.prepare(`
      INSERT OR IGNORE INTO action_prefixes (project_id, prefix, category, label, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const proj of projectRows) {
        seedData.forEach((s, idx) => {
          insertPrefix.run(proj.id, s.prefix, s.category, s.label, s.icon, idx);
        });
      }
    });
    tx();
    console.log(`[DB] Seeded ${seedData.length} prefixes for ${projectRows.length} project(s)`);
  }

  console.log('[DB] Migration complete: action_prefixes table created');
}

db.pragma('foreign_keys = ON');

export default db;
