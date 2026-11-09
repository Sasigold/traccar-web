import { alpha } from '@mui/material/styles';
import { brandColors, shadows } from './tokens';

const tokenShadows = (theme) => shadows[theme.palette.mode];

// Solid surfaces: base (paper), raised (card), sunken (inset), overlay (translucent).
export const surface = (theme, level = 'base') => {
  const { surface: colors } = theme.palette;
  switch (level) {
    case 'raised':
      return {
        backgroundColor: colors.raised,
        border: `1px solid ${colors.border}`,
        boxShadow: tokenShadows(theme).md,
      };
    case 'sunken':
      return {
        backgroundColor: colors.sunken,
        border: `1px solid ${colors.border}`,
      };
    case 'overlay':
      return {
        backgroundColor: colors.overlay,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${colors.border}`,
        boxShadow: tokenShadows(theme).lg,
      };
    case 'base':
    default:
      return {
        backgroundColor: colors.paper,
        border: `1px solid ${colors.border}`,
      };
  }
};

// Floating panel over the map. The brand is flat, so this is an almost solid
// paper surface with a light blur for legibility, not a glass effect.
export const glass = (theme, opacity = 0.96) => ({
  backgroundColor: alpha(theme.palette.background.paper, Math.max(opacity, 0.94)),
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${theme.palette.surface.border}`,
  boxShadow: tokenShadows(theme).lg,
});

// Main action fill: aqua with ink type (brand book: aqua = main actions).
export const ctaFill = (theme) => ({
  backgroundColor: theme.palette.cta.main,
  color: theme.palette.cta.contrastText,
  '&:hover': {
    backgroundColor: theme.palette.cta.hover,
  },
});

// Navy tile with an aqua glyph: the app-icon look, used for device avatars.
export const brandTile = () => ({
  backgroundColor: brandColors.navy,
  color: brandColors.aqua,
});

// Flat midnight navy brand surface for login and splash panels.
export const brandPanel = () => ({
  backgroundColor: brandColors.navy,
  color: brandColors.paper,
});

// A 2px gap in the surface color, then 2px of the focus color (WCAG 2.4.7 / 1.4.11).
export const focusRing = (theme) =>
  `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.focus}`;

export const statusColor = (theme, status) => {
  switch (status) {
    case 'online':
      return theme.palette.success.main;
    case 'offline':
      return theme.palette.error.main;
    default:
      return theme.palette.neutral.main;
  }
};
