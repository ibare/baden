import { useState, useMemo } from 'react';
import type { RuleEvent } from '@/lib/api';
import { useProject } from '@/hooks/useProjectContext';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TYPE_CONFIG, EVENT_TYPE_GROUPS } from '@/lib/event-types';

interface EventLogProps {
  events: RuleEvent[];
}

const ALL = '__all__';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function EventLog({ events }: EventLogProps) {
  const { projects } = useProject();
  const [typeFilter, setTypeFilter] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (ruleFilter && e.rule_id !== ruleFilter) return false;
      if (severityFilter && e.severity !== severityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const searchable = [e.file, e.message, e.rule_id, e.type].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      return true;
    });
  }, [events, typeFilter, ruleFilter, severityFilter, search]);

  const uniqueRules = useMemo(() =>
    [...new Set(events.map((e) => e.rule_id).filter(Boolean))] as string[],
    [events]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Select value={typeFilter || ALL} onValueChange={(v) => setTypeFilter(v === ALL ? '' : v)}>
          <SelectTrigger size="sm"><SelectValue placeholder="모든 타입" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>모든 타입</SelectItem>
            {EVENT_TYPE_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.types.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select value={ruleFilter || ALL} onValueChange={(v) => setRuleFilter(v === ALL ? '' : v)}>
          <SelectTrigger size="sm"><SelectValue placeholder="모든 규칙" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>모든 규칙</SelectItem>
            {uniqueRules.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityFilter || ALL} onValueChange={(v) => setSeverityFilter(v === ALL ? '' : v)}>
          <SelectTrigger size="sm"><SelectValue placeholder="모든 심각도" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>모든 심각도</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 flex-1 min-w-[120px]"
        />

        <span className="text-xs text-muted-foreground">{filtered.length}건</span>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="text-xs">시간</TableHead>
              <TableHead className="text-xs">프로젝트</TableHead>
              <TableHead className="text-xs">타입</TableHead>
              <TableHead className="text-xs">규칙</TableHead>
              <TableHead className="text-xs">파일</TableHead>
              <TableHead className="text-xs">메시지</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {new Date(event.timestamp).toLocaleTimeString('ko-KR')}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {projectNameMap.get(event.project_id) ?? event.project_id}
                </TableCell>
                <TableCell>
                  <span className={TYPE_CONFIG[event.type]?.color || 'text-muted-foreground'}>
                    {event.type.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-foreground">{event.rule_id || '-'}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">{event.file || '-'}</TableCell>
                <TableCell className="text-muted-foreground max-w-[300px] truncate">{event.message || '-'}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">이벤트 없음</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
