import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { alpha } from '@mui/material/styles';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import useAnimatedNumber from './useAnimatedNumber';

// Click and keyboard props for a tile or chip that opens its settings.
const clickProps = (onClick, label) =>
  onClick
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': label,
        onClick,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        },
      }
    : {};

const enter = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
`;

const charge = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`;

const useStyles = makeStyles()((theme) => ({
  enter: {
    animation: `${enter} ${theme.tokens.motion.duration.slow * 1.6}ms ${theme.tokens.motion.easing.emphasized} both`,
  },
  // Level bar ---------------------------------------------------------------
  bar: {
    position: 'relative',
    height: 8,
    borderRadius: theme.tokens.radius.pill,
    backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.14 : 0.08),
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    insetBlock: 0,
    insetInlineStart: 0,
    borderRadius: theme.tokens.radius.pill,
    transition: `background-color ${theme.tokens.motion.duration.slow}ms ease`,
  },
  barMarker: {
    position: 'absolute',
    insetBlock: -2,
    width: 2,
    backgroundColor: theme.palette.text.secondary,
  },
  // Battery -----------------------------------------------------------------
  battery: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width: 46,
    height: 24,
    flexShrink: 0,
  },
  batteryBody: {
    position: 'relative',
    width: 42,
    height: 24,
    padding: 3,
    borderRadius: 7,
    border: `2px solid ${theme.palette.text.primary}`,
  },
  batteryCap: {
    width: 3,
    height: 10,
    marginInlineStart: 1,
    borderRadius: '0 2px 2px 0',
    backgroundColor: theme.palette.text.primary,
  },
  batteryFill: {
    height: '100%',
    borderRadius: 3,
    transition: `background-color ${theme.tokens.motion.duration.slow}ms ease`,
  },
  charging: {
    animation: `${charge} 1.6s ease-in-out infinite`,
  },
  // Signal bars -------------------------------------------------------------
  bars: {
    display: 'inline-flex',
    alignItems: 'flex-end',
    gap: 3,
    height: 24,
    flexShrink: 0,
  },
  signalBar: {
    width: 5,
    borderRadius: 2,
    transition: `background-color ${theme.tokens.motion.duration.slow}ms ease`,
  },
  // Status chip -------------------------------------------------------------
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    transition: `background-color ${theme.tokens.motion.duration.slow}ms ease, border-color ${theme.tokens.motion.duration.slow}ms ease`,
  },
  chipOn: {
    backgroundColor: theme.palette.surface.tint,
    borderColor: alpha(theme.palette.geometry.main, 0.45),
  },
  chipIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: alpha(theme.palette.text.primary, 0.06),
    color: theme.palette.text.secondary,
    transition: `background-color ${theme.tokens.motion.duration.slow}ms ease, color ${theme.tokens.motion.duration.slow}ms ease`,
    '& svg': { fontSize: 18 },
  },
  chipIconOn: {
    backgroundColor: theme.palette.brand.navy,
    color: theme.palette.brand.aqua,
  },
  chipIconAlert: {
    backgroundColor: alpha(theme.palette.error.main, 0.12),
    color: theme.palette.error.main,
  },
  chipText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  chipLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chipState: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  dot: {
    position: 'relative',
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  // Metric tile -------------------------------------------------------------
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    minWidth: 0,
    padding: theme.spacing(1.75),
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    transition: `border-color ${theme.tokens.motion.duration.base}ms ease, transform ${theme.tokens.motion.duration.base}ms ${theme.tokens.motion.easing.standard}`,
    '&:hover': {
      borderColor: theme.palette.surface.borderStrong,
      transform: 'translateY(-1px)',
    },
  },
  clickable: {
    cursor: 'pointer',
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '&:hover .vf-tile-edit, &:focus-visible .vf-tile-edit': { opacity: 1 },
  },
  tileEdit: {
    display: 'inline-flex',
    color: theme.palette.text.secondary,
    opacity: 0,
    transition: `opacity ${theme.tokens.motion.duration.base}ms ease`,
    '& svg': { fontSize: 16 },
    '@media (hover: none)': { display: 'none' },
  },
  tileHead: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  tileIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.primary.main,
    '& svg': { fontSize: 18 },
  },
  tileIconWarning: {
    backgroundColor: alpha(theme.palette.warning.main, 0.14),
    color: theme.palette.warning.main,
  },
  tileIconError: {
    backgroundColor: alpha(theme.palette.error.main, 0.12),
    color: theme.palette.error.main,
  },
  tileLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.75rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tileBody: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  tileValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
    minWidth: 0,
    // Reads "-18.3°C" or "4.00 V" left to right and Hebrew values right to left.
    unicodeBidi: 'plaintext',
  },
  tileValueSmall: {
    fontSize: '0.875rem',
    letterSpacing: 0,
    fontWeight: 600,
  },
  tileCaption: {
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  // Compass -----------------------------------------------------------------
  compass: {
    position: 'relative',
    width: 56,
    height: 56,
    flexShrink: 0,
  },
  compassRing: {
    fill: 'none',
    stroke: alpha(theme.palette.text.primary, 0.12),
    strokeWidth: 2,
  },
  compassTick: {
    stroke: alpha(theme.palette.text.primary, 0.35),
    strokeWidth: 1.5,
  },
  compassLabel: {
    fill: theme.palette.text.secondary,
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: 700,
  },
  compassArrow: {
    fill: theme.palette.primary.main,
    transformOrigin: '28px 28px',
    transformBox: 'view-box',
    transition: `transform 900ms ${theme.tokens.motion.easing.emphasized}`,
  },
  // Odometer ----------------------------------------------------------------
  odometer: {
    display: 'inline-flex',
    gap: 2,
  },
  digit: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 28,
    paddingInline: 2,
    borderRadius: 5,
    backgroundColor:
      theme.palette.mode === 'dark' ? theme.palette.surface.sunken : theme.palette.brand.navy,
    border:
      theme.palette.mode === 'dark' ? `1px solid ${theme.palette.surface.borderStrong}` : 'none',
    color: theme.palette.brand.paper,
    fontSize: '0.9375rem',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  digitSep: {
    backgroundColor: 'transparent',
    color: theme.palette.text.secondary,
    minWidth: 6,
    paddingInline: 0,
  },
}));

export const useLevelColor = () => {
  const { theme } = useStyles();
  return (ratio, { lowWarn = 0.25, lowError = 0.12, invert = false } = {}) => {
    const level = invert ? 1 - ratio : ratio;
    if (level <= lowError) return theme.palette.error.main;
    if (level <= lowWarn) return theme.palette.warning.main;
    return theme.palette.geometry.main;
  };
};

// Level bars and the battery fill follow the same live animation as the dials.
const useAnimatedRatio = (ratio) =>
  Math.min(1, Math.max(0, useAnimatedNumber(Number.isFinite(ratio) ? ratio : 0)));

export const LevelBar = ({ ratio, color, marker }) => {
  const { classes, theme } = useStyles();
  const safe = useAnimatedRatio(ratio);
  return (
    <div className={classes.bar} aria-hidden>
      <div
        className={classes.barFill}
        style={{ width: `${safe * 100}%`, backgroundColor: color || theme.palette.geometry.main }}
      />
      {marker != null && (
        <div className={classes.barMarker} style={{ insetInlineStart: `${marker * 100}%` }} />
      )}
    </div>
  );
};

export const BatteryGlyph = ({ ratio, color, charging }) => {
  const { classes, cx } = useStyles();
  const safe = useAnimatedRatio(ratio);
  return (
    <span className={classes.battery} style={{ direction: 'ltr' }} aria-hidden>
      <span className={classes.batteryBody}>
        <span
          className={cx(classes.batteryFill, charging && classes.charging)}
          style={{ display: 'block', width: `${Math.max(safe * 100, 6)}%`, backgroundColor: color }}
        />
      </span>
      <span className={classes.batteryCap} />
    </span>
  );
};

export const SignalBars = ({ ratio, count = 5, color }) => {
  const { classes, theme } = useStyles();
  const active = Math.round(Math.min(1, Math.max(0, ratio)) * count);
  return (
    <span className={classes.bars} style={{ direction: 'ltr' }} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={classes.signalBar}
          style={{
            height: `${30 + (70 * (i + 1)) / count}%`,
            backgroundColor:
              i < active
                ? color || theme.palette.geometry.main
                : alpha(theme.palette.text.primary, 0.12),
          }}
        />
      ))}
    </span>
  );
};

export const Compass = ({ course }) => {
  const { classes } = useStyles();
  return (
    <span className={classes.compass} style={{ direction: 'ltr' }} aria-hidden>
      <svg viewBox="0 0 56 56" width="56" height="56">
        <circle className={classes.compassRing} cx="28" cy="28" r="26" />
        {[0, 90, 180, 270].map((a) => (
          <line
            key={a}
            className={classes.compassTick}
            x1="28"
            y1="3"
            x2="28"
            y2="7"
            transform={`rotate(${a} 28 28)`}
          />
        ))}
        <text
          className={classes.compassLabel}
          x="28"
          y="14"
          textAnchor="middle"
          dominantBaseline="central"
        >
          N
        </text>
        <path
          className={classes.compassArrow}
          style={{ transform: `rotate(${course || 0}deg)` }}
          d="M 28 17 L 35 38 L 28 33.5 L 21 38 Z"
        />
      </svg>
    </span>
  );
};

export const Odometer = ({ value }) => {
  const { classes, cx } = useStyles();
  const text = String(value);
  return (
    <span className={classes.odometer} dir="ltr" style={{ direction: 'ltr' }}>
      {[...text].map((ch, i) => (
        <span key={i} className={cx(classes.digit, !/\d/.test(ch) && classes.digitSep)}>
          {ch}
        </span>
      ))}
    </span>
  );
};

export const AnimatedValue = ({ value, format }) => {
  const animated = useAnimatedNumber(value);
  return format(typeof value === 'number' ? animated : value);
};

export const StatusChip = ({ icon, label, state, on, alert, index = 0, onClick }) => {
  const { classes, cx, theme } = useStyles();
  const dotColor = alert
    ? theme.palette.error.main
    : on
      ? theme.palette.success.main
      : theme.palette.neutral.main;
  return (
    <div
      className={cx(
        classes.chip,
        classes.enter,
        on && !alert && classes.chipOn,
        onClick && classes.clickable,
      )}
      style={{ animationDelay: `${index * 35}ms` }}
      {...clickProps(onClick, label)}
    >
      <span
        className={cx(
          classes.chipIcon,
          on && !alert && classes.chipIconOn,
          alert && classes.chipIconAlert,
        )}
      >
        {icon}
      </span>
      <span className={classes.chipText}>
        <span className={classes.chipLabel}>{label}</span>
        <span className={classes.chipState}>
          <span className={classes.dot} style={{ backgroundColor: dotColor }} />
          {state}
        </span>
      </span>
    </div>
  );
};

export const MetricTile = ({
  icon,
  label,
  value,
  caption,
  visual,
  footer,
  tone,
  small,
  index = 0,
  onClick,
}) => {
  const { classes, cx } = useStyles();
  return (
    <div
      className={cx(classes.tile, classes.enter, onClick && classes.clickable)}
      style={{ animationDelay: `${index * 35}ms` }}
      {...clickProps(onClick, label)}
    >
      <div className={classes.tileHead}>
        <span
          className={cx(
            classes.tileIcon,
            tone === 'warning' && classes.tileIconWarning,
            tone === 'error' && classes.tileIconError,
          )}
        >
          {icon}
        </span>
        <span className={classes.tileLabel} title={label}>
          {label}
        </span>
        {onClick && (
          <span className={cx(classes.tileEdit, 'vf-tile-edit')} aria-hidden>
            <TuneRoundedIcon />
          </span>
        )}
      </div>
      <div className={classes.tileBody}>
        <span className={cx(classes.tileValue, small && classes.tileValueSmall)}>{value}</span>
        {visual}
      </div>
      {footer}
      {caption && <span className={classes.tileCaption}>{caption}</span>}
    </div>
  );
};
