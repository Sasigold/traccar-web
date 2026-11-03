import { alpha } from '@mui/material/styles';
import { cyan, indigo, violet, shadows } from './tokens';

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
        backdropFilter: 'blur(14px) saturate(160%)',
        WebkitBackdropFilter: 'blur(14px) saturate(160%)',
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

// Frosted-glass surface used by floating panels over the map.
export const glass = (theme, opacity = 0.78) => {
  const dark = theme.palette.mode === 'dark';
  return {
    backgroundColor: alpha(theme.palette.background.paper, opacity),
    backdropFilter: 'blur(22px) saturate(170%)',
    WebkitBackdropFilter: 'blur(22px) saturate(170%)',
    border: `1px solid ${dark ? alpha('#ffffff', 0.08) : alpha('#ffffff', 0.75)}`,
    boxShadow: `${tokenShadows(theme).xl}, inset 0 1px 0 ${alpha('#ffffff', dark ? 0.06 : 0.85)}`,
  };
};

// Brand accent gradient: primary blending into secondary (indigo → cyan).
export const accentGradient = (theme, angle = 135) =>
  `linear-gradient(${angle}deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`;

export const gradientText = (theme) => ({
  backgroundImage: accentGradient(theme, 90),
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

export const focusRing = (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`;

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

// Deep indigo mesh used by the login brand panel.
export const meshBackground = () => ({
  backgroundColor: indigo[900],
  backgroundImage: [
    `radial-gradient(at 18% 22%, ${alpha(indigo[600], 0.95)} 0px, transparent 55%)`,
    `radial-gradient(at 82% 28%, ${alpha(cyan[500], 0.5)} 0px, transparent 45%)`,
    `radial-gradient(at 48% 92%, ${alpha(violet[500], 0.6)} 0px, transparent 50%)`,
  ].join(', '),
});
