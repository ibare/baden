import db from '../db/connection.js';

// ────── Action Prefix types & statements ──────

export interface ActionPrefix {
  id: number;
  project_id: string;
  prefix: string;
  category: string;
  label: string;
  icon: string | null;
  sort_order: number;
}

const prefixCache = new Map<string, ActionPrefix[]>();

const selectPrefixes = db.prepare(`
  SELECT * FROM action_prefixes WHERE project_id = ? ORDER BY length(prefix) DESC, sort_order ASC
`);

const selectPrefixById = db.prepare(`SELECT * FROM action_prefixes WHERE id = ?`);

const insertPrefixStmt = db.prepare(`
  INSERT INTO action_prefixes (project_id, prefix, category, label, icon, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const updatePrefixStmt = db.prepare(`
  UPDATE action_prefixes SET prefix = ?, category = ?, label = ?, icon = ?, sort_order = ?
  WHERE id = ?
`);

const deletePrefixStmt = db.prepare(`DELETE FROM action_prefixes WHERE id = ?`);

const maxSortOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) as mx FROM action_prefixes WHERE project_id = ?`);

export function invalidatePrefixCache(projectId: string): void {
  prefixCache.delete(projectId);
}

export function getPrefixes(projectId: string): ActionPrefix[] {
  if (prefixCache.has(projectId)) return prefixCache.get(projectId)!;
  const rows = selectPrefixes.all(projectId) as ActionPrefix[];
  prefixCache.set(projectId, rows);
  return rows;
}

export function createPrefix(
  projectId: string,
  data: { prefix: string; category: string; label: string; icon?: string | null },
): ActionPrefix {
  const { mx } = maxSortOrder.get(projectId) as { mx: number };
  const result = insertPrefixStmt.run(projectId, data.prefix, data.category, data.label, data.icon || null, mx + 1);
  invalidatePrefixCache(projectId);
  return selectPrefixById.get(result.lastInsertRowid) as ActionPrefix;
}

export function updatePrefix(
  id: number,
  data: { prefix?: string; category?: string; label?: string; icon?: string | null; sort_order?: number },
): ActionPrefix | null {
  const existing = selectPrefixById.get(id) as ActionPrefix | undefined;
  if (!existing) return null;
  updatePrefixStmt.run(
    data.prefix !== undefined ? data.prefix : existing.prefix,
    data.category !== undefined ? data.category : existing.category,
    data.label !== undefined ? data.label : existing.label,
    data.icon !== undefined ? data.icon : existing.icon,
    data.sort_order !== undefined ? data.sort_order : existing.sort_order,
    id,
  );
  invalidatePrefixCache(existing.project_id);
  return selectPrefixById.get(id) as ActionPrefix;
}

export function deletePrefix(id: number): boolean {
  const existing = selectPrefixById.get(id) as ActionPrefix | undefined;
  if (!existing) return false;
  deletePrefixStmt.run(id);
  invalidatePrefixCache(existing.project_id);
  return true;
}

export function extractPrefix(
  action: string,
  prefixes: ActionPrefix[],
): { prefix: ActionPrefix; detail: string } | null {
  // prefixes are already sorted by length(prefix) DESC
  for (const p of prefixes) {
    if (action === p.prefix || action.startsWith(p.prefix + '_')) {
      const detail = action === p.prefix ? '' : action.slice(p.prefix.length + 1);
      return { prefix: p, detail };
    }
  }
  return null;
}

// ────── Action Registry (existing — action log collection) ──────

export interface ActionRegistryEntry {
  id: number;
  project_id: string;
  pattern: string;
  pattern_type: 'exact' | 'wildcard';
  category: string | null;
  label: string | null;
  icon: string | null;
  confirmed: number;
  sample_count: number;
  first_seen: string;
  last_seen: string;
}

// In-memory cache: projectId → entries
const cache = new Map<string, ActionRegistryEntry[]>();

const upsertAction = db.prepare(`
  INSERT INTO action_registry (project_id, pattern, pattern_type, sample_count, first_seen, last_seen)
  VALUES (?, ?, 'exact', 1, datetime('now'), datetime('now'))
  ON CONFLICT(project_id, pattern) DO UPDATE SET
    sample_count = sample_count + 1,
    last_seen = datetime('now')
`);

const selectAll = db.prepare(`
  SELECT * FROM action_registry WHERE project_id = ? ORDER BY last_seen DESC
`);

const selectById = db.prepare(`SELECT * FROM action_registry WHERE id = ?`);

const updateStmt = db.prepare(`
  UPDATE action_registry SET category = ?, label = ?, icon = ?, confirmed = ?, pattern_type = ?
  WHERE id = ?
`);

const insertPattern = db.prepare(`
  INSERT INTO action_registry (project_id, pattern, pattern_type, category, label, icon, confirmed, sample_count, first_seen, last_seen)
  VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))
`);

const deleteStmt = db.prepare(`DELETE FROM action_registry WHERE id = ?`);

const bulkConfirmStmt = db.prepare(`
  UPDATE action_registry SET confirmed = 1 WHERE id = ?
`);

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function invalidateCache(projectId: string): void {
  cache.delete(projectId);
}

export function getEntries(projectId: string): ActionRegistryEntry[] {
  if (cache.has(projectId)) return cache.get(projectId)!;
  const entries = selectAll.all(projectId) as ActionRegistryEntry[];
  cache.set(projectId, entries);
  return entries;
}

export function registerAction(projectId: string, action: string): void {
  upsertAction.run(projectId, action);
  invalidateCache(projectId);
}

export function matchAction(projectId: string, action: string): { category: string; label: string | null; icon: string | null } | null {
  const entries = getEntries(projectId);
  const confirmed = entries.filter((e) => e.confirmed && e.category);

  // 1. Exact match first
  const exact = confirmed.find((e) => e.pattern_type === 'exact' && e.pattern === action);
  if (exact) return { category: exact.category!, label: exact.label, icon: exact.icon };

  // 2. Wildcard match
  for (const entry of confirmed) {
    if (entry.pattern_type === 'wildcard') {
      const regex = wildcardToRegex(entry.pattern);
      if (regex.test(action)) {
        return { category: entry.category!, label: entry.label, icon: entry.icon };
      }
    }
  }

  return null;
}

export function updateEntry(
  id: number,
  data: { category?: string | null; label?: string | null; icon?: string | null; confirmed?: number; pattern_type?: string },
): ActionRegistryEntry | null {
  const existing = selectById.get(id) as ActionRegistryEntry | undefined;
  if (!existing) return null;

  updateStmt.run(
    data.category !== undefined ? data.category : existing.category,
    data.label !== undefined ? data.label : existing.label,
    data.icon !== undefined ? data.icon : existing.icon,
    data.confirmed !== undefined ? data.confirmed : existing.confirmed,
    data.pattern_type !== undefined ? data.pattern_type : existing.pattern_type,
    id,
  );

  invalidateCache(existing.project_id);
  return selectById.get(id) as ActionRegistryEntry;
}

export function createPattern(
  projectId: string,
  data: { pattern: string; pattern_type: string; category?: string | null; label?: string | null; icon?: string | null },
): ActionRegistryEntry {
  const result = insertPattern.run(
    projectId,
    data.pattern,
    data.pattern_type,
    data.category || null,
    data.label || null,
    data.icon || null,
  );

  invalidateCache(projectId);
  return selectById.get(result.lastInsertRowid) as ActionRegistryEntry;
}

export function deleteEntry(id: number): boolean {
  const existing = selectById.get(id) as ActionRegistryEntry | undefined;
  if (!existing) return false;
  deleteStmt.run(id);
  invalidateCache(existing.project_id);
  return true;
}

export function bulkConfirm(ids: number[]): number {
  const tx = db.transaction((ids: number[]) => {
    let count = 0;
    for (const id of ids) {
      const result = bulkConfirmStmt.run(id);
      count += result.changes;
    }
    return count;
  });
  const count = tx(ids);

  // Invalidate all affected projects
  for (const id of ids) {
    const entry = selectById.get(id) as ActionRegistryEntry | undefined;
    if (entry) invalidateCache(entry.project_id);
  }

  return count;
}

export function testPattern(projectId: string, pattern: string, patternType: string): string[] {
  const entries = getEntries(projectId);
  const exactActions = entries.filter((e) => e.pattern_type === 'exact').map((e) => e.pattern);

  if (patternType === 'exact') {
    return exactActions.filter((a) => a === pattern);
  }

  const regex = wildcardToRegex(pattern);
  return exactActions.filter((a) => regex.test(a));
}
