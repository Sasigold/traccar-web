// Design tokens: the single source of truth for colors, surfaces, radii,
// shadows, motion and typography. Everything else in the theme derives from here.

export const indigo = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
};

export const cyan = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
};

export const slate = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

export const violet = {
  400: '#a78bfa',
  500: '#7c3aed',
};

export const brand = {
  primaryLight: indigo[600],
  primaryDark: indigo[400],
  secondaryLight: cyan[500],
  secondaryDark: cyan[400],
  gradientStops: [indigo[600], cyan[500]],
};

export const status = {
  light: {
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0284c7',
    neutral: slate[400],
  },
  dark: {
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#38bdf8',
    neutral: slate[500],
  },
};

export const surfaces = {
  light: {
    canvas: '#f4f6fb',
    paper: '#ffffff',
    raised: '#ffffff',
    sunken: slate[100],
    overlay: 'rgba(255, 255, 255, 0.8)',
    border: 'rgba(15, 23, 42, 0.08)',
    borderStrong: 'rgba(15, 23, 42, 0.14)',
    textPrimary: slate[900],
    textSecondary: slate[600],
    textDisabled: slate[400],
  },
  dark: {
    canvas: '#0b1020',
    paper: '#111827',
    raised: '#161e31',
    sunken: '#0d1326',
    overlay: 'rgba(17, 24, 39, 0.78)',
    border: 'rgba(148, 163, 184, 0.14)',
    borderStrong: 'rgba(148, 163, 184, 0.24)',
    textPrimary: '#e5e9f2',
    textSecondary: '#9aa6ba',
    textDisabled: '#5b6678',
  },
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
};

export const shadows = {
  light: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
    md: '0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.05)',
    lg: '0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)',
    xl: '0 24px 60px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(15, 23, 42, 0.06)',
    glowPrimary: '0 8px 24px rgba(79, 70, 229, 0.35)',
  },
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 4px 12px rgba(0, 0, 0, 0.45)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.5)',
    xl: '0 24px 60px rgba(0, 0, 0, 0.6)',
    glowPrimary: '0 8px 24px rgba(129, 140, 248, 0.35)',
  },
};

export const motion = {
  duration: {
    fast: 120,
    base: 180,
    slow: 260,
    enter: 220,
    exit: 160,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
};

export const type = {
  fontFamily: '"Heebo Variable", Heebo, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  // [fontSize, fontWeight, lineHeight]
  scale: {
    h1: ['2rem', 800, 1.15],
    h2: ['1.625rem', 800, 1.2],
    h3: ['1.375rem', 700, 1.25],
    h4: ['1.25rem', 700, 1.3],
    h5: ['1.125rem', 700, 1.35],
    h6: ['1rem', 700, 1.4],
    subtitle1: ['0.9375rem', 600, 1.5],
    subtitle2: ['0.8125rem', 600, 1.5],
    body1: ['0.9375rem', 400, 1.6],
    body2: ['0.8125rem', 400, 1.55],
    caption: ['0.75rem', 500, 1.5],
    overline: ['0.6875rem', 700, 1.5],
    button: ['0.875rem', 600, 1.5],
  },
};

// z-index contract across the app shell, map and floating UI.
export const layers = {
  map: 0,
  mapControls: 2,
  panel: 3,
  floating: 5,
  statusCard: 1050,
  rail: 1100,
  topBar: 1100,
  mobileTabs: 1100,
  palette: 1300,
};
