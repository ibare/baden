import type { EventCategory } from '@/lib/event-types';

export interface CategoryColors {
  fill: string;
  fillHover: string;
  stroke: string;
  text: string;
  bg: string;
  connector: string;
}

export const CATEGORY_COLORS: Record<EventCategory, CategoryColors> = {
  exploration: {
    fill: '#2dd4bf',
    fillHover: '#14b8a6',
    stroke: '#0d9488',
    text: '#0f766e',
    bg: 'rgba(45,212,191,0.08)',
    connector: '#2dd4bf',
  },
  planning: {
    fill: '#c084fc',
    fillHover: '#a855f7',
    stroke: '#9333ea',
    text: '#7e22ce',
    bg: 'rgba(192,132,252,0.08)',
    connector: '#c084fc',
  },
  implementation: {
    fill: '#fb923c',
    fillHover: '#f97316',
    stroke: '#ea580c',
    text: '#c2410c',
    bg: 'rgba(251,146,60,0.08)',
    connector: '#fb923c',
  },
  verification: {
    fill: '#facc15',
    fillHover: '#eab308',
    stroke: '#ca8a04',
    text: '#a16207',
    bg: 'rgba(250,204,21,0.08)',
    connector: '#facc15',
  },
  debugging: {
    fill: '#fbbf24',
    fillHover: '#f59e0b',
    stroke: '#d97706',
    text: '#b45309',
    bg: 'rgba(251,191,36,0.08)',
    connector: '#fbbf24',
  },
  rule_compliance: {
    fill: '#fb7185',
    fillHover: '#f43f5e',
    stroke: '#e11d48',
    text: '#be123c',
    bg: 'rgba(251,113,133,0.08)',
    connector: '#fb7185',
  },
};

// Tailwind-compatible class mappings for filter buttons
export const CATEGORY_BUTTON_CLASSES: Record<
  EventCategory,
  { bg: string; hover: string; text: string }
> = {
  exploration: { bg: 'bg-teal-400/70', hover: 'hover:bg-teal-400/90', text: 'text-teal-700' },
  planning: { bg: 'bg-purple-400/70', hover: 'hover:bg-purple-400/90', text: 'text-purple-700' },
  implementation: {
    bg: 'bg-orange-400/70',
    hover: 'hover:bg-orange-400/90',
    text: 'text-orange-700',
  },
  verification: {
    bg: 'bg-yellow-400/70',
    hover: 'hover:bg-yellow-400/90',
    text: 'text-yellow-700',
  },
  debugging: { bg: 'bg-amber-400/70', hover: 'hover:bg-amber-400/90', text: 'text-amber-700' },
  rule_compliance: { bg: 'bg-rose-400/70', hover: 'hover:bg-rose-400/90', text: 'text-rose-700' },
};
