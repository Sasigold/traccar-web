import { useId } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  LOCKUP_MARK_TRANSFORM,
  LOCKUP_VIEWBOX,
  LOCKUP_WORDMARK_TRANSFORM,
  MARK_PINS,
  MARK_RING,
  MARK_RING_WIDTH,
  MARK_VIEWBOX,
  WORDMARK_DOT,
  WORDMARK_LETTERS,
  WORDMARK_VIEWBOX,
} from './viperPaths';

// tone: 'auto' follows the theme, 'light' is for dark backgrounds, 'dark' for light ones.
const useBrandColors = (tone) => {
  const theme = useTheme();
  const onDark = tone === 'light' || (tone === 'auto' && theme.palette.mode === 'dark');
  return onDark
    ? { start: '#8dbbf2', end: '#3a72c0', ink: '#f4f7fb', dot: '#5a92dd' }
    : { start: '#2f6597', end: '#14305a', ink: '#2b2a30', dot: '#1d4271' };
};

const MarkShapes = ({ fill }) => (
  <g>
    <path d={MARK_PINS} fill={fill} fillRule="evenodd" />
    <path d={MARK_RING} fill="none" stroke={fill} strokeWidth={MARK_RING_WIDTH} />
  </g>
);

const Gradient = ({ id, colors }) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor={colors.start} />
    <stop offset="1" stopColor={colors.end} />
  </linearGradient>
);

// The pin mark on its own (app icon, collapsed rail, avatars).
export const ViperMark = ({ size = 28, tone = 'auto', className, style, title }) => {
  const colors = useBrandColors(tone);
  const id = useId();
  const height = typeof size === 'number' ? size : undefined;
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      height={height}
      width={height ? (height * 364) / 602 : undefined}
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <Gradient id={id} colors={colors} />
      </defs>
      <MarkShapes fill={`url(#${id})`} />
    </svg>
  );
};

// "VIPER" letters with the navy i-dot.
export const ViperWordmark = ({ height = 20, tone = 'auto', className, style }) => {
  const colors = useBrandColors(tone);
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      height={height}
      width={(height * 1140) / 312}
      className={className}
      style={style}
      role="img"
      aria-label="VIPER"
      focusable="false"
    >
      <path d={WORDMARK_LETTERS} fill={colors.ink} />
      <circle {...WORDMARK_DOT} fill={colors.dot} />
    </svg>
  );
};

// Full horizontal lockup: mark + wordmark, proportioned as in the master logo.
const ViperLogo = ({ height = 32, tone = 'auto', className, style }) => {
  const colors = useBrandColors(tone);
  const id = useId();
  return (
    <svg
      viewBox={LOCKUP_VIEWBOX}
      height={height}
      width={(height * 1472) / 474}
      className={className}
      style={style}
      role="img"
      aria-label="VIPER"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="146" y1="23" x2="498" y2="613">
          <stop offset="0" stopColor={colors.start} />
          <stop offset="1" stopColor={colors.end} />
        </linearGradient>
      </defs>
      <g transform={LOCKUP_MARK_TRANSFORM}>
        <MarkShapes fill={`url(#${id})`} />
      </g>
      <g transform={LOCKUP_WORDMARK_TRANSFORM}>
        <path d={WORDMARK_LETTERS} fill={colors.ink} />
        <circle {...WORDMARK_DOT} fill={colors.dot} />
      </g>
    </svg>
  );
};

export default ViperLogo;
