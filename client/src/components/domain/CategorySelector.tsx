import type { EventCategory } from '@/lib/event-types';
import { CATEGORY_CONFIG } from '@/lib/event-types';
import { CATEGORY_COLORS } from '@/components/timeline/lib/colors';

const CATEGORIES: EventCategory[] = [
  'user',
  'exploration',
  'planning',
  'implementation',
  'verification',
  'debugging',
  'rule_compliance',
];

interface CategorySelectorProps {
  value: string | null;
  onChange: (category: string) => void;
}

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">-- 카테고리 선택 --</option>
      {CATEGORIES.map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        const colors = CATEGORY_COLORS[cat];
        return (
          <option key={cat} value={cat} style={{ color: colors.fill }}>
            {config.label} ({cat})
          </option>
        );
      })}
    </select>
  );
}
