import type { RuleEvent, Rule } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RuleHeatmapProps {
  rules: Rule[];
  events: RuleEvent[];
}

type RuleStatus = 'idle' | 'matched' | 'violated' | 'fixed';

function getStatus(ruleId: string, events: RuleEvent[]): RuleStatus {
  const ruleEvents = events.filter((e) => e.rule_id === ruleId);
  if (ruleEvents.length === 0) return 'idle';

  const hasFix = ruleEvents.some((e) => e.type === 'fix_applied');
  const hasViolation = ruleEvents.some((e) => e.type === 'violation_found');

  if (hasFix) return 'fixed';
  if (hasViolation) return 'violated';
  return 'matched';
}

const STATUS_STYLES: Record<RuleStatus, string> = {
  idle: 'bg-muted border-border text-muted-foreground',
  matched: 'bg-secondary border-secondary-foreground/20 text-secondary-foreground',
  violated: 'bg-red-500/20 border-red-500/40 text-red-400',
  fixed: 'bg-green-500/20 border-green-500/40 text-green-400',
};

export function RuleHeatmap({ rules, events }: RuleHeatmapProps) {
  return (
    <Card className="h-full flex flex-col py-4 gap-3">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-sm">규칙 히트맵</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0 px-4">
        <div className="grid grid-cols-3 gap-2">
          {rules.map((rule) => {
            const status = getStatus(rule.id, events);
            const count = events.filter((e) => e.rule_id === rule.id).length;
            return (
              <div
                key={`${rule.project_id}-${rule.id}`}
                className={`border rounded-lg p-2 text-center cursor-default transition-colors ${STATUS_STYLES[status]}`}
                title={rule.description || rule.file_path}
              >
                <div className="font-mono text-sm font-bold">{rule.id}</div>
                {count > 0 && <div className="text-xs mt-0.5">{count}</div>}
              </div>
            );
          })}
        </div>
        {rules.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">규칙 없음</div>
        )}
      </CardContent>
      <div className="flex gap-3 px-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-muted-foreground/30" /> 대기</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-secondary-foreground/50" /> 매칭</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> 위반</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" /> 수정</span>
      </div>
    </Card>
  );
}
