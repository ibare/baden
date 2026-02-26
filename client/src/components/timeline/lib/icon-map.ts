import type { Icon } from '@phosphor-icons/react';
import * as PhosphorIcons from '@phosphor-icons/react';

const SKIP = new Set(['IconContext', 'IconBase', 'SSR', 'IconWeight']);

export const PHOSPHOR_ICON_MAP: Record<string, Icon> = {};

for (const [name, component] of Object.entries(PhosphorIcons)) {
  if (/^[A-Z]/.test(name) && !SKIP.has(name) && component != null) {
    PHOSPHOR_ICON_MAP[name] = component as Icon;
  }
}

export const ICON_NAMES = Object.keys(PHOSPHOR_ICON_MAP).sort();

if (import.meta.env.DEV) {
  console.log(`[icon-map] ${ICON_NAMES.length} icons loaded. Sample:`, ICON_NAMES.slice(0, 5));
}
