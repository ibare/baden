import type { ReactNode } from 'react';

interface InsightSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function InsightSection({ title, description, children }: InsightSectionProps) {
  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-base font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
      )}
      {!description && <div className="mb-2" />}
      {children}
    </section>
  );
}
