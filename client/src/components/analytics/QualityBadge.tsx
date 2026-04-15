import type { RuleQualityLabel } from '@/lib/api';
import { cn } from '@/lib/utils';

const CONFIG: Record<RuleQualityLabel, { label: string; bg: string; text: string }> = {
  healthy: { label: 'Healthy', bg: 'bg-emerald-500/15', text: 'text-emerald-700' },
  dormant: { label: 'Dormant', bg: 'bg-amber-500/15', text: 'text-amber-700' },
  ineffective: { label: 'Ineffective', bg: 'bg-red-500/15', text: 'text-red-700' },
  over_triggered: { label: 'Over-triggered', bg: 'bg-blue-500/15', text: 'text-blue-700' },
};

interface QualityBadgeProps {
  quality: RuleQualityLabel;
  className?: string;
}

export function QualityBadge({ quality, className }: QualityBadgeProps) {
  const c = CONFIG[quality];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', c.bg, c.text, className)}>
      {c.label}
    </span>
  );
}
