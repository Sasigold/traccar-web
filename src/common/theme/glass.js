import { alpha } from '@mui/material/styles';

// Frosted-glass surface used by floating panels over the map.
export const glass = (theme, opacity = 0.78) => {
  const dark = theme.palette.mode === 'dark';
  return {
    backgroundColor: alpha(theme.palette.background.paper, opacity),
    backdropFilter: 'blur(22px) saturate(170%)',
    WebkitBackdropFilter: 'blur(22px) saturate(170%)',
    border: `1px solid ${dark ? alpha('#ffffff', 0.08) : alpha('#ffffff', 0.7)}`,
    boxShadow: dark
      ? `0 24px 60px ${alpha('#000000', 0.55)}, inset 0 1px 0 ${alpha('#ffffff', 0.06)}`
      : `0 24px 60px ${alpha('#0f172a', 0.16)}, 0 2px 6px ${alpha('#0f172a', 0.06)}, inset 0 1px 0 ${alpha('#ffffff', 0.8)}`,
  };
};

// Brand accent gradient: primary blending into info.
export const accentGradient = (theme, angle = 135) =>
  `linear-gradient(${angle}deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.main} 100%)`;

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
