import type { RuleEvent, Rule } from '@/lib/api';

// ── Types ──

export type RuleChipStatus = 'idle' | 'checking' | 'passed' | 'violated';

export interface RuleChipData {
  rule: Rule;
  status: RuleChipStatus;
  checkCount: number;
  lastTimestamp: string | null;
}

export interface CycleEntry {
  event: RuleEvent;
  ruleId: string;
  action: string;
  status: 'check' | 'pass' | 'violation' | 'fix';
}

export interface VerificationCycle {
  id: string;
  startTimestamp: string;
  endTimestamp: string;
  result: 'pass' | 'issue' | 'open';
  taskId: string | null;
  entries: CycleEntry[];
}

// ── Chip data computation ──

export function computeRuleChipData(rules: Rule[], events: RuleEvent[]): RuleChipData[] {
  const checkCount = new Map<string, number>();
  const hasViolation = new Set<string>();
  const hasPass = new Set<string>();
  const hasCheck = new Set<string>();
  const lastTs = new Map<string, string>();

  for (const e of events) {
    const rid = e.rule_id;
    if (!rid) continue;

    // Track latest timestamp
    const prev = lastTs.get(rid);
    if (!prev || e.timestamp > prev) lastTs.set(rid, e.timestamp);

    if (e.type === 'check_rule' || e.action === 'check_rule') {
      hasCheck.add(rid);
      checkCount.set(rid, (checkCount.get(rid) || 0) + 1);
    }
    if (e.type === 'rule_violation' || e.type === 'violation_found' || e.action === 'rule_violation' || e.action === 'violation_found') {
      hasViolation.add(rid);
    }
    if (e.type === 'rule_pass' || e.type === 'review_pass' || e.action === 'rule_pass' || e.action === 'review_pass') {
      hasPass.add(rid);
    }
  }

  return rules.map((rule) => {
    let status: RuleChipStatus = 'idle';
    if (hasViolation.has(rule.id)) status = 'violated';
    else if (hasPass.has(rule.id)) status = 'passed';
    else if (hasCheck.has(rule.id)) status = 'checking';

    return {
      rule,
      status,
      checkCount: checkCount.get(rule.id) || 0,
      lastTimestamp: lastTs.get(rule.id) ?? null,
    };
  });
}

// ── Verification cycles grouping ──

export function groupVerificationCycles(events: RuleEvent[]): VerificationCycle[] {
  const cycles: VerificationCycle[] = [];
  let openCycle: VerificationCycle | null = null;
  let cycleIdx = 0;

  // Process events in chronological order (oldest first)
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  for (const e of sorted) {
    const rid = e.rule_id;
    if (!rid) continue;

    const t = e.type;
    const a = e.action;
    const isCheck = t === 'check_rule' || a === 'check_rule';
    const isPass = t === 'review_pass' || t === 'rule_pass' || a === 'review_pass' || a === 'rule_pass';
    const isIssue = t === 'review_issue' || t === 'rule_violation' || t === 'violation_found' || a === 'review_issue' || a === 'rule_violation' || a === 'violation_found';
    const isFix = t === 'fix_applied' || a === 'fix_applied';

    if (!isCheck && !isPass && !isIssue && !isFix) continue;

    const entryStatus: CycleEntry['status'] = isCheck
      ? 'check'
      : isPass
        ? 'pass'
        : isIssue
          ? 'violation'
          : 'fix';

    const entry: CycleEntry = {
      event: e,
      ruleId: rid,
      action: e.action || e.type,
      status: entryStatus,
    };

    // Start a new cycle on check_rule when no open cycle
    if (isCheck && !openCycle) {
      openCycle = {
        id: `cycle-${cycleIdx++}`,
        startTimestamp: e.timestamp,
        endTimestamp: e.timestamp,
        result: 'open',
        taskId: e.task_id,
        entries: [entry],
      };
      continue;
    }

    if (openCycle) {
      openCycle.entries.push(entry);
      openCycle.endTimestamp = e.timestamp;

      // Close cycle on pass or issue
      if (isPass) {
        openCycle.result = 'pass';
        cycles.push(openCycle);
        openCycle = null;
      } else if (isIssue) {
        openCycle.result = 'issue';
        cycles.push(openCycle);
        openCycle = null;
      }
    } else {
      // No open cycle — start one implicitly
      openCycle = {
        id: `cycle-${cycleIdx++}`,
        startTimestamp: e.timestamp,
        endTimestamp: e.timestamp,
        result: 'open',
        taskId: e.task_id,
        entries: [entry],
      };
    }
  }

  // Push any remaining open cycle
  if (openCycle) {
    cycles.push(openCycle);
  }

  // Return newest first
  return cycles.reverse();
}
