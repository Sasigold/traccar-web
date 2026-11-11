// LIV-29: a cluster's ring split by status: online (aqua), offline (red) and the rest (slate),
// each in proportion, in eighths. The ring is an image named after its shares, drawn when the map
// first asks for it. Pure parts, tested.

export const RING_PREFIX = 'vf-ring';
const STEPS = 8;

// The image name for a cluster, as a style expression: vf-ring-<mode>-<online>-<offline>.
export const ringImageExpression = (mode) => {
  const share = (key) => ['round', ['*', ['/', ['get', key], ['get', 'point_count']], STEPS]];
  return [
    'concat',
    `${RING_PREFIX}-${mode}-`,
    ['to-string', share('online')],
    '-',
    ['to-string', ['min', share('offline'), ['-', STEPS, share('online')]]],
  ];
};

// The parts of a ring named so: [{ status, from, to }] in turns (0..1) from the top, clockwise.
export const parseRing = (name) => {
  const match = new RegExp(`^${RING_PREFIX}-(light|dark)-(\\d)-(\\d)$`).exec(name);
  if (!match) return null;
  const online = Math.min(STEPS, Number(match[2]));
  const offline = Math.min(STEPS - online, Number(match[3]));
  const parts = [];
  let at = 0;
  /** @type {Array<[string, number]>} */ ([
    ['online', online],
    ['offline', offline],
    ['other', STEPS - online - offline],
  ]).forEach(([status, steps]) => {
    if (!steps) return;
    parts.push({ status, from: at / STEPS, to: (at + steps) / STEPS });
    at += steps;
  });
  return { mode: match[1], parts };
};

// Draws the ring (a canvas the size of `diameter` css px at `ratio`) and returns its pixels.
export const drawRing = (parts, colors, { diameter, width, ratio = 1 }) => {
  const size = Math.ceil(diameter * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const radius = (size - width * ratio) / 2;
  context.lineWidth = width * ratio;
  // A hair of space between parts, so two of them read as two.
  const gap = parts.length > 1 ? 0.012 : 0;
  parts.forEach(({ status, from, to }) => {
    context.beginPath();
    context.strokeStyle = colors[status];
    const start = (from + gap) * 2 * Math.PI - Math.PI / 2;
    const end = (to - gap) * 2 * Math.PI - Math.PI / 2;
    context.arc(size / 2, size / 2, radius, start, end);
    context.stroke();
  });
  return context.getImageData(0, 0, size, size);
};
