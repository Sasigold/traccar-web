// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import { heIL, enUS } from '@mui/material/locale';
import palette from './palette';
import dimensions from './dimensions';
import components from './components';
import { layers, motion, radius, shadows, type } from './tokens';

export const { fontFamily } = type;

// A11-11 (BRAND §5): capitals and letter spacing are for Latin labels only. In a right-to-left
// layout `overline` reads plain, like `sectionLabel`, because spaced Hebrew letters are harder
// to read.
export const typographyFor = (direction) =>
  Object.fromEntries(
    Object.entries(type.scale).map(([variant, [fontSize, fontWeight, lineHeight]]) => [
      variant,
      {
        fontSize,
        fontWeight,
        lineHeight,
        ...(variant.startsWith('h') && { letterSpacing: '-0.01em' }),
        ...(variant === 'overline' &&
          (direction === 'rtl'
            ? { letterSpacing: 0, textTransform: 'none', fontSize: '0.8125rem' }
            : { letterSpacing: '0.06em', textTransform: 'uppercase' })),
        ...(variant === 'sectionLabel' && { letterSpacing: 0, textTransform: 'none' }),
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

// MUI's own words (pagination, close, "no options"…) follow the app language.
const muiLocales = { he: heIL, en: enUS };

// A hook (it memoizes the theme), so its name starts with `use` (PRF-04: React Compiler relies
// on that to keep the hook order).
const useAppTheme = (server, darkMode, direction, language) =>
  useMemo(
    () =>
      createTheme(
        {
          typography: {
            fontFamily,
            ...typographyFor(direction),
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
          tokens: { radius, motion, font: { mono: type.mono } },
          components,
        },
        muiLocales[language] || enUS,
      ),
    [server, darkMode, direction, language],
  );

export default useAppTheme;
