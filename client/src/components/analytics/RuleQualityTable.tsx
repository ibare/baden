import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RuleEffectivenessItem } from '@/lib/api';
import { QualityBadge } from './QualityBadge';
import type { RuleQualityLabel } from '@/lib/api';

interface RuleQualityTableProps {
  rules: (RuleEffectivenessItem & { quality: RuleQualityLabel; reason: string })[];
  projectId: string;
}

type SortKey = 'ruleId' | 'matchCount' | 'violationCount' | 'violationRate' | 'avgFixTimeMs';
type SortDir = 'asc' | 'desc';

export function RuleQualityTable({ rules, projectId }: RuleQualityTableProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('violationCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    return [...rules].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [rules, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 px-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort('ruleId')}>
              Rule{sortIndicator('ruleId')}
            </th>
            <th className="py-2 px-3">Category</th>
            <th className="py-2 px-3">Quality</th>
            <th className="py-2 px-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort('matchCount')}>
              Matches{sortIndicator('matchCount')}
            </th>
            <th className="py-2 px-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort('violationCount')}>
              Violations{sortIndicator('violationCount')}
            </th>
            <th className="py-2 px-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort('violationRate')}>
              Rate{sortIndicator('violationRate')}
            </th>
            <th className="py-2 px-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort('avgFixTimeMs')}>
              Avg Fix{sortIndicator('avgFixTimeMs')}
            </th>
            <th className="py-2 px-3">Items</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((rule) => (
            <tr
              key={rule.ruleId}
              className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => navigate(`/projects/${projectId}/analysis/rules/${rule.ruleId}`)}
            >
              <td className="py-2 px-3 font-medium">{rule.ruleId}</td>
              <td className="py-2 px-3 text-muted-foreground">{rule.category}</td>
              <td className="py-2 px-3">
                <QualityBadge quality={rule.quality} />
              </td>
              <td className="py-2 px-3 text-right tabular-nums">{rule.matchCount}</td>
              <td className="py-2 px-3 text-right tabular-nums">
                <span className={rule.violationCount > 0 ? 'text-red-600 font-medium' : ''}>
                  {rule.violationCount}
                </span>
              </td>
              <td className="py-2 px-3 text-right tabular-nums">
                {(rule.violationRate * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                {rule.avgFixTimeMs !== null
                  ? `${Math.round(rule.avgFixTimeMs / 1000)}s`
                  : '—'}
              </td>
              <td className="py-2 px-3 text-muted-foreground">{rule.itemCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">
          No rules found
        </div>
      )}
    </div>
  );
}
