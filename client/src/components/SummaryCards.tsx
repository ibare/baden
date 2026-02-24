import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SummaryCardsProps {
  events: number;
  explorations: number;
  implementations: number;
  verifications: number;
  errors: number;
  violations: number;
}

function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current && ref.current) {
      ref.current.classList.remove('animate-pulse');
      void ref.current.offsetWidth;
      ref.current.classList.add('animate-pulse');
      prevValue.current = value;
    }
  }, [value]);

  return (
    <span ref={ref} className={cn('text-3xl font-bold', color)}>
      {value}
    </span>
  );
}

export function SummaryCards({ events, explorations, implementations, verifications, errors, violations }: SummaryCardsProps) {
  const cards = [
    { label: '이벤트', value: events, color: 'text-blue-400', border: 'border-blue-400/20', bg: 'bg-blue-400/10' },
    { label: '탐색', value: explorations, color: 'text-teal-400', border: 'border-teal-400/20', bg: 'bg-teal-400/10' },
    { label: '구현', value: implementations, color: 'text-orange-400', border: 'border-orange-400/20', bg: 'bg-orange-400/10' },
    { label: '검증', value: verifications, color: 'text-yellow-400', border: 'border-yellow-400/20', bg: 'bg-yellow-400/10' },
    { label: '오류', value: errors, color: 'text-red-400', border: 'border-red-400/20', bg: 'bg-red-400/10' },
    { label: '규칙위반', value: violations, color: 'text-red-400', border: 'border-red-400/20', bg: 'bg-red-400/10' },
  ];

  return (
    <div className="grid grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className={cn('py-4', card.border, card.bg)}>
          <CardContent className="px-4">
            <div className="text-sm text-muted-foreground mb-1">{card.label}</div>
            <AnimatedNumber value={card.value} color={card.color} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
