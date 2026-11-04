import { useId } from 'react';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import useAnimatedNumber from './useAnimatedNumber';

// Dashboard dial: a flat arc with ticks, a filled value arc and a needle. The
// dial always reads clockwise (low to high), so it is locked to LTR and does
// not flip in the Hebrew layout, like the instrument cluster in a car.

const VIEW = 200;
const CENTER = VIEW / 2;
const RADIUS = 78;

const polar = (angle, radius) => {
  const rad = (angle * Math.PI) / 180;
  return [CENTER + radius * Math.sin(rad), CENTER - radius * Math.cos(rad)];
};

const arcPath = (from, to, radius) => {
  const [x1, y1] = polar(from, radius);
  const [x2, y2] = polar(to, radius);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
};

const useStyles = makeStyles()((theme, { size, height }) => ({
  root: {
    position: 'relative',
    width: size,
    maxWidth: '100%',
    marginInline: 'auto',
  },
  svg: {
    display: 'block',
    width: '100%',
    aspectRatio: `${VIEW} / ${height}`,
    overflow: 'visible',
  },
  track: {
    fill: 'none',
    stroke: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.14 : 0.08),
    strokeLinecap: 'round',
  },
  value: {
    fill: 'none',
    strokeLinecap: 'round',
    transition: `stroke-dashoffset 900ms ${theme.tokens.motion.easing.emphasized}, stroke ${theme.tokens.motion.duration.slow}ms ease`,
  },
  zone: {
    fill: 'none',
    strokeLinecap: 'butt',
  },
  tick: {
    stroke: alpha(theme.palette.text.primary, 0.32),
    strokeLinecap: 'round',
  },
  tickMajor: {
    stroke: alpha(theme.palette.text.primary, 0.55),
  },
  tickLabel: {
    fill: theme.palette.text.secondary,
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: 600,
  },
  needle: {
    transformOrigin: `${CENTER}px ${CENTER}px`,
    transformBox: 'view-box',
    transition: `transform 900ms ${theme.tokens.motion.easing.emphasized}`,
  },
  needleBody: {
    fill: theme.palette.primary.main,
  },
  hub: {
    fill: theme.palette.background.paper,
    stroke: theme.palette.primary.main,
    strokeWidth: 3,
  },
  readout: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  number: {
    fontFamily: theme.typography.fontFamily,
    fontWeight: 600,
    letterSpacing: '-0.03em',
    lineHeight: 1,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
  },
  unit: {
    marginTop: 4,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: theme.palette.text.secondary,
  },
}));

const ArcGauge = ({
  value,
  min = 0,
  max = 100,
  sweep = 240,
  size = 220,
  thickness = 12,
  ticks = [],
  minorTicks = 0,
  zones = [],
  color,
  formatValue = (v) => Math.round(v),
  unit,
  icon,
  showNeedle = true,
  numberSize = 40,
}) => {
  const id = useId();
  const start = -sweep / 2;
  const end = sweep / 2;
  // Enough height for the lowest point of the arc plus the tick labels.
  const bottomAngle = Math.max(Math.abs(start), 90);
  const height = Math.ceil(CENTER - RADIUS * Math.cos((bottomAngle * Math.PI) / 180) + 22);
  const { classes, cx, theme } = useStyles({ size, height });

  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamped = numeric == null ? min : Math.min(max, Math.max(min, numeric));
  const ratio = max > min ? (clamped - min) / (max - min) : 0;
  const angle = start + ratio * sweep;
  const animated = useAnimatedNumber(numeric);

  const toAngle = (v) => start + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * sweep;
  const fill = color || theme.palette.geometry.main;

  const minorStep = minorTicks > 0 ? sweep / minorTicks : 0;
  // Pull the readout up under the hub. A percentage margin is relative to the
  // width, which keeps it in place at any rendered size.
  const readoutOffset = `${-((height - CENTER - 14) / VIEW) * 100}%`;

  return (
    <div className={classes.root} style={{ direction: 'ltr' }}>
      <svg
        className={classes.svg}
        viewBox={`0 0 ${VIEW} ${height}`}
        role="img"
        aria-labelledby={`${id}-label`}
      >
        <title id={`${id}-label`}>
          {numeric == null ? '–' : `${formatValue(numeric)}${unit ? ` ${unit}` : ''}`}
        </title>
        <path className={classes.track} d={arcPath(start, end, RADIUS)} strokeWidth={thickness} />
        {zones.map((zone) => (
          <path
            key={`${zone.from}-${zone.to}`}
            className={classes.zone}
            d={arcPath(toAngle(zone.from), toAngle(zone.to), RADIUS + thickness / 2 + 4)}
            stroke={zone.color}
            strokeWidth={3}
          />
        ))}
        <path
          className={classes.value}
          d={arcPath(start, end, RADIUS)}
          strokeWidth={thickness}
          stroke={fill}
          pathLength={100}
          strokeDasharray="100 100"
          strokeDashoffset={100 - ratio * 100}
          opacity={numeric == null || ratio <= 0 ? 0 : 1}
        />
        {minorStep > 0 &&
          Array.from({ length: minorTicks + 1 }, (_, i) => {
            const a = start + i * minorStep;
            const [x1, y1] = polar(a, RADIUS - thickness / 2 - 4);
            const [x2, y2] = polar(a, RADIUS - thickness / 2 - 8);
            return (
              <line
                key={`m${a}`}
                className={classes.tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={1.5}
              />
            );
          })}
        {ticks.map((tick) => {
          const a = toAngle(tick.value);
          const [x1, y1] = polar(a, RADIUS - thickness / 2 - 4);
          const [x2, y2] = polar(a, RADIUS - thickness / 2 - 12);
          const [lx, ly] = polar(a, RADIUS - thickness / 2 - 24);
          return (
            <g key={`t${tick.value}`}>
              <line
                className={cx(classes.tick, classes.tickMajor)}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={2.5}
              />
              {tick.label != null && (
                <text
                  className={classes.tickLabel}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {tick.label}
                </text>
              )}
            </g>
          );
        })}
        {showNeedle && (
          <g className={classes.needle} style={{ transform: `rotate(${angle}deg)` }}>
            <path
              className={classes.needleBody}
              d={`M ${CENTER - 3.5} ${CENTER} L ${CENTER} ${CENTER - RADIUS + thickness} L ${CENTER + 3.5} ${CENTER} Z`}
            />
          </g>
        )}
        {showNeedle && <circle className={classes.hub} cx={CENTER} cy={CENTER} r={7} />}
      </svg>
      <div className={classes.readout} style={{ marginTop: readoutOffset }}>
        {icon}
        <span className={classes.number} style={{ fontSize: numberSize }}>
          {numeric == null ? '–' : formatValue(animated)}
        </span>
        {unit && <span className={classes.unit}>{unit}</span>}
      </div>
    </div>
  );
};

export default ArcGauge;
