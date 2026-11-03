// VIPER FLEET / SYNC POINT / MIDNIGHT AQUA
//
// Design tokens: the single source of truth for every color, surface, radius,
// shadow, motion value and font in the app. Everything else in the theme (and
// every component) derives from here. See BRAND.md before adding or changing a
// value: the brand palette below is fixed by the brand book and must not be
// extended with new hues.

// ─── Brand palette (brand book page 06 / brand-tokens.json) ──────────────────
export const brandColors = {
  navy: '#102C54', // Midnight navy: leading color, symbol and dark surfaces
  aqua: '#35D7D6', // Aqua: accents, symbol on dark, main actions
  ice: '#E1F5F7', // Ice: light surfaces and supporting layers
  paper: '#F8FCFD', // Paper: light working background
  ink: '#0A1C30', // Ink: dark text and monochrome logo
  slate: '#567286', // Slate: secondary text
  white: '#FFFFFF',
};

// Tonal steps derived from the brand colors, for hover/pressed states and dark
// mode surfaces only. They are tints and shades of navy/aqua, not new hues.
export const navy = {
  950: '#081627',
  900: brandColors.ink,
  850: '#0E2440',
  800: brandColors.navy,
  700: '#173A6B',
  600: '#1F4A85',
  500: '#2E5E9C',
  300: '#7EA9E0',
};

export const aqua = {
  200: '#A8EEED',
  300: '#7FE6E5',
  400: '#5DDFDE',
  500: brandColors.aqua,
  600: '#22BDBC',
  700: '#1A9897',
  800: '#0B7F7E', // Aqua tone that passes 4.5:1 as text on white/paper
};

export const slate = {
  200: '#C9D6DF',
  300: '#9DB3C4',
  400: '#7E95A6',
  500: brandColors.slate,
  600: '#425B6E',
};

// Operational status colors (brand book page 08: "the product map uses separate
// operational markers"). "Online" is the aqua family: every vehicle, in sync.
export const status = {
  light: {
    success: aqua[800],
    warning: '#C27803',
    error: '#D63A42',
    info: navy[600],
    neutral: slate[400],
  },
  dark: {
    success: brandColors.aqua,
    warning: '#F6B94A',
    error: '#FF7A7F',
    info: navy[300],
    neutral: slate[300],
  },
};

export const surfaces = {
  light: {
    canvas: brandColors.paper,
    paper: brandColors.white,
    raised: brandColors.white,
    sunken: brandColors.ice,
    tint: brandColors.ice,
    overlay: 'rgba(255, 255, 255, 0.92)',
    border: 'rgba(16, 44, 84, 0.10)',
    borderStrong: 'rgba(16, 44, 84, 0.18)',
    textPrimary: brandColors.ink,
    textSecondary: brandColors.slate,
    textDisabled: slate[300],
  },
  dark: {
    canvas: brandColors.ink,
    paper: navy[850],
    raised: '#122C4E',
    sunken: navy[950],
    tint: '#14345C',
    overlay: 'rgba(14, 36, 64, 0.92)',
    border: 'rgba(225, 245, 247, 0.10)',
    borderStrong: 'rgba(225, 245, 247, 0.18)',
    textPrimary: brandColors.ice,
    textSecondary: slate[300],
    textDisabled: slate[500],
  },
};

// The navigation rail and brand panels stay navy in both modes (brand book
// page 14: navy navigation, aqua active item, white type).
export const chrome = {
  background: brandColors.navy,
  backgroundHover: 'rgba(225, 245, 247, 0.08)',
  border: 'rgba(225, 245, 247, 0.10)',
  text: 'rgba(248, 252, 253, 0.78)',
  textStrong: brandColors.paper,
  activeBackground: brandColors.aqua,
  activeText: brandColors.ink,
};

// Map geometry (routes, geofences, accuracy) and marker tints.
export const mapColors = {
  geometryLight: aqua[600],
  geometryDark: brandColors.aqua,
  markerDisc: brandColors.navy,
  markerRing: brandColors.white,
  direction: brandColors.navy,
  draw: {
    inactive: aqua[600],
    active: brandColors.navy,
    vertex: brandColors.white,
    static: slate[500],
  },
};

// Categorical chart series, brand colors first.
export const chartColors = {
  light: [
    brandColors.navy,
    aqua[600],
    brandColors.slate,
    navy[500],
    status.light.warning,
    aqua[800],
    status.light.error,
  ],
  dark: [
    brandColors.aqua,
    navy[300],
    slate[300],
    brandColors.ice,
    status.dark.warning,
    aqua[300],
    status.dark.error,
  ],
};

// Radii echo the quarter-circle corners of the Sync Point symbol.
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

// The brand is flat: shadows are soft, navy-tinted and only lift floating UI.
export const shadows = {
  light: {
    sm: '0 1px 2px rgba(10, 28, 48, 0.06)',
    md: '0 4px 14px rgba(10, 28, 48, 0.07)',
    lg: '0 12px 32px rgba(10, 28, 48, 0.10)',
    xl: '0 24px 56px rgba(10, 28, 48, 0.14)',
  },
  dark: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
    md: '0 4px 14px rgba(0, 0, 0, 0.40)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.45)',
    xl: '0 24px 56px rgba(0, 0, 0, 0.55)',
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

// Sora for Latin text and numbers, Assistant for Hebrew. Sora carries no Hebrew
// glyphs, so the browser falls through to Assistant per character.
export const type = {
  fontFamily: '"Sora Variable", Sora, "Assistant Brand", Assistant, "Segoe UI", Arial, sans-serif',
  hebrew: '"Assistant Brand", Assistant, "Segoe UI", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  // Brand weights are 400 / 500 / 600 / 700 only.
  // [fontSize, fontWeight, lineHeight]
  scale: {
    h1: ['2rem', 600, 1.15],
    h2: ['1.625rem', 600, 1.2],
    h3: ['1.375rem', 600, 1.25],
    h4: ['1.25rem', 600, 1.3],
    h5: ['1.125rem', 600, 1.35],
    h6: ['1rem', 600, 1.4],
    subtitle1: ['0.9375rem', 600, 1.5],
    subtitle2: ['0.8125rem', 600, 1.5],
    body1: ['0.9375rem', 400, 1.6],
    body2: ['0.8125rem', 400, 1.55],
    caption: ['0.75rem', 500, 1.5],
    overline: ['0.6875rem', 600, 1.5],
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
