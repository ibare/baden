import type { RuleEvent, Rule } from '@/lib/api';
import { EVENT_CATEGORY_MAP, CATEGORY_CONFIG, TYPE_CONFIG } from '@/lib/event-types';

interface EventDetailProps {
  event: RuleEvent | null;
  rule: Rule | null;
  ruleEventCount?: number;
}

/** Try to parse a JSON string into a flat record for display */
function parseDetail(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined) continue;
      out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground font-medium break-all min-w-0">{children}</dd>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-border/60 my-2" />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-base font-bold text-foreground pt-2 pb-1">{children}</h4>;
}

export function EventDetail({ event, rule, ruleEventCount }: EventDetailProps) {
  if (rule && !event) {
    return (
      <div className="flex flex-col p-4 text-sm overflow-y-auto">
        <SectionTitle>Rules</SectionTitle>
        <dl>
          <Row label="Rule ID"><span className="font-mono text-xs">{rule.id}</span></Row>
          <Row label="Category">{rule.category}</Row>
          <Row label="File"><span className="font-mono text-xs">{rule.file_path}</span></Row>
          {rule.description && <Row label="Description">{rule.description}</Row>}
          {rule.triggers && <Row label="Triggers">{rule.triggers}</Row>}
          {ruleEventCount !== undefined && <Row label="Events">{ruleEventCount}건</Row>}
        </dl>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        이벤트를 클릭하면 상세 정보가 표시됩니다
      </div>
    );
  }

  const category = EVENT_CATEGORY_MAP[event.type];
  const catConfig = category ? CATEGORY_CONFIG[category] : null;
  const typeConfig = TYPE_CONFIG[event.type];
  const time = new Date(event.timestamp).toLocaleTimeString('ko-KR');
  const detail = parseDetail(event.detail);

  const hasActivity = event.message || event.summary || event.result || event.prompt;

  return (
    <div className="flex flex-col p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {typeConfig && <span className={`text-lg ${typeConfig.color}`}>{typeConfig.icon}</span>}
        <span className="text-base font-bold text-foreground">
          {event.action || event.type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Details section */}
      <SectionTitle>Details</SectionTitle>
      <dl>
        <Row label="Type">
          <span className={typeConfig?.color ?? 'text-foreground'}>
            {catConfig?.label ?? '-'} &rsaquo; {event.type.replace(/_/g, ' ')}
          </span>
        </Row>
        <Row label="Time"><span className="font-mono text-xs">{time}</span></Row>
        {event.file && (
          <Row label="File">
            <span className="font-mono text-xs">{event.file}{event.line ? `:${event.line}` : ''}</span>
          </Row>
        )}
        {event.rule_id && (
          <Row label="Rule"><span className="font-mono text-xs">{event.rule_id}</span></Row>
        )}
        {event.severity && <Row label="Severity">{event.severity}</Row>}
        {event.task_id && (
          <Row label="Task ID"><span className="font-mono text-[10px]">{event.task_id}</span></Row>
        )}
        {event.agent && <Row label="Agent">{event.agent}</Row>}
        {event.duration_ms != null && <Row label="Duration">{event.duration_ms}ms</Row>}

        {/* Parsed detail JSON fields */}
        {detail && Object.entries(detail).map(([key, value]) => (
          <Row key={key} label={key}>
            {value.length > 120
              ? <span className="font-mono text-xs">{value}</span>
              : value}
          </Row>
        ))}
      </dl>

      {/* Activity section */}
      {hasActivity && (
        <>
          <Divider />
          <SectionTitle>Activity</SectionTitle>
          <dl>
            {event.message && (
              <Row label="Reason">
                <span className="font-normal whitespace-pre-wrap">{event.message}</span>
              </Row>
            )}
            {event.summary && (
              <Row label="Summary">
                <span className="font-normal whitespace-pre-wrap">{event.summary}</span>
              </Row>
            )}
            {event.prompt && (
              <Row label="Prompt">
                <span className="font-normal text-xs whitespace-pre-wrap bg-purple-50 dark:bg-purple-950/30 rounded px-2 py-1 inline-block">
                  {event.prompt}
                </span>
              </Row>
            )}
            {event.result && (
              <Row label="Result">
                <pre className="font-mono text-xs whitespace-pre-wrap bg-muted/50 rounded px-2 py-1 max-h-48 overflow-y-auto">
                  {event.result}
                </pre>
              </Row>
            )}
          </dl>
        </>
      )}
    </div>
  );
}
