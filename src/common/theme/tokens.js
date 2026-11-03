// Design tokens: the single source of truth for colors, surfaces, radii,
// shadows, motion and typography. Everything else in the theme derives from here.

// VIPER brand navy, sampled from the logo (#1d4271 core, #2f6597 highlight).
export const navy = {
  50: '#eef4fb',
  100: '#d9e6f6',
  200: '#b5cdec',
  300: '#86acdc',
  400: '#5a92dd',
  500: '#3a72c0',
  600: '#24528f',
  700: '#1d4271',
  800: '#183559',
  900: '#122844',
  950: '#08142a',
};

// Signal: the electric accent used for live data, glows and highlights.
export const signal = {
  50: '#ecfbff',
  100: '#cdf4fd',
  200: '#9ee9fb',
  300: '#62daf5',
  400: '#2cc6ec',
  500: '#0eaad3',
  600: '#0a87ab',
  700: '#0d6c89',
};

export const slate = {
  50: '#f7f9fc',
  100: '#eef2f7',
  200: '#e1e7ef',
  300: '#c9d2de',
  400: '#94a1b5',
  500: '#64728a',
  600: '#4a5870',
  700: '#33405a',
  800: '#1c2840',
  900: '#0d1a2e',
  950: '#050b17',
};

export const violet = {
  400: '#a78bfa',
  500: '#7c3aed',
};

// Wordmark ink of the VIPER logo.
export const ink = '#2b2a30';

export const brand = {
  navy: navy[700],
  highlight: '#2f6597',
  ink,
  primaryLight: navy[600],
  primaryDark: navy[400],
  secondaryLight: signal[500],
  secondaryDark: signal[400],
  gradientStops: [navy[600], signal[500]],
};

export const status = {
  light: {
    success: '#10a36a',
    warning: '#d98a04',
    error: '#dc3545',
    info: '#0b86c9',
    neutral: slate[400],
  },
  dark: {
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#38bdf8',
    neutral: slate[500],
  },
};

export const surfaces = {
  light: {
    canvas: '#f2f5f9',
    paper: '#ffffff',
    raised: '#ffffff',
    sunken: slate[100],
    overlay: 'rgba(255, 255, 255, 0.82)',
    border: 'rgba(13, 26, 46, 0.08)',
    borderStrong: 'rgba(13, 26, 46, 0.14)',
    textPrimary: slate[900],
    textSecondary: slate[600],
    textDisabled: slate[400],
  },
  dark: {
    canvas: '#050b16',
    paper: '#0a1424',
    raised: '#0f1b30',
    sunken: '#07101e',
    overlay: 'rgba(10, 20, 36, 0.78)',
    border: 'rgba(140, 175, 225, 0.12)',
    borderStrong: 'rgba(140, 175, 225, 0.22)',
    textPrimary: '#e6edf7',
    textSecondary: '#93a3bb',
    textDisabled: '#56647a',
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
    sm: '0 1px 2px rgba(13, 26, 46, 0.06), 0 1px 3px rgba(13, 26, 46, 0.04)',
    md: '0 6px 16px -4px rgba(13, 26, 46, 0.1), 0 1px 3px rgba(13, 26, 46, 0.05)',
    lg: '0 16px 36px -8px rgba(13, 26, 46, 0.16), 0 2px 6px rgba(13, 26, 46, 0.06)',
    xl: '0 28px 64px -12px rgba(13, 26, 46, 0.24), 0 2px 6px rgba(13, 26, 46, 0.06)',
    glowPrimary: '0 8px 24px rgba(36, 82, 143, 0.32)',
    glowSignal: '0 0 0 1px rgba(14, 170, 211, 0.25), 0 8px 28px rgba(14, 170, 211, 0.25)',
  },
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.45)',
    md: '0 6px 16px -4px rgba(0, 0, 0, 0.55)',
    lg: '0 16px 36px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(140, 175, 225, 0.04)',
    xl: '0 28px 64px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(140, 175, 225, 0.05)',
    glowPrimary: '0 8px 28px rgba(90, 146, 221, 0.35)',
    glowSignal: '0 0 0 1px rgba(44, 198, 236, 0.3), 0 8px 32px rgba(44, 198, 236, 0.28)',
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
