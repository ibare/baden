import fs from 'fs';
import path from 'path';
import db from '../db/connection.js';
import { parseRules } from './rule-parser.js';
import { log, warn } from '../logger.js';
import type { ParsedRule, RuleSyncResult } from '../types.js';

/** DB에 저장된 규칙 행 중 동기화 판정에 필요한 컬럼 */
interface RuleRow {
  id: string;
  category: string;
  file_path: string;
  description: string | null;
  triggers: string | null;
  content_hash: string | null;
  item_count: number;
  status: string;
}

// ─── prepared statements (C2: 모듈 최상위) ───

const selectRulesByProject = db.prepare(`
  SELECT id, category, file_path, description, triggers, content_hash, item_count, status
  FROM rules WHERE project_id = ?
`);

const insertRule = db.prepare(`
  INSERT INTO rules (id, project_id, category, file_path, description, triggers,
                     content_hash, item_count, status, removed_at, parsed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, datetime('now'))
`);

/** 갱신·복원 공용. status를 명시적으로 되돌린다 (INSERT OR REPLACE는 NOT NULL 컬럼을 깨뜨린다) */
const updateRule = db.prepare(`
  UPDATE rules SET category = ?, file_path = ?, description = ?, triggers = ?,
                   content_hash = ?, item_count = ?, status = 'active',
                   removed_at = NULL, parsed_at = datetime('now')
  WHERE id = ? AND project_id = ?
`);

const markRuleRemoved = db.prepare(`
  UPDATE rules SET status = 'removed', removed_at = datetime('now')
  WHERE id = ? AND project_id = ?
`);

const insertAlias = db.prepare(`
  INSERT OR REPLACE INTO rule_aliases (project_id, old_id, new_id) VALUES (?, ?, ?)
`);

/** 체인 압축: 기존에 X → old_id 를 가리키던 별칭들을 X → new_id 로 당긴다 */
const retargetAliases = db.prepare(`
  UPDATE rule_aliases SET new_id = ? WHERE project_id = ? AND new_id = ?
`);

const deleteAliasByOldId = db.prepare(`
  DELETE FROM rule_aliases WHERE project_id = ? AND old_id = ?
`);

/** A→B 였다가 B가 다시 A로 되돌아오면 A→A 자기참조가 남는다 */
const deleteSelfAliases = db.prepare(`
  DELETE FROM rule_aliases WHERE project_id = ? AND old_id = new_id
`);

const selectAliasTarget = db.prepare(`
  SELECT new_id FROM rule_aliases WHERE project_id = ? AND old_id = ?
`);

const selectAliasSources = db.prepare(`
  SELECT old_id FROM rule_aliases WHERE project_id = ? AND new_id = ?
`);

const selectAliasesByProject = db.prepare(`
  SELECT old_id, new_id FROM rule_aliases WHERE project_id = ?
`);

const selectRemovedRuleIds = db.prepare(`
  SELECT id FROM rules WHERE project_id = ? AND status = 'removed'
`);

const selectProjectRulesPath = db.prepare(`
  SELECT rules_path FROM projects WHERE id = ?
`);

const selectActiveRuleFiles = db.prepare(`
  SELECT file_path FROM rules WHERE project_id = ? AND status = 'active'
`);

// ─── diff 판정 ───

function serializeTriggers(rule: ParsedRule): string | null {
  return rule.triggers ? JSON.stringify(rule.triggers) : null;
}

/** 파일에서 읽은 규칙과 DB 행이 실질적으로 같은지 */
function isUnchanged(parsed: ParsedRule, row: RuleRow): boolean {
  return (
    row.status === 'active' &&
    row.category === parsed.category &&
    row.file_path === parsed.filePath &&
    row.description === parsed.description &&
    row.triggers === serializeTriggers(parsed) &&
    row.content_hash === parsed.contentHash &&
    row.item_count === parsed.itemCount
  );
}

/**
 * 해시 → id 목록으로 묶는다.
 * rename 판정은 양쪽 모두 후보가 정확히 하나인 해시에서만 성립시킨다.
 */
function groupByHash<T>(items: T[], hashOf: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const hash = hashOf(item);
    if (!hash) continue;
    const bucket = map.get(hash);
    if (bucket) bucket.push(item);
    else map.set(hash, [item]);
  }
  return map;
}

/**
 * rules 디렉토리를 재스캔해 DB 상태와 맞춘다.
 *
 * 사라진 규칙은 하드 삭제하지 않고 status='removed'로 남긴다.
 * events.rule_id에는 FK가 없어 행을 지워도 이벤트는 남는데, 그러면 규칙 기준 집계에서만
 * 조용히 빠져 이벤트 기준 집계와 숫자가 어긋나기 때문이다.
 */
export function syncProjectRules(projectId: string, rulesPath: string): RuleSyncResult {
  // 파일 IO는 트랜잭션 밖에서
  const parsedRules = parseRules(rulesPath);

  const apply = db.transaction((): RuleSyncResult => {
    const result: RuleSyncResult = {
      added: [], updated: [], removed: [], renamed: [], restored: [], unchanged: [],
    };

    const rows = selectRulesByProject.all(projectId) as RuleRow[];
    const rowById = new Map(rows.map((r) => [r.id, r]));

    const newCandidates: ParsedRule[] = [];

    // 1) id가 그대로인 규칙 — 갱신 / 복원 / 무변화
    for (const parsed of parsedRules) {
      const row = rowById.get(parsed.id);
      if (!row) {
        newCandidates.push(parsed);
        continue;
      }

      if (isUnchanged(parsed, row)) {
        result.unchanged.push(parsed.id);
        continue;
      }

      updateRule.run(
        parsed.category, parsed.filePath, parsed.description, serializeTriggers(parsed),
        parsed.contentHash, parsed.itemCount, parsed.id, projectId,
      );

      if (row.status === 'removed') {
        // 되살아난 규칙은 더 이상 다른 규칙의 옛 이름이 아니다
        deleteAliasByOldId.run(projectId, parsed.id);
        result.restored.push(parsed.id);
      } else {
        result.updated.push(parsed.id);
      }
    }

    // 2) 사라진 규칙 후보 — 파일에 없는 active 행
    const parsedIds = new Set(parsedRules.map((r) => r.id));
    const goneCandidates = rows.filter((r) => r.status === 'active' && !parsedIds.has(r.id));

    // 3) rename 판정: 같은 content_hash를 가진 신규 1 : 사라짐 1 쌍만 인정
    const goneByHash = groupByHash(goneCandidates, (r) => r.content_hash);
    const newByHash = groupByHash(newCandidates, (r) => r.contentHash);

    const renamedFrom = new Set<string>();
    const renamedTo = new Set<string>();

    for (const [hash, goneBucket] of goneByHash) {
      const newBucket = newByHash.get(hash);
      // 어느 한쪽이라도 여러 개면 어느 규칙이 어느 규칙이 되었는지 확정할 수 없다 → removed + added로 폴백
      if (!newBucket || goneBucket.length !== 1 || newBucket.length !== 1) continue;

      const from = goneBucket[0];
      const to = newBucket[0];

      insertRule.run(
        to.id, projectId, to.category, to.filePath, to.description,
        serializeTriggers(to), to.contentHash, to.itemCount,
      );
      markRuleRemoved.run(from.id, projectId);
      retargetAliases.run(to.id, projectId, from.id);
      insertAlias.run(projectId, from.id, to.id);

      renamedFrom.add(from.id);
      renamedTo.add(to.id);
      result.renamed.push({ from: from.id, to: to.id });
    }

    // 4) 남은 신규 / 사라짐
    for (const parsed of newCandidates) {
      if (renamedTo.has(parsed.id)) continue;
      insertRule.run(
        parsed.id, projectId, parsed.category, parsed.filePath, parsed.description,
        serializeTriggers(parsed), parsed.contentHash, parsed.itemCount,
      );
      result.added.push(parsed.id);
    }

    for (const row of goneCandidates) {
      if (renamedFrom.has(row.id)) continue;
      markRuleRemoved.run(row.id, projectId);
      result.removed.push(row.id);
    }

    if (result.renamed.length > 0) deleteSelfAliases.run(projectId);

    return result;
  });

  const result = apply();

  const changed =
    result.added.length + result.updated.length + result.removed.length +
    result.renamed.length + result.restored.length;
  if (changed > 0) {
    log('RuleSync',
      `project=${projectId} +${result.added.length} ~${result.updated.length} ` +
      `-${result.removed.length} rename=${result.renamed.length} restore=${result.restored.length}`);
  }

  // 파일이 바뀌었으니 스로틀 스냅샷도 새로 잡는다
  invalidateSyncThrottle(projectId);

  return result;
}

/** 옛 규칙 id를 현재 id로 해석한다. 별칭이 없으면 입력을 그대로 돌려준다 */
export function resolveRuleId(projectId: string, ruleId: string): string {
  const row = selectAliasTarget.get(projectId, ruleId) as { new_id: string } | undefined;
  return row?.new_id ?? ruleId;
}

/**
 * 이벤트 집계용 — 프로젝트의 옛 id → 현재 id 매핑 전체.
 * 이벤트를 한 건씩 조회하면 비싸므로 한 번 읽어 메모리에서 해석한다.
 */
export function getAliasMap(projectId: string): Map<string, string> {
  const rows = selectAliasesByProject.all(projectId) as { old_id: string; new_id: string }[];
  return new Map(rows.map((r) => [r.old_id, r.new_id]));
}

/** 삭제된 규칙 id 집합 — 집계 라벨에 "삭제됨"을 표시하는 용도 */
export function getRemovedRuleIds(projectId: string): Set<string> {
  const rows = selectRemovedRuleIds.all(projectId) as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

/** 이벤트 집계용 — 현재 id와 그 id로 이어지는 모든 옛 id */
export function collectRuleIdChain(projectId: string, ruleId: string): string[] {
  const current = resolveRuleId(projectId, ruleId);
  const sources = selectAliasSources.all(projectId, current) as { old_id: string }[];
  const ids = new Set<string>([current, ruleId]);
  for (const s of sources) ids.add(s.old_id);
  return [...ids];
}

// ─── lazy 재싱크 (수집 경로용) ───

const THROTTLE_MS = 30_000;

interface ThrottleEntry {
  checkedAt: number;
  signature: string;
}

const throttleCache = new Map<string, ThrottleEntry>();

/** 프로젝트 삭제·수동 싱크 등 뮤테이션 후 호출 (C2) */
export function invalidateSyncThrottle(projectId: string): void {
  throttleCache.delete(projectId);
}

/**
 * 규칙 파일들의 mtime 지문.
 * 전체 해시 재계산은 수집 경로에 넣기엔 비싸다. INDEX.yaml과 등록된 규칙 파일의
 * mtime만 본다 — 내용이 바뀌면 mtime도 바뀐다.
 */
function fileSignature(projectId: string, rulesPath: string): string {
  const parts: string[] = [];

  const indexPath = path.resolve(rulesPath, 'INDEX.yaml');
  parts.push(fs.existsSync(indexPath) ? String(fs.statSync(indexPath).mtimeMs) : 'none');

  const files = selectActiveRuleFiles.all(projectId) as { file_path: string }[];
  for (const f of files) {
    const full = path.resolve(rulesPath, f.file_path);
    parts.push(fs.existsSync(full) ? `${f.file_path}:${fs.statSync(full).mtimeMs}` : `${f.file_path}:gone`);
  }

  return parts.join('|');
}

/**
 * 수집 경로에서 호출하는 자동 재싱크.
 * 스로틀 검사를 가장 먼저 해서, 30초 이내 재호출이면 파일에 손도 대지 않는다.
 * 실패해도 절대 throw하지 않는다 — 모니터링이 에이전트를 막아서는 안 된다 (principles #1).
 */
export function maybeSyncRules(projectId: string): RuleSyncResult | null {
  const now = Date.now();
  const cached = throttleCache.get(projectId);
  if (cached && now - cached.checkedAt < THROTTLE_MS) return null;

  try {
    const project = selectProjectRulesPath.get(projectId) as { rules_path: string | null } | undefined;
    if (!project?.rules_path) {
      throttleCache.set(projectId, { checkedAt: now, signature: '' });
      return null;
    }

    const signature = fileSignature(projectId, project.rules_path);
    if (cached && cached.signature === signature) {
      throttleCache.set(projectId, { checkedAt: now, signature });
      return null;
    }

    // 최초 관측이면 지문만 기록하고 넘어간다. 서버 기동 직후 첫 이벤트마다
    // 전량 재파싱하는 것을 막기 위함 — 실제 변경은 다음 관측에서 잡힌다.
    if (!cached) {
      throttleCache.set(projectId, { checkedAt: now, signature });
      return null;
    }

    const result = syncProjectRules(projectId, project.rules_path);
    throttleCache.set(projectId, {
      checkedAt: now,
      signature: fileSignature(projectId, project.rules_path),
    });
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    warn('RuleSync', `auto sync skipped for project=${projectId}: ${message}`);
    // 실패한 프로젝트를 매 이벤트마다 재시도하지 않도록 스로틀 창은 소비한다
    throttleCache.set(projectId, { checkedAt: now, signature: cached?.signature ?? '' });
    return null;
  }
}
