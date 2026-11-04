// "Driving" variant of a vehicle glyph: the glyph slides toward the inline end and three speed
// streaks run out behind it. One geometry is shared by the map marker (drawn on a canvas, see
// createMovingImage) and the device list (speed-lines.svg / speed-lines-static.svg as a CSS mask).
// Coordinates are fractions of the glyph box (0..1), matching the SVGs' 0 0 100 100 viewBox.

export const MOVING_PERIOD = 900; // ms per streak cycle
const FRAME_INTERVAL = 1000 / 15; // redraw at 15 fps: smooth enough, light on battery

export const GLYPH_BOX = { x: 0.24, y: 0.06, size: 0.84 };

const LINES = [
  { y: 0.4, length: 0.18, phase: 0, rest: 0.3 },
  { y: 0.53, length: 0.24, phase: 1 / 3, rest: 0.32 },
  { y: 0.66, length: 0.14, phase: 2 / 3, rest: 0.26 },
];
const THICKNESS = 0.06;
const HEAD_START = 0.34; // streaks leave from just behind the vehicle...
const HEAD_END = -0.02; // ...and fade out toward the marker edge

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Streak positions at time t (ms); with t == null the static, reduced-motion pose.
export const speedLines = (t) =>
  LINES.map(({ y, length, phase, rest }) => {
    if (t == null) {
      return { x: rest - length, y, length, opacity: 1 };
    }
    const p = (t / MOVING_PERIOD + phase) % 1;
    const head = HEAD_START + (HEAD_END - HEAD_START) * p;
    return { x: head - length, y, length, opacity: Math.sin(Math.PI * p) };
  });

const roundedLine = (context, x, y, length, thickness) => {
  const r = thickness / 2;
  context.beginPath();
  context.moveTo(x + r, y - r);
  context.lineTo(x + length - r, y - r);
  context.arc(x + length - r, y, r, -Math.PI / 2, Math.PI / 2);
  context.lineTo(x + r, y + r);
  context.arc(x + r, y, r, Math.PI / 2, (3 * Math.PI) / 2);
  context.fill();
};

let repaintScheduled = false;

// MapLibre StyleImageInterface. MapLibre only calls render() for images that visible markers
// use, so the redraw loop runs only while a driving vehicle is on screen.
export const createMovingImage = ({ background, glyph, color, pixelRatio }) => {
  const canvas = document.createElement('canvas');
  canvas.width = background.width * pixelRatio;
  canvas.height = background.height * pixelRatio;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const box = canvas.width * 0.5; // glyph box, as in prepareIcon
  const origin = (canvas.width - box) / 2;
  const animated = !prefersReducedMotion();

  const draw = (t) => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(background, 0, 0, canvas.width, canvas.height);
    context.drawImage(
      glyph,
      origin + GLYPH_BOX.x * box,
      origin + GLYPH_BOX.y * box,
      GLYPH_BOX.size * box,
      GLYPH_BOX.size * box,
    );
    context.fillStyle = color;
    speedLines(t).forEach(({ x, y, length, opacity }) => {
      context.globalAlpha = opacity;
      roundedLine(context, origin + x * box, origin + y * box, length * box, THICKNESS * box);
    });
    context.globalAlpha = 1;
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  let frame = -1;
  let map;
  return {
    width: canvas.width,
    height: canvas.height,
    data: draw(animated ? 0 : null),
    onAdd(mapInstance) {
      map = mapInstance;
    },
    render() {
      if (!animated) {
        return false;
      }
      const now = performance.now();
      if (!repaintScheduled) {
        repaintScheduled = true;
        setTimeout(() => {
          repaintScheduled = false;
          map?.triggerRepaint();
        }, FRAME_INTERVAL);
      }
      const next = Math.floor(now / FRAME_INTERVAL);
      if (next === frame) {
        return false;
      }
      frame = next;
      this.data = draw(now);
      return true;
    },
  };
};
