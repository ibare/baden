import type { RuleQualityLabel } from '@/lib/api';

const LABELS: { key: RuleQualityLabel; label: string; color: string; icon: string }[] = [
  { key: 'healthy', label: 'Healthy', color: 'text-emerald-600', icon: '●' },
  { key: 'dormant', label: 'Dormant', color: 'text-amber-600', icon: '●' },
  { key: 'ineffective', label: 'Ineffective', color: 'text-red-600', icon: '●' },
  { key: 'over_triggered', label: 'Over-triggered', color: 'text-blue-600', icon: '●' },
];

interface RuleQualitySummaryProps {
  summary: Record<RuleQualityLabel, number>;
}

export function RuleQualitySummary({ summary }: RuleQualitySummaryProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {LABELS.map(({ key, label, color, icon }) => (
        <div key={key} className="bg-card border border-border rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${color}`}>
            {summary[key]}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <span className={color}>{icon}</span>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
