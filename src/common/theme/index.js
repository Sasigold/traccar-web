import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import palette from './palette';
import dimensions from './dimensions';
import components from './components';
import { layers, motion, radius, shadows, type } from './tokens';

export const { fontFamily } = type;

const typography = Object.fromEntries(
  Object.entries(type.scale).map(([variant, [fontSize, fontWeight, lineHeight]]) => [
    variant,
    {
      fontSize,
      fontWeight,
      lineHeight,
      ...(variant.startsWith('h') && { letterSpacing: '-0.01em' }),
      ...(variant === 'overline' && { letterSpacing: '0.06em', textTransform: 'uppercase' }),
      ...(variant === 'button' && { textTransform: 'none' }),
    },
  ]),
);

const shadowScale = (mode) => {
  const scale = shadows[mode];
  const list = ['none', scale.sm, scale.md, scale.lg, scale.xl];
  while (list.length < 25) {
    list.push(scale.xl);
  }
  return list;
};

export default (server, darkMode, direction) =>
  useMemo(
    () =>
      createTheme({
        typography: {
          fontFamily,
          ...typography,
        },
        shape: {
          borderRadius: radius.md,
        },
        shadows: shadowScale(darkMode ? 'dark' : 'light'),
        transitions: {
          duration: {
            shortest: motion.duration.fast,
            shorter: 160,
            short: 200,
            standard: 240,
            complex: 320,
            enteringScreen: motion.duration.enter,
            leavingScreen: motion.duration.exit,
          },
          easing: {
            easeInOut: motion.easing.standard,
            easeOut: motion.easing.emphasized,
            easeIn: motion.easing.exit,
            sharp: motion.easing.standard,
          },
        },
        palette: palette(server, darkMode),
        direction,
        dimensions,
        layers,
        tokens: { radius, motion },
        components,
      }),
    [server, darkMode, direction],
  );
