import { useTheme } from '@mui/material/styles';
import { trackSketch } from '../../common/fleet/accident';
import { useTranslation } from '../../common/components/LocalizationProvider';

const WIDTH = 560;
const HEIGHT = 300;

// SAF-04: the track around the impact, drawn on its own (no map tiles, so it prints the same
// everywhere): the way the vehicle went, where the window starts, the impact, north and a scale.
const TrackSketch = ({ rows, impact }) => {
  const theme = useTheme();
  const t = useTranslation();
  const sketch = trackSketch(rows, WIDTH, HEIGHT, 28);
  if (!sketch) return null;
  const { points, scaleMeters, scalePixels } = sketch;
  const ink = theme.palette.text.primary;
  const hit = points.find((point) => point.row === impact) || points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label={t('insuranceFileSketch')}
      style={{
        maxWidth: WIDTH,
        border: `1px solid ${theme.palette.surface.border}`,
        borderRadius: 12,
        background: theme.palette.background.paper,
      }}
    >
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke={theme.palette.primary.main}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={points[0].x} cy={points[0].y} r={5} fill={theme.palette.text.secondary} />
      <circle
        cx={hit.x}
        cy={hit.y}
        r={9}
        fill="none"
        stroke={theme.palette.error.main}
        strokeWidth={3}
      />
      <circle cx={hit.x} cy={hit.y} r={3} fill={theme.palette.error.main} />
      {/* North, top right: maps read the same in every language. */}
      <g transform={`translate(${WIDTH - 24}, 30)`} direction="ltr">
        <path d="M0,-14 L6,4 L0,0 L-6,4 Z" fill={ink} />
        <text y={18} textAnchor="middle" fontSize={11} fill={ink}>
          N
        </text>
      </g>
      <g transform={`translate(16, ${HEIGHT - 16})`} direction="ltr">
        <line x1={0} x2={scalePixels} y1={0} y2={0} stroke={ink} strokeWidth={2} />
        <line x1={0} x2={0} y1={-4} y2={4} stroke={ink} strokeWidth={2} />
        <line x1={scalePixels} x2={scalePixels} y1={-4} y2={4} stroke={ink} strokeWidth={2} />
        <text x={scalePixels / 2} y={-6} textAnchor="middle" fontSize={11} fill={ink}>
          {scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`}
        </text>
      </g>
    </svg>
  );
};

export default TrackSketch;
