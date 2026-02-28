import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const badenHome = path.join(os.homedir(), '.baden');
fs.mkdirSync(badenHome, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(badenHome, 'baden.db');

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
      { prefix: 'read', category: 'exploration', label: 'Read', icon: 'BookOpen' },
      { prefix: 'search', category: 'exploration', label: 'Search', icon: 'MagnifyingGlass' },
      { prefix: 'find', category: 'exploration', label: 'Find', icon: 'MagnifyingGlass' },
      { prefix: 'check', category: 'exploration', label: 'Check', icon: 'Eye' },
      { prefix: 'list', category: 'exploration', label: 'List', icon: 'List' },
      { prefix: 'get', category: 'exploration', label: 'Get', icon: 'Eye' },
      { prefix: 'view', category: 'exploration', label: 'View', icon: 'Eye' },
      // planning
      { prefix: 'plan', category: 'planning', label: 'Plan', icon: 'MapTrifold' },
      { prefix: 'analyze', category: 'planning', label: 'Analyze', icon: 'ChartLine' },
      { prefix: 'analysis', category: 'planning', label: 'Analysis', icon: 'ChartLine' },
      { prefix: 'decide', category: 'planning', label: 'Decide', icon: 'GitBranch' },
      { prefix: 'design', category: 'planning', label: 'Design', icon: 'PencilRuler' },
      { prefix: 'evaluate', category: 'planning', label: 'Evaluate', icon: 'Scales' },
      // implementation
      { prefix: 'add', category: 'implementation', label: 'Add', icon: 'Plus' },
      { prefix: 'create', category: 'implementation', label: 'Create', icon: 'FilePlus' },
      { prefix: 'update', category: 'implementation', label: 'Update', icon: 'PencilSimple' },
      { prefix: 'modify', category: 'implementation', label: 'Modify', icon: 'PencilSimple' },
      { prefix: 'remove', category: 'implementation', label: 'Remove', icon: 'Minus' },
      { prefix: 'delete', category: 'implementation', label: 'Delete', icon: 'Trash' },
      { prefix: 'refactor', category: 'implementation', label: 'Refactor', icon: 'ArrowsClockwise' },
      { prefix: 'implement', category: 'implementation', label: 'Implement', icon: 'Code' },
      { prefix: 'write', category: 'implementation', label: 'Write', icon: 'PencilLine' },
      { prefix: 'configure', category: 'implementation', label: 'Configure', icon: 'Gear' },
      { prefix: 'set', category: 'implementation', label: 'Set', icon: 'Gear' },
      { prefix: 'install', category: 'implementation', label: 'Install', icon: 'Download' },
      { prefix: 'move', category: 'implementation', label: 'Move', icon: 'ArrowRight' },
      { prefix: 'rename', category: 'implementation', label: 'Rename', icon: 'TextAa' },
      // rule_compliance (verification/debugging absorbed)
      { prefix: 'test', category: 'rule_compliance', label: 'Test', icon: 'Flask' },
      { prefix: 'verify', category: 'rule_compliance', label: 'Verify', icon: 'CheckCircle' },
      { prefix: 'validate', category: 'rule_compliance', label: 'Validate', icon: 'ShieldCheck' },
      { prefix: 'run', category: 'rule_compliance', label: 'Run', icon: 'Play' },
      { prefix: 'build', category: 'rule_compliance', label: 'Build', icon: 'Hammer' },
      { prefix: 'fix', category: 'implementation', label: 'Fix', icon: 'Wrench' },
      { prefix: 'debug', category: 'implementation', label: 'Debug', icon: 'Bug' },
      { prefix: 'resolve', category: 'implementation', label: 'Resolve', icon: 'CheckCircle' },
      // rule_compliance
      { prefix: 'apply', category: 'rule_compliance', label: 'Apply', icon: 'Check' },
      { prefix: 'enforce', category: 'rule_compliance', label: 'Enforce', icon: 'Shield' },
      // misc
      { prefix: 'review', category: 'planning', label: 'Review', icon: 'MagnifyingGlassPlus' },
      { prefix: 'report', category: 'planning', label: 'Report', icon: 'FileText' },
      { prefix: 'deliver', category: 'implementation', label: 'Deliver', icon: 'PaperPlaneRight' },
      { prefix: 'completed', category: 'rule_compliance', label: 'Completed', icon: 'CheckCircle' },
      { prefix: 'task', category: 'planning', label: 'Task', icon: 'ClipboardText' },
      { prefix: 'invoke', category: 'implementation', label: 'Invoke', icon: 'Lightning' },
      { prefix: 'invoke_rule', category: 'rule_compliance', label: 'Invoke Rule', icon: 'BookBookmark' },
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

// Migration: create detail_keywords table
const hasDetailKeywords = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='detail_keywords'").get();
if (!hasDetailKeywords) {
  console.log('[DB] Migrating: creating detail_keywords table...');
  db.exec(`
    CREATE TABLE detail_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      UNIQUE(project_id, keyword)
    );
    CREATE INDEX idx_detail_keywords_project ON detail_keywords(project_id);
  `);

  // Seed default keywords for existing projects
  const projectRows2 = db.prepare("SELECT id FROM projects").all() as { id: string }[];
  if (projectRows2.length > 0) {
    console.log('[DB] Seeding detail_keywords...');
    const keywordSeed: { keyword: string; category: string }[] = [
      { keyword: 'test', category: 'rule_compliance' },
      { keyword: 'tests', category: 'rule_compliance' },
      { keyword: 'spec', category: 'rule_compliance' },
      { keyword: 'lint', category: 'rule_compliance' },
      { keyword: 'error', category: 'implementation' },
      { keyword: 'bug', category: 'implementation' },
      { keyword: 'debug', category: 'implementation' },
      { keyword: 'rule', category: 'rule_compliance' },
      { keyword: 'rules', category: 'rule_compliance' },
      { keyword: 'doc', category: 'exploration' },
      { keyword: 'docs', category: 'exploration' },
      { keyword: 'plan', category: 'planning' },
      { keyword: 'design', category: 'planning' },
    ];
    const insertKw = db.prepare(`
      INSERT OR IGNORE INTO detail_keywords (project_id, keyword, category)
      VALUES (?, ?, ?)
    `);
    const tx2 = db.transaction(() => {
      for (const proj of projectRows2) {
        for (const kw of keywordSeed) {
          insertKw.run(proj.id, kw.keyword, kw.category);
        }
      }
    });
    tx2();
    console.log(`[DB] Seeded ${keywordSeed.length} keywords for ${projectRows2.length} project(s)`);
  }

  console.log('[DB] Migration complete: detail_keywords table created');
}

// Migration: collapse debugging/verification → implementation/rule_compliance
const hasOldCategories = db.prepare(
  "SELECT COUNT(*) as cnt FROM action_prefixes WHERE category IN ('debugging', 'verification')"
).get() as { cnt: number };
if (hasOldCategories.cnt > 0) {
  console.log('[DB] Migrating: collapsing debugging/verification categories...');
  db.exec(`
    UPDATE action_prefixes SET category = 'implementation' WHERE category = 'debugging';
    UPDATE action_prefixes SET category = 'rule_compliance' WHERE category = 'verification';
    UPDATE detail_keywords SET category = 'implementation' WHERE category = 'debugging';
    UPDATE detail_keywords SET category = 'rule_compliance' WHERE category = 'verification';
    UPDATE events SET type = 'code_modify' WHERE type IN ('error_encountered', 'error_resolved');
  `);
  console.log('[DB] Migration complete: categories collapsed');
}

// Migration: reclassify events with type='query' using word decomposition algorithm
const queryEventCount = db.prepare(
  "SELECT COUNT(*) as cnt FROM events WHERE type = 'query' AND action IS NOT NULL"
).get() as { cnt: number };
if (queryEventCount.cnt > 0) {
  console.log(`[DB] Migrating: reclassifying ${queryEventCount.cnt} query events...`);
  const WORD_TO_TYPE: Record<string, string> = {
    rule: 'rule_match', violation: 'rule_match', check: 'rule_match',
    verify: 'build_run', test: 'build_run', build: 'build_run', typecheck: 'build_run', lint: 'build_run', validate: 'build_run',
    plan: 'task_analysis', analyze: 'task_analysis', review: 'task_analysis', decide: 'task_analysis',
    receive: 'task_analysis', task: 'task_analysis', compile: 'task_analysis', synthesize: 'task_analysis',
    finalize: 'task_analysis', confirm: 'task_analysis', report: 'task_analysis', adjust: 'task_analysis',
    read: 'file_read', search: 'file_read', scan: 'file_read', find: 'file_read',
    trace: 'file_read', list: 'file_read', identify: 'file_read', understand: 'file_read',
    create: 'code_create',
    modify: 'code_modify', edit: 'code_modify', delete: 'code_modify', rewrite: 'code_modify',
    add: 'code_modify', implement: 'code_modify', update: 'code_modify', write: 'code_modify',
    fix: 'code_modify', harden: 'code_modify', protect: 'code_modify', apply: 'code_modify',
    start: 'code_modify', continue: 'code_modify', skip: 'code_modify',
  };
  const SKIP_WORDS = new Set(['run']);

  const rows = db.prepare(
    "SELECT id, action, rule_id FROM events WHERE type = 'query' AND action IS NOT NULL"
  ).all() as { id: string; action: string; rule_id: string | null }[];

  const updateStmt = db.prepare('UPDATE events SET type = ? WHERE id = ?');
  const tx = db.transaction(() => {
    let reclassified = 0;
    for (const row of rows) {
      let newType: string | null = null;
      const words = row.action.toLowerCase().split('_');
      for (const word of words) {
        if (SKIP_WORDS.has(word)) continue;
        if (WORD_TO_TYPE[word]) { newType = WORD_TO_TYPE[word]; break; }
      }
      if (!newType && row.rule_id) newType = 'rule_match';
      if (newType) {
        updateStmt.run(newType, row.id);
        reclassified++;
      }
    }
    console.log(`[DB] Reclassified ${reclassified}/${rows.length} events`);
  });
  tx();
  console.log('[DB] Migration complete: query events reclassified');
}

// Migration: localize Korean labels to English in action_prefixes
const hasKoreanLabels = db.prepare(
  "SELECT COUNT(*) as cnt FROM action_prefixes WHERE label = '읽기'"
).get() as { cnt: number };
if (hasKoreanLabels.cnt > 0) {
  console.log('[DB] Migrating: localizing action_prefixes labels to English...');
  const labelMap: [string, string][] = [
    ['읽기', 'Read'], ['검색', 'Search'], ['찾기', 'Find'], ['확인', 'Check'],
    ['목록', 'List'], ['조회', 'Get'], ['보기', 'View'],
    ['계획', 'Plan'], ['분석', 'Analyze'], ['결정', 'Decide'],
    ['설계', 'Design'], ['평가', 'Evaluate'],
    ['추가', 'Add'], ['생성', 'Create'], ['수정', 'Fix'], ['변경', 'Modify'],
    ['제거', 'Remove'], ['삭제', 'Delete'], ['리팩터', 'Refactor'],
    ['구현', 'Implement'], ['작성', 'Write'], ['설정', 'Configure'],
    ['설치', 'Install'], ['이동', 'Move'], ['이름변경', 'Rename'],
    ['테스트', 'Test'], ['검증', 'Verify'], ['유효성', 'Validate'],
    ['실행', 'Run'], ['빌드', 'Build'], ['디버그', 'Debug'], ['해결', 'Resolve'],
    ['적용', 'Apply'], ['강제', 'Enforce'],
    ['검토', 'Review'], ['보고', 'Report'], ['전달', 'Deliver'],
    ['완료', 'Completed'], ['작업', 'Task'], ['호출', 'Invoke'],
    ['규칙호출', 'Invoke Rule'],
  ];
  const updateLabel = db.prepare('UPDATE action_prefixes SET label = ? WHERE label = ?');
  const tx = db.transaction(() => {
    for (const [ko, en] of labelMap) {
      updateLabel.run(en, ko);
    }
  });
  tx();
  console.log('[DB] Migration complete: labels localized to English');
}

db.pragma('foreign_keys = ON');

export default db;
