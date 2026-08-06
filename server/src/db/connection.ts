import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { log, warn } from '../logger.js';

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
    -- nullable이어야 한다. 아래 "make rules_path nullable" 마이그레이션은
    -- agent 컬럼이 없던 시절의 코드라, 신규 DB가 그 경로를 타면 컬럼 수가 어긋난다
    rules_path TEXT,
    agent TEXT NOT NULL DEFAULT 'claude_code',
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
  log('DB','Migrating: removing sessions...');
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
  log('DB','Migration complete: sessions removed');
}

// Migration: add prompt, summary, result, task_id columns
const hasTaskId = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('events') WHERE name='task_id'").get() as { cnt: number };
if (hasTaskId.cnt === 0) {
  log('DB','Migrating: adding prompt, summary, result, task_id columns...');
  db.exec(`
    ALTER TABLE events ADD COLUMN prompt TEXT;
    ALTER TABLE events ADD COLUMN summary TEXT;
    ALTER TABLE events ADD COLUMN result TEXT;
    ALTER TABLE events ADD COLUMN task_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
  `);
  log('DB','Migration complete: new columns added');
}

// Migration: convert old datetime('now') timestamps to ISO 8601
const oldTimestamp = db.prepare("SELECT id FROM events WHERE timestamp NOT LIKE '%T%' LIMIT 1").get();
if (oldTimestamp) {
  log('DB','Migrating: converting timestamps to ISO 8601...');
  db.exec(`
    UPDATE events SET timestamp = replace(timestamp, ' ', 'T') || '.000Z'
    WHERE timestamp NOT LIKE '%T%';
  `);
  log('DB','Migration complete: timestamps converted');
}

// Migration: create action_registry table
const hasActionRegistry = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='action_registry'").get();
if (!hasActionRegistry) {
  log('DB','Migrating: creating action_registry table...');
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
  log('DB','Migration complete: action_registry table created');
}

// Migration: create action_prefixes table
const hasActionPrefixes = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='action_prefixes'").get();
if (!hasActionPrefixes) {
  log('DB','Migrating: creating action_prefixes table...');
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
    log('DB','Seeding action_prefixes from wildcard patterns...');
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
    log('DB',`Seeded ${seedData.length} prefixes for ${projectRows.length} project(s)`);
  }

  log('DB','Migration complete: action_prefixes table created');
}

// Migration: create detail_keywords table
const hasDetailKeywords = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='detail_keywords'").get();
if (!hasDetailKeywords) {
  log('DB','Migrating: creating detail_keywords table...');
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
    log('DB','Seeding detail_keywords...');
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
    log('DB',`Seeded ${keywordSeed.length} keywords for ${projectRows2.length} project(s)`);
  }

  log('DB','Migration complete: detail_keywords table created');
}

// Migration: collapse debugging/verification → implementation/rule_compliance
const hasOldCategories = db.prepare(
  "SELECT COUNT(*) as cnt FROM action_prefixes WHERE category IN ('debugging', 'verification')"
).get() as { cnt: number };
if (hasOldCategories.cnt > 0) {
  log('DB','Migrating: collapsing debugging/verification categories...');
  db.exec(`
    UPDATE action_prefixes SET category = 'implementation' WHERE category = 'debugging';
    UPDATE action_prefixes SET category = 'rule_compliance' WHERE category = 'verification';
    UPDATE detail_keywords SET category = 'implementation' WHERE category = 'debugging';
    UPDATE detail_keywords SET category = 'rule_compliance' WHERE category = 'verification';
    UPDATE events SET type = 'code_modify' WHERE type IN ('error_encountered', 'error_resolved');
  `);
  log('DB','Migration complete: categories collapsed');
}

// Migration: reclassify events with type='query' using word decomposition algorithm
const queryEventCount = db.prepare(
  "SELECT COUNT(*) as cnt FROM events WHERE type = 'query' AND action IS NOT NULL"
).get() as { cnt: number };
if (queryEventCount.cnt > 0) {
  log('DB',`Migrating: reclassifying ${queryEventCount.cnt} query events...`);
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
    log('DB',`Reclassified ${reclassified}/${rows.length} events`);
  });
  tx();
  log('DB','Migration complete: query events reclassified');
}

// Migration: localize Korean labels to English in action_prefixes
const hasKoreanLabels = db.prepare(
  "SELECT COUNT(*) as cnt FROM action_prefixes WHERE label = '읽기'"
).get() as { cnt: number };
if (hasKoreanLabels.cnt > 0) {
  log('DB','Migrating: localizing action_prefixes labels to English...');
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
  log('DB','Migration complete: labels localized to English');
}

// projects(name) UNIQUE 인덱스는 파일 끝의 복구 블록에서 일원화해 다룬다.
// 여기에 있던 블록은 sqlite_master를 인덱스 이름으로 전역 조회해서,
// 인덱스가 _projects_old에 붙어 있어도 "존재함"으로 판정하는 결함이 있었다.

// Migration: make rules_path nullable
const rulesPathCol = db.prepare(
  "SELECT \"notnull\" FROM pragma_table_info('projects') WHERE name='rules_path'"
).get() as { notnull: number } | undefined;
if (rulesPathCol && rulesPathCol.notnull === 1) {
  log('DB','Migrating: making rules_path nullable...');
  // RENAME 직후 자식 테이블(events, rules)의 FK가 잠시 존재하지 않는 projects를 가리키므로
  // 재구축 동안에는 FK 검사를 끈다. 다른 테이블 재구축 마이그레이션과 같은 패턴이다
  db.pragma('foreign_keys = OFF');
  // legacy_alter_table = ON: RENAME 시 자식 테이블의 FK 참조를 자동 변경하지 않도록 방지
  db.pragma('legacy_alter_table = ON');
  // 컬럼을 명시한다. SELECT * 위치 기반 복사는 projects에 컬럼이 하나만 늘어도 깨진다
  // (agent 추가 시 실제로 깨졌다). agent는 이 마이그레이션을 타는 레거시 DB에 없을 수 있어
  // 목록에서 빼고 DEFAULT에 맡긴다
  db.exec(`
    ALTER TABLE projects RENAME TO _projects_old;
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rules_path TEXT,
      agent TEXT NOT NULL DEFAULT 'claude_code',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO projects (id, name, description, rules_path, created_at, updated_at)
      SELECT id, name, description, rules_path, created_at, updated_at FROM _projects_old;
    DROP TABLE _projects_old;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_unique ON projects(name);
  `);
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
  log('DB','Migration complete: rules_path is now nullable');
}

// Migration: repair broken FK references (_projects_old → projects)
// ALTER TABLE RENAME with legacy_alter_table=OFF rewrites child FK definitions
const brokenFk = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='events'"
).get() as { sql: string } | undefined;
if (brokenFk && brokenFk.sql.includes('_projects_old')) {
  log('DB','Migrating: repairing broken FK references (_projects_old → projects)...');
  db.pragma('foreign_keys = OFF');
  db.exec(`
    -- events
    CREATE TABLE events_repair (
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
      duration_ms INTEGER,
      prompt TEXT,
      summary TEXT,
      result TEXT,
      task_id TEXT
    );
    INSERT INTO events_repair SELECT * FROM events;
    DROP TABLE events;
    ALTER TABLE events_repair RENAME TO events;
    CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_rule ON events(rule_id);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);

    -- rules
    CREATE TABLE rules_repair (
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
    INSERT INTO rules_repair SELECT * FROM rules;
    DROP TABLE rules;
    ALTER TABLE rules_repair RENAME TO rules;

    -- action_registry
    CREATE TABLE action_registry_repair (
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
    INSERT INTO action_registry_repair SELECT * FROM action_registry;
    DROP TABLE action_registry;
    ALTER TABLE action_registry_repair RENAME TO action_registry;
    CREATE INDEX IF NOT EXISTS idx_action_registry_project ON action_registry(project_id);

    -- action_prefixes
    CREATE TABLE action_prefixes_repair (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      prefix TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(project_id, prefix)
    );
    INSERT INTO action_prefixes_repair SELECT * FROM action_prefixes;
    DROP TABLE action_prefixes;
    ALTER TABLE action_prefixes_repair RENAME TO action_prefixes;

    -- detail_keywords
    CREATE TABLE detail_keywords_repair (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      UNIQUE(project_id, keyword)
    );
    INSERT INTO detail_keywords_repair SELECT * FROM detail_keywords;
    DROP TABLE detail_keywords;
    ALTER TABLE detail_keywords_repair RENAME TO detail_keywords;
    CREATE INDEX IF NOT EXISTS idx_detail_keywords_project ON detail_keywords(project_id);
  `);
  log('DB','Migration complete: FK references repaired');
}

// Migration: add item_count column to rules and backfill from files
const hasItemCount = db.prepare(
  "SELECT COUNT(*) as cnt FROM pragma_table_info('rules') WHERE name='item_count'"
).get() as { cnt: number };
if (hasItemCount.cnt === 0) {
  log('DB','Migrating: adding item_count column to rules...');
  db.exec(`ALTER TABLE rules ADD COLUMN item_count INTEGER NOT NULL DEFAULT 0`);
  log('DB','Migration complete: item_count column added');
}

// Backfill item_count for existing rules where it's 0
const needsBackfill = db.prepare(
  "SELECT COUNT(*) as cnt FROM rules WHERE item_count = 0"
).get() as { cnt: number };
if (needsBackfill.cnt > 0) {
  log('DB', `Backfilling item_count for ${needsBackfill.cnt} rules...`);

  function countItems(content: string): number {
    const lines = content.split('\n');
    let count = 0;
    let inSection = false;
    let inCode = false;
    for (const line of lines) {
      if (line.startsWith('```')) { inCode = !inCode; continue; }
      if (inCode) continue;
      if (/^##\s/.test(line)) { inSection = /^##\s+(MUST|PREFER)\b/i.test(line); continue; }
      if (inSection && /^- /.test(line)) count++;
    }
    return count;
  }

  const rows = db.prepare(
    `SELECT r.id, r.project_id, r.file_path, p.rules_path
     FROM rules r JOIN projects p ON r.project_id = p.id
     WHERE r.item_count = 0 AND p.rules_path IS NOT NULL`
  ).all() as { id: string; project_id: string; file_path: string; rules_path: string }[];

  const updateItemCount = db.prepare('UPDATE rules SET item_count = ? WHERE id = ? AND project_id = ?');
  let filled = 0;
  for (const row of rows) {
    const fullPath = path.resolve(row.rules_path, row.file_path);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const count = countItems(content);
    if (count > 0) {
      updateItemCount.run(count, row.id, row.project_id);
      filled++;
    }
  }
  log('DB', `Backfill complete: updated ${filled} rules with item_count`);
}

// Migration: add agent column to projects (default 'claude_code')
const hasAgentCol = db.prepare(
  "SELECT COUNT(*) as cnt FROM pragma_table_info('projects') WHERE name='agent'"
).get() as { cnt: number };
if (hasAgentCol.cnt === 0) {
  log('DB','Migrating: adding agent column to projects...');
  db.exec(`
    ALTER TABLE projects ADD COLUMN agent TEXT NOT NULL DEFAULT 'claude_code';
  `);
  log('DB','Migration complete: agent column added (defaulted to claude_code)');
}

// Migration: soft delete for rules (status/removed_at)
// 주의: FK-repair 블록보다 반드시 뒤에 위치해야 한다.
// repair는 rules를 컬럼 목록 없이 재생성하고 SELECT * 로 위치 기반 복사를 하므로,
// 그 앞에서 컬럼을 추가하면 컬럼 수가 어긋난다.
const hasRuleStatus = db.prepare(
  "SELECT COUNT(*) as cnt FROM pragma_table_info('rules') WHERE name='status'"
).get() as { cnt: number };
if (hasRuleStatus.cnt === 0) {
  log('DB','Migrating: adding status/removed_at columns to rules...');
  db.exec(`
    ALTER TABLE rules ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE rules ADD COLUMN removed_at TEXT;
  `);
  log('DB','Migration complete: rules soft delete columns added');
}

// rename 추적: 옛 규칙 id → 현재 규칙 id 매핑
db.exec(`
  CREATE TABLE IF NOT EXISTS rule_aliases (
    project_id TEXT NOT NULL REFERENCES projects(id),
    old_id TEXT NOT NULL,
    new_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, old_id)
  );

  CREATE INDEX IF NOT EXISTS idx_rules_project_status ON rules(project_id, status);
  CREATE INDEX IF NOT EXISTS idx_rule_aliases_new ON rule_aliases(project_id, new_id);
`);

// Migration: 중단된 rules_path nullable 마이그레이션이 남긴 _projects_old 정리.
// 과거 버전은 이 블록을 foreign_keys = OFF 없이 실행해 DROP 단계에서 죽었고,
// 그 결과 고아 테이블과 거기 딸린 UNIQUE 인덱스가 남은 DB가 있다.
const orphanProjectsTable = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='_projects_old'"
).get() as { name: string } | undefined;

if (orphanProjectsTable) {
  // 실패해도 서버는 떠야 한다. 고아 테이블이 남는 편이 기동 불가보다 낫다
  try {
    interface OrphanRow {
      id: string; name: string; description: string | null;
      rules_path: string | null; created_at: string; updated_at: string;
    }

    log('DB','Migrating: cleaning up orphaned _projects_old...');

    // DROP은 되돌릴 수 없으니 무엇을 버리는지 먼저 남긴다
    const orphanRows = db.prepare(
      'SELECT id, name, description, rules_path, created_at, updated_at FROM _projects_old'
    ).all() as OrphanRow[];
    const currentRows = db.prepare('SELECT id, name, rules_path FROM projects').all() as
      { id: string; name: string; rules_path: string | null }[];
    const currentById = new Map(currentRows.map((r) => [r.id, r]));

    for (const row of orphanRows) {
      const current = currentById.get(row.id);
      if (!current) continue;
      // 같은 id인데 내용이 다르면 현재 행이 이긴다. 조용히 넘기지 않는다
      if (current.name !== row.name || current.rules_path !== row.rules_path) {
        warn('DB',
          `_projects_old differs from projects for ${row.id}: ` +
          `name "${row.name}"→"${current.name}", rules_path "${row.rules_path}"→"${current.rules_path}"`);
      }
    }

    db.pragma('foreign_keys = OFF');
    // OR IGNORE는 제약 위반을 전부 삼킨다. 옮길 대상을 조건으로 명시한다
    const recovered = db.prepare(`
      INSERT INTO projects (id, name, description, rules_path, created_at, updated_at)
      SELECT id, name, description, rules_path, created_at, updated_at FROM _projects_old
      WHERE id NOT IN (SELECT id FROM projects)
    `).run();
    db.exec('DROP TABLE _projects_old');
    // foreign_keys는 파일 끝에서 일괄 복구한다 (FK-repair 블록과 같은 규약)
    log('DB',
      `Migration complete: _projects_old removed (${orphanRows.length} rows, ${recovered.changes} recovered)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    warn('DB', `Orphan _projects_old cleanup skipped: ${message}`);
  }
}

// Migration: projects(name) UNIQUE 인덱스 확보.
// 인덱스 이름을 전역 조회하면 _projects_old에 붙은 것까지 잡히므로 projects 자체를 본다
const projectIndexes = db.prepare("SELECT name FROM pragma_index_list('projects')")
  .all() as { name: string }[];
if (!projectIndexes.some((i) => i.name === 'idx_projects_name_unique')) {
  const dupes = db.prepare(
    'SELECT name, GROUP_CONCAT(id) as ids, COUNT(*) as cnt FROM projects GROUP BY name HAVING cnt > 1'
  ).all() as { name: string; ids: string; cnt: number }[];

  if (dupes.length > 0) {
    // 여기서 인덱스를 만들면 throw되어 서버가 못 뜬다. 정리는 운영자 몫으로 남긴다
    warn('DB',
      'Cannot restore projects(name) unique index — duplicate names: ' +
      dupes.map((d) => `"${d.name}" (${d.ids})`).join(', '));
  } else {
    log('DB','Migrating: restoring projects(name) unique index...');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_unique ON projects(name)');
    // 인덱스 이름은 DB 전역이라, 고아 테이블이 아직 그 이름을 쥐고 있으면 위 문장이
    // 조용히 no-op 된다. 실제로 붙었는지 확인하고 아니면 알린다
    const restored = db.prepare("SELECT name FROM pragma_index_list('projects')")
      .all() as { name: string }[];
    if (restored.some((i) => i.name === 'idx_projects_name_unique')) {
      log('DB','Migration complete: projects(name) unique index restored');
    } else {
      warn('DB','projects(name) unique index NOT restored — index name is held elsewhere');
    }
  }
}

// Analytics composite indexes for Phase 2 analysis queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_events_project_type ON events(project_id, type);
  CREATE INDEX IF NOT EXISTS idx_events_project_rule_type ON events(project_id, rule_id, type);
`);

db.pragma('foreign_keys = ON');

const _selectProjectIdByName = db.prepare<
  { name: string },
  { id: string }
>('SELECT id FROM projects WHERE name = @name');

export function getProjectIdByName(name: string): string | undefined {
  const row = _selectProjectIdByName.get({ name });
  return row?.id;
}

export default db;
