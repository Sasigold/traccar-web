import { useTheme, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';

// Decorative, schematic fleet map for the login brand panel: a flat street grid,
// aqua routes that draw in, and vehicle markers (navy disc, white ring, aqua core,
// as on the product map) driving along them. Brand surface only, never behind data
// or forms. Fictional: it shows no real positions. Static when the user prefers
// reduced motion.

const XS = [40, 150, 260, 370, 480, 590];
const YS = [40, 120, 200, 280, 360];

const ROUTES = [
  { d: 'M40 120 H260 V280 H480 V360', dur: 16, start: [40, 120] },
  { d: 'M590 40 V120 H370 V200 H150 V360', dur: 20, start: [590, 40] },
  { d: 'M150 40 H480 V200 H590 V280', dur: 18, start: [150, 40] },
];

const draw = keyframes`
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const useStyles = makeStyles()((theme) => ({
  svg: {
    display: 'block',
    width: '100%',
    height: '100%',
    direction: 'ltr',
  },
  route: {
    strokeDasharray: 1,
    strokeDashoffset: 1,
    animation: `${draw} 2.4s ${theme.tokens.motion.easing.emphasized} forwards`,
  },
  vehicles: {
    opacity: 0,
    animation: `${fadeIn} 600ms ease-out 1.2s forwards`,
  },
}));

const Vehicle = ({ route, index, animated, colors }) => {
  const [x, y] = route.start;
  return (
    <g transform={animated ? undefined : `translate(${x} ${y})`}>
      {animated && (
        <animateMotion
          dur={`${route.dur}s`}
          begin={`${index * -3}s`}
          repeatCount="indefinite"
          path={route.d}
          keyPoints="0;1;0"
          keyTimes="0;0.5;1"
          calcMode="linear"
        />
      )}
      {index === 0 && animated && (
        <circle r="10" fill="none" stroke={colors.aqua} strokeWidth="2">
          <animate attributeName="r" values="10;30" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle r="11" fill={colors.navy} stroke={colors.white} strokeWidth="3" />
      <circle r="4.5" fill={colors.aqua} />
    </g>
  );
};

const LiveFleetScene = ({ className }) => {
  const theme = useTheme();
  const { classes, cx } = useStyles();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const animated = !reduceMotion;
  const colors = theme.palette.brand;
  const street = alpha(colors.ice, 0.07);

  return (
    <svg
      className={cx(classes.svg, className)}
      viewBox="0 0 630 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(-7 315 200) translate(0 0)">
        {YS.map((y) => (
          <line key={`h${y}`} x1="-80" x2="710" y1={y} y2={y} stroke={street} strokeWidth="12" />
        ))}
        {XS.map((x) => (
          <line key={`v${x}`} x1={x} x2={x} y1="-80" y2="480" stroke={street} strokeWidth="12" />
        ))}
        <circle
          cx="480"
          cy="200"
          r="52"
          fill={alpha(colors.aqua, 0.06)}
          stroke={alpha(colors.aqua, 0.45)}
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        {ROUTES.map((route, index) => (
          <path
            key={route.d}
            d={route.d}
            pathLength="1"
            fill="none"
            stroke={alpha(colors.aqua, 0.55)}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animated ? classes.route : undefined}
            style={animated ? { animationDelay: `${300 + index * 250}ms` } : undefined}
          />
        ))}
        <g className={animated ? classes.vehicles : undefined}>
          {ROUTES.map((route, index) => (
            <Vehicle
              key={route.d}
              route={route}
              index={index}
              animated={animated}
              colors={colors}
            />
          ))}
        </g>
      </g>
    </svg>
  );
};

export default LiveFleetScene;
