import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RuleEvent, Rule } from '@/lib/api';
import { api } from '@/lib/api';
import { EVENT_CATEGORY_MAP, CATEGORY_CONFIG, TYPE_CONFIG } from '@/lib/event-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

const TRIGGER_LABELS: Record<string, string> = {
  paths: 'Paths',
  patterns: 'Patterns',
  imports: 'Imports',
  events: 'Events',
};

function parseTriggers(raw: string | null): Record<string, string[]> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v.length > 0) {
        out[k] = v.map(String);
      }
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

function TriggersBlock({ triggers }: { triggers: Record<string, string[]> }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs text-muted-foreground mb-2">Triggers</dt>
      <dd className="space-y-1.5 ml-1">
        {Object.entries(triggers).map(([key, values]) => (
          <div key={key} className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              {TRIGGER_LABELS[key] || key}
            </span>
            <div className="flex flex-wrap gap-1">
              {values.map((v) => (
                <code
                  key={v}
                  className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
                >
                  {v}
                </code>
              ))}
            </div>
          </div>
        ))}
      </dd>
    </div>
  );
}

function RuleContentDialog({
  open,
  onOpenChange,
  title,
  body,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string | null;
  body: string | null;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[800px] sm:max-w-[800px] max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title ?? 'Loading...'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : body !== null ? (
          <div className="overflow-y-auto min-h-0 prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2 prose-table:my-2 prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  if (match) {
                    return (
                      <SyntaxHighlighter
                        style={oneLight}
                        language={match[1]}
                        PreTag="div"
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    );
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {body}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="overflow-y-auto min-h-0 text-sm text-muted-foreground py-4">
            Failed to load file.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EventDetail({ event, rule, ruleEventCount }: EventDetailProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ruleTitle, setRuleTitle] = useState<string | null>(null);
  const [ruleBody, setRuleBody] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [taskReason, setTaskReason] = useState<string | null>(null);

  useEffect(() => {
    setTaskReason(null);
    if (!event?.task_id || event.prompt) return;

    let cancelled = false;
    api.getEvents({ taskId: event.task_id }).then((events) => {
      if (cancelled) return;
      const promptEvent = events.find((e) => e.prompt !== null);
      setTaskReason(promptEvent?.message ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [event?.task_id, event?.prompt]);

  const handleFileClick = async () => {
    if (!rule) return;
    setDialogOpen(true);
    setContentLoading(true);
    try {
      const { title, body } = await api.getRuleContent(rule.project_id, rule.id);
      setRuleTitle(title);
      setRuleBody(body);
    } catch {
      setRuleTitle(null);
      setRuleBody(null);
    } finally {
      setContentLoading(false);
    }
  };

  if (rule && !event) {
    const triggers = parseTriggers(rule.triggers);

    return (
      <div className="flex flex-col p-4 text-sm overflow-y-auto">
        <SectionTitle>Rules</SectionTitle>
        <dl>
          <Row label="Rule ID"><span className="font-mono text-xs">{rule.id}</span></Row>
          <Row label="Category">{rule.category}</Row>
          <Row label="File">
            <button
              type="button"
              onClick={handleFileClick}
              className="font-mono text-xs text-blue-600 dark:text-blue-400 underline underline-offset-2 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              {rule.file_path}
            </button>
          </Row>
          {rule.description && <Row label="Description">{rule.description}</Row>}
          {triggers ? (
            <TriggersBlock triggers={triggers} />
          ) : rule.triggers ? (
            <Row label="Triggers">{rule.triggers}</Row>
          ) : null}
          {ruleEventCount !== undefined && <Row label="Events">{ruleEventCount}</Row>}
        </dl>
        <RuleContentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={ruleTitle}
          body={ruleBody}
          loading={contentLoading}
        />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Click an event to see details
      </div>
    );
  }

  const category = EVENT_CATEGORY_MAP[event.type];
  const catConfig = category ? CATEGORY_CONFIG[category] : null;
  const typeConfig = TYPE_CONFIG[event.type];
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false });
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

      {/* Task reason banner */}
      {taskReason && (
        <div className="flex items-start gap-2 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 px-3 py-2 mb-2">
          <span className="text-purple-500 shrink-0 mt-0.5 text-sm">▸</span>
          <p className="text-xs text-purple-700 dark:text-purple-300 whitespace-pre-wrap leading-relaxed">
            {taskReason}
          </p>
        </div>
      )}

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
