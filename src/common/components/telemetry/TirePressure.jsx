import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { IconButton, Tooltip } from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import TireRepairRoundedIcon from '@mui/icons-material/TireRepairRounded';
import { useTranslation } from '../LocalizationProvider';
import { formatPressure } from './vehicleProfile';
import { capitalize } from '../../util/stringUtils';

// Top view of a car with its four tires, front at the top. Left and right are
// physical sides of the vehicle, so the drawing never flips in RTL.
const useStyles = makeStyles()((theme) => ({
  card: {
    padding: theme.spacing(2, 2.5, 2.5),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.5, 1.5, 2),
    },
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  title: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '1rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    '& svg': { fontSize: 20, color: theme.palette.primary.main },
  },
  target: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    paddingInline: theme.spacing(1),
    paddingBlock: 2,
    borderRadius: theme.tokens.radius.pill,
    backgroundColor: theme.palette.surface.tint,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gridTemplateRows: '1fr 1fr',
    alignItems: 'center',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(3),
    maxWidth: 480,
    marginInline: 'auto',
    [theme.breakpoints.down('sm')]: {
      columnGap: theme.spacing(1),
    },
  },
  car: {
    gridColumn: 2,
    gridRow: '1 / 3',
    width: 112,
    height: 'auto',
    [theme.breakpoints.down('sm')]: {
      width: 92,
    },
  },
  wheel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    padding: theme.spacing(1, 1.25),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.surface.sunken,
  },
  wheelWarning: {
    borderColor: alpha(theme.palette.warning.main, 0.6),
    backgroundColor: alpha(theme.palette.warning.main, 0.08),
  },
  wheelError: {
    borderColor: alpha(theme.palette.error.main, 0.6),
    backgroundColor: alpha(theme.palette.error.main, 0.08),
  },
  wheelLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  wheelValue: {
    fontSize: '1.375rem',
    fontWeight: 700,
    lineHeight: 1.15,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
    [theme.breakpoints.down('sm')]: {
      fontSize: '1.125rem',
    },
  },
  wheelUnit: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginInline: 4,
  },
  compact: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  compactCar: {
    width: 26,
    height: 48,
  },
  compactValue: {
    fontSize: '0.875rem',
    fontWeight: 700,
    lineHeight: 1.1,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
}));

const useTireColors = () => {
  const { theme } = useStyles();
  return (status) => {
    switch (status) {
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'ok':
        return theme.palette.geometry.main;
      default:
        return alpha(theme.palette.text.primary, 0.22);
    }
  };
};

const tirePlacement = {
  fl: { x: 6, y: 34 },
  fr: { x: 98, y: 34 },
  rl: { x: 6, y: 144 },
  rr: { x: 98, y: 144 },
};

const CarShape = ({ reading, className, offsetX = 0, children, viewBox = '0 0 120 220' }) => {
  const { theme } = useStyles();
  const tireColor = useTireColors();
  const body =
    theme.palette.mode === 'dark' ? theme.palette.surface.sunken : theme.palette.brand.ice;
  const outline =
    theme.palette.mode === 'dark' ? theme.palette.surface.borderStrong : theme.palette.brand.navy;
  const glass =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.brand.aqua, 0.18)
      : alpha(theme.palette.brand.navy, 0.18);
  return (
    <svg className={className} viewBox={viewBox} style={{ direction: 'ltr' }} aria-hidden>
      <g transform={`translate(${offsetX} 0)`}>
        {Object.entries(tirePlacement).map(([wheel, { x, y }]) => (
          <rect
            key={wheel}
            x={x}
            y={y}
            width={16}
            height={40}
            rx={6}
            fill={tireColor(reading.wheels[wheel].status)}
          />
        ))}
        <path
          d="M 38 8 Q 60 2 82 8 Q 102 14 103 40 L 104 186 Q 103 210 82 213 Q 60 216 38 213 Q 17 210 16 186 L 17 40 Q 18 14 38 8 Z"
          fill={body}
          stroke={outline}
          strokeWidth={2.5}
        />
        <path d="M 30 62 Q 60 50 90 62 L 84 88 Q 60 82 36 88 Z" fill={glass} />
        <rect
          x={36}
          y={94}
          width={48}
          height={64}
          rx={10}
          fill="none"
          stroke={outline}
          strokeOpacity={0.35}
          strokeWidth={2}
        />
        <path d="M 36 170 Q 60 176 84 170 L 88 190 Q 60 198 32 190 Z" fill={glass} />
        <rect x={30} y={10} width={14} height={5} rx={2.5} fill={outline} fillOpacity={0.4} />
        <rect x={76} y={10} width={14} height={5} rx={2.5} fill={outline} fillOpacity={0.4} />
      </g>
      {children}
    </svg>
  );
};

const wheelOrder = [
  ['fl', 'left'],
  ['fr', 'right'],
  ['rl', 'left'],
  ['rr', 'right'],
];

const wheelLabels = {
  fl: 'tireFrontLeft',
  fr: 'tireFrontRight',
  rl: 'tireRearLeft',
  rr: 'tireRearRight',
};

export const pressureUnitKey = (unit) => `pressureUnit${capitalize(unit)}`;

const TirePressure = ({ reading, onConfigure }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const unit = t(pressureUnitKey(reading.unit));
  return (
    <section className={classes.card} aria-label={t('telemetryTires')}>
      <div className={classes.head}>
        <span className={classes.title}>
          <TireRepairRoundedIcon />
          {t('telemetryTires')}
        </span>
        {reading.target != null && (
          <span className={classes.target}>
            {t('tireTarget')}: {formatPressure(reading.target, reading.unit)} {unit}
          </span>
        )}
        {onConfigure && (
          <Tooltip title={t('vehicleSettings')}>
            <IconButton size="small" onClick={onConfigure} aria-label={t('vehicleSettings')}>
              <TuneRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>
      <div className={classes.layout} style={{ direction: 'ltr' }}>
        {wheelOrder.map(([wheel, side], index) => {
          const { value, status } = reading.wheels[wheel];
          return (
            <div
              key={wheel}
              className={cx(
                classes.wheel,
                status === 'warning' && classes.wheelWarning,
                status === 'error' && classes.wheelError,
              )}
              // Inline so the RTL plugin keeps the physical side.
              style={{
                gridColumn: side === 'left' ? 1 : 3,
                gridRow: index < 2 ? 1 : 2,
                alignItems: side === 'left' ? 'flex-end' : 'flex-start',
                textAlign: side === 'left' ? 'right' : 'left',
              }}
            >
              <span className={classes.wheelLabel} dir="auto">
                {t(wheelLabels[wheel])}
              </span>
              <span className={classes.wheelValue}>
                {value == null ? t('tireNoData') : formatPressure(value, reading.unit)}
                {value != null && <span className={classes.wheelUnit}>{unit}</span>}
              </span>
            </div>
          );
        })}
        <CarShape reading={reading} className={classes.car} />
      </div>
    </section>
  );
};

// Small car with colored tires and the lowest pressure, for the map card.
export const TirePressureCompact = ({ reading }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const values = Object.values(reading.wheels)
    .map((wheel) => wheel.value)
    .filter((value) => value != null);
  const lowest = values.length ? Math.min(...values) : null;
  return (
    <span className={classes.compact}>
      <CarShape reading={reading} className={classes.compactCar} />
      <span className={classes.compactValue}>
        {formatPressure(lowest, reading.unit)}
        <span className={classes.wheelUnit}>{t(pressureUnitKey(reading.unit))}</span>
      </span>
    </span>
  );
};

export default TirePressure;
