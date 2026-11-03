import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { alpha } from '@mui/material/styles';
import { ViperMark } from '../common/components/brand/ViperLogo';
import { signal } from '../common/theme/tokens';

const SWEEP_SECONDS = 6;

const sweep = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const ping = keyframes`
  0%, 6% { opacity: 1; transform: scale(1); }
  30% { opacity: 0.35; transform: scale(1); }
  100% { opacity: 0.35; transform: scale(1); }
`;

const halo = keyframes`
  0%, 6% { opacity: 0.9; transform: scale(0.6); }
  40% { opacity: 0; transform: scale(2.6); }
  100% { opacity: 0; transform: scale(2.6); }
`;

const dash = keyframes`
  to { stroke-dashoffset: -240; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const useStyles = makeStyles()(() => ({
  root: {
    position: 'relative',
    width: 'clamp(220px, 36vh, 380px)',
    aspectRatio: '1',
    flexShrink: 0,
    '@media (prefers-reduced-motion: reduce)': {
      '& *': { animation: 'none !important' },
    },
  },
  svg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
  sweep: {
    position: 'absolute',
    inset: '4%',
    borderRadius: '50%',
    background: `conic-gradient(from 0deg, transparent 0deg 290deg, ${alpha(signal[400], 0.05)} 300deg, ${alpha(signal[400], 0.38)} 359deg, transparent 360deg)`,
    animation: `${sweep} ${SWEEP_SECONDS}s linear infinite`,
    maskImage: 'radial-gradient(circle, black 55%, transparent 71%)',
  },
  route: {
    animation: `${dash} 9s linear infinite`,
  },
  blip: {
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `${ping} ${SWEEP_SECONDS}s linear infinite`,
  },
  halo: {
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `${halo} ${SWEEP_SECONDS}s ease-out infinite`,
  },
  mark: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '22%',
    height: '22%',
    transform: 'translate(-50%, -58%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: `drop-shadow(0 0 18px ${alpha(signal[400], 0.55)})`,
    '& svg': {
      height: '100%',
      width: 'auto',
      animation: `${float} 4s ease-in-out infinite`,
    },
  },
}));

// Vehicles on the scope: [angle in degrees (0 = 12 o'clock, clockwise), distance 0..1].
const vehicles = [
  [38, 0.62],
  [104, 0.84],
  [161, 0.4],
  [215, 0.74],
  [286, 0.55],
  [332, 0.9],
];

const C = 200;
const R = 180;

const LoginHero = () => {
  const { classes } = useStyles();
  const line = alpha('#ffffff', 0.14);
  const faint = alpha('#ffffff', 0.07);

  return (
    <div className={classes.root} aria-hidden="true">
      <svg viewBox="0 0 400 400" className={classes.svg}>
        <defs>
          <radialGradient id="loginHeroCore" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={signal[400]} stopOpacity="0.28" />
            <stop offset="1" stopColor={signal[400]} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R} fill={alpha('#ffffff', 0.02)} stroke={line} />
        {[0.25, 0.5, 0.75].map((k) => (
          <circle key={k} cx={C} cy={C} r={R * k} fill="none" stroke={faint} />
        ))}
        <circle
          cx={C}
          cy={C}
          r={R + 12}
          fill="none"
          stroke={alpha('#ffffff', 0.18)}
          strokeDasharray="2 6"
        />
        <line x1={C - R} y1={C} x2={C + R} y2={C} stroke={faint} />
        <line x1={C} y1={C - R} x2={C} y2={C + R} stroke={faint} />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i * 10 * Math.PI) / 180;
          const inner = i % 3 === 0 ? R - 10 : R - 5;
          return (
            <line
              key={i}
              x1={C + Math.sin(a) * inner}
              y1={C - Math.cos(a) * inner}
              x2={C + Math.sin(a) * R}
              y2={C - Math.cos(a) * R}
              stroke={alpha('#ffffff', i % 3 === 0 ? 0.35 : 0.16)}
            />
          );
        })}
        <circle cx={C} cy={C} r={80} fill="url(#loginHeroCore)" />
        <path
          className={classes.route}
          d="M60 270 C 120 230, 150 300, 210 250 S 300 160, 345 150"
          fill="none"
          stroke={alpha(signal[300], 0.7)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="6 10"
        />
        <path
          className={classes.route}
          d="M110 70 C 150 120, 120 160, 180 190 S 260 260, 300 330"
          fill="none"
          stroke={alpha('#ffffff', 0.35)}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="4 10"
          style={{ animationDuration: '12s' }}
        />
        {vehicles.map(([angle, distance]) => {
          const a = (angle * Math.PI) / 180;
          const x = C + Math.sin(a) * R * distance;
          const y = C - Math.cos(a) * R * distance;
          const delay = `${((angle / 360) * SWEEP_SECONDS).toFixed(2)}s`;
          return (
            <g key={angle}>
              <circle
                className={classes.halo}
                cx={x}
                cy={y}
                r={6}
                fill="none"
                stroke={signal[300]}
                strokeWidth="1.5"
                style={{ animationDelay: delay }}
              />
              <circle
                className={classes.blip}
                cx={x}
                cy={y}
                r={4}
                fill={signal[300]}
                style={{ animationDelay: delay }}
              />
            </g>
          );
        })}
      </svg>
      <div className={classes.sweep} />
      <div className={classes.mark}>
        <ViperMark tone="light" size={null} />
      </div>
    </div>
  );
};

export default LoginHero;
