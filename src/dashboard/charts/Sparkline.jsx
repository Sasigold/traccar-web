import { useId } from 'react';

// A small trend line in plain SVG (no chart library): de-emphasized line, the latest
// value marked with a dot ringed in the surface color.
const Sparkline = ({ values, width, height, color, accent, surface, fillOpacity = 0 }) => {
  const id = useId();
  const points = values.filter((value) => value != null && Number.isFinite(value));
  if (points.length < 2 || width < 20 || height < 8) {
    return null;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 4;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((value, index) => [
    pad + index * step,
    pad + (height - pad * 2) * (1 - (value - min) / span),
  ]);
  const path = coords
    .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('');
  const [lastX, lastY] = coords.at(-1);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{ display: 'block', direction: 'ltr' }}
    >
      {fillOpacity > 0 && (
        <path
          id={id}
          d={`${path}L${lastX.toFixed(1)},${height}L${pad},${height}Z`}
          fill={color}
          fillOpacity={fillOpacity}
          stroke="none"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3.5}
        fill={accent ?? color}
        stroke={surface}
        strokeWidth={2}
      />
    </svg>
  );
};

export default Sparkline;
