import type { RuleEvent, Rule } from '@/lib/api';
import { EVENT_CATEGORY_MAP, CATEGORY_CONFIG, TYPE_CONFIG } from '@/lib/event-types';

interface EventDetailProps {
  event: RuleEvent | null;
  rule: Rule | null;
  ruleEventCount?: number;
}

export function EventDetail({ event, rule, ruleEventCount }: EventDetailProps) {
  if (rule && !event) {
    return (
      <div className="flex flex-col gap-3 p-3 text-sm">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">규칙 상세</h4>
        <div className="font-medium text-foreground font-mono">{rule.id}</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">카테고리</dt>
          <dd className="text-foreground">{rule.category}</dd>
          <dt className="text-muted-foreground">파일</dt>
          <dd className="text-foreground break-all">{rule.file_path}</dd>
          {rule.description && (
            <>
              <dt className="text-muted-foreground">설명</dt>
              <dd className="text-foreground">{rule.description}</dd>
            </>
          )}
          {rule.triggers && (
            <>
              <dt className="text-muted-foreground">트리거</dt>
              <dd className="text-foreground">{rule.triggers}</dd>
            </>
          )}
          {ruleEventCount !== undefined && (
            <>
              <dt className="text-muted-foreground">이벤트</dt>
              <dd className="text-foreground">{ruleEventCount}건</dd>
            </>
          )}
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

  let parsedDetail: string | null = null;
  if (event.detail) {
    try {
      parsedDetail = JSON.stringify(JSON.parse(event.detail), null, 2);
    } catch {
      parsedDetail = event.detail;
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-sm overflow-y-auto">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">이벤트 상세</h4>
      <div className={`font-medium ${typeConfig?.color ?? 'text-foreground'}`}>
        {event.action || event.type.replace(/_/g, ' ')}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">분류</dt>
        <dd className="text-foreground">
          {catConfig?.label ?? '-'} &rsaquo; {event.type.replace(/_/g, ' ')}
        </dd>
        <dt className="text-muted-foreground">시간</dt>
        <dd className="text-foreground font-mono">{time}</dd>
        {event.file && (
          <>
            <dt className="text-muted-foreground">파일</dt>
            <dd className="text-foreground break-all">{event.file}{event.line ? `:${event.line}` : ''}</dd>
          </>
        )}
        {event.rule_id && (
          <>
            <dt className="text-muted-foreground">규칙</dt>
            <dd className="text-foreground font-mono">{event.rule_id}</dd>
          </>
        )}
        {event.severity && (
          <>
            <dt className="text-muted-foreground">심각도</dt>
            <dd className="text-foreground">{event.severity}</dd>
          </>
        )}
        {event.task_id && (
          <>
            <dt className="text-muted-foreground">작업 ID</dt>
            <dd className="text-foreground font-mono text-[10px]">{event.task_id}</dd>
          </>
        )}
        {event.agent && (
          <>
            <dt className="text-muted-foreground">에이전트</dt>
            <dd className="text-foreground">{event.agent}</dd>
          </>
        )}
        {event.duration_ms != null && (
          <>
            <dt className="text-muted-foreground">소요시간</dt>
            <dd className="text-foreground">{event.duration_ms}ms</dd>
          </>
        )}
      </dl>
      {event.prompt && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">prompt</div>
          <div className="text-xs text-foreground bg-purple-50 dark:bg-purple-950/30 rounded p-2 whitespace-pre-wrap break-words">
            {event.prompt}
          </div>
        </div>
      )}
      {event.message && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">reason</div>
          <p className="text-xs text-foreground whitespace-pre-wrap break-words">{event.message}</p>
        </div>
      )}
      {event.summary && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">summary</div>
          <p className="text-xs text-foreground whitespace-pre-wrap break-words">{event.summary}</p>
        </div>
      )}
      {event.result && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">result</div>
          <pre className="text-xs text-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
            {event.result}
          </pre>
        </div>
      )}
      {parsedDetail && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">detail</div>
          <pre className="text-xs text-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
            {parsedDetail}
          </pre>
        </div>
      )}
    </div>
  );
}
