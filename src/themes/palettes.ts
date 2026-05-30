export interface ThemePalette {
  '--color-accent': string;
  '--color-accent-light': string;
  '--color-accent-dark': string;
  '--color-surface': string;
  '--color-surface-raised': string;
  '--color-background': string;
  '--color-text-primary': string;
  '--color-text-secondary': string;
  '--color-border': string;
}

export type ThemeId = 'default' | 'forest' | 'midnight' | 'ember' | 'rose' | 'arctic';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  palette: ThemePalette;
}

export const PALETTES: Record<ThemeId, ThemePalette> = {
  default: {
    '--color-accent': '#6366f1', // indigo-500
    '--color-accent-light': '#e0e7ff', // indigo-100
    '--color-accent-dark': '#4338ca', // indigo-700
    '--color-surface': '#ffffff', // white
    '--color-surface-raised': '#f4f4f5', // zinc-100
    '--color-background': '#fafafa', // zinc-50
    '--color-text-primary': '#18181b', // zinc-900
    '--color-text-secondary': '#71717a', // zinc-500
    '--color-border': '#e4e4e7', // zinc-200
  },
  forest: {
    '--color-accent': '#16a34a', // green-600
    '--color-accent-light': '#dcfce7', // green-100
    '--color-accent-dark': '#14532d', // green-900
    '--color-surface': '#ffffff',
    '--color-surface-raised': '#f0fdf4', // green-50
    '--color-background': '#f4faf6', // beautiful light woodland green
    '--color-text-primary': '#14532d', // deep forest green text
    '--color-text-secondary': '#166534', 
    '--color-border': '#bbf7d0', // green-200
  },
  midnight: {
    '--color-accent': '#3b82f6', // blue-500
    '--color-accent-light': '#1e293b', // slate-800
    '--color-accent-dark': '#1d4ed8', // blue-700
    '--color-surface': '#0f172a', // slate-900
    '--color-surface-raised': '#1e293b', // slate-800
    '--color-background': '#020617', // slate-950
    '--color-text-primary': '#f8fafc', // slate-50
    '--color-text-secondary': '#94a3b8', // slate-400
    '--color-border': '#334155', // slate-700
  },
  ember: {
    '--color-accent': '#ea580c', // orange-600
    '--color-accent-light': '#ffedd5', // orange-100
    '--color-accent-dark': '#9a3412', // orange-800
    '--color-surface': '#fffbeb', // amber-50
    '--color-surface-raised': '#fef3c7', // amber-100
    '--color-background': '#fffdf5', // warm cream background
    '--color-text-primary': '#78350f', // amber-900 text
    '--color-text-secondary': '#b45309', // amber-700 text
    '--color-border': '#fde68a', // amber-200
  },
  rose: {
    '--color-accent': '#db2777', // rose-600
    '--color-accent-light': '#ffe4e6', // rose-100
    '--color-accent-dark': '#9f1239', // rose-800
    '--color-surface': '#ffffff',
    '--color-surface-raised': '#fff1f2', // rose-50
    '--color-background': '#fffbfc', // elegant pinkish offwhite
    '--color-text-primary': '#4c0519', // rose-950
    '--color-text-secondary': '#881337', // rose-900
    '--color-border': '#fecdd3', // rose-200
  },
  arctic: {
    '--color-accent': '#0891b2', // cyan-600
    '--color-accent-light': '#ecfeff', // cyan-105
    '--color-accent-dark': '#155e75', // cyan-800
    '--color-surface': '#ffffff',
    '--color-surface-raised': '#f0fdfa', // teal-50
    '--color-background': '#f8fafc', // slate-50
    '--color-text-primary': '#0f172a', // slate-900
    '--color-text-secondary': '#475569', // slate-600
    '--color-border': '#cffafe', // cyan-100
  }
};

export const THEME_LIST: { id: ThemeId; name: string }[] = [
  { id: 'default', name: 'Cosmic Slate' },
  { id: 'forest', name: 'Lush Forest' },
  { id: 'midnight', name: 'Deep Midnight' },
  { id: 'ember', name: 'Warm Ember' },
  { id: 'rose', name: 'Elegance Rose' },
  { id: 'arctic', name: 'Arctic Ice' }
];
