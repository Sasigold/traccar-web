// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';

// Chart colors and type, all from the theme (BRAND.md: no raw colors outside theme/).
export const useChartTheme = () => {
  const theme = useTheme();
  return useMemo(() => {
    const viz = theme.palette.dataviz;
    const tone = (name) => {
      switch (name) {
        case 'success':
          return theme.palette.success.main;
        case 'warning':
          return theme.palette.warning.main;
        case 'error':
          return theme.palette.error.main;
        case 'info':
          return theme.palette.info.main;
        default:
          return theme.palette.neutral.main;
      }
    };
    return {
      categorical: viz.categorical,
      single: viz.single,
      accent: viz.accent,
      other: viz.other,
      track: viz.track,
      grid: viz.grid,
      axis: viz.axis,
      areaOpacity: viz.areaOpacity,
      surface: theme.palette.background.paper,
      text: theme.palette.text.primary,
      textSecondary: theme.palette.text.secondary,
      fontFamily: theme.typography.fontFamily,
      tone,
      slotColor: (slot) => (slot == null ? viz.other : viz.categorical[slot]),
      rtl: theme.direction === 'rtl',
      motion: theme.tokens.motion,
    };
  }, [theme]);
};

export const SIZE = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export const sizeClass = (width, height) => {
  if (width < 220 || height < 120) {
    return SIZE.xs;
  }
  if (width < 360 || height < 200) {
    return SIZE.sm;
  }
  return width >= 640 && height >= 360 ? SIZE.lg : SIZE.md;
};

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
