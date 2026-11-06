// Bird's-eye vehicle markers for driving cars, trucks and motorcycles. The vehicle is seen from
// above with its nose pointing north; the map layer rotates it to the vehicle's course (see
// MapMarkers), so on the map it drives in the direction it is heading. Same language as the
// marker disc (brand book page 14): navy body, white ring, status-tinted glass, flat fills.
// Geometry is in a 100 x 100 box, drawn onto a canvas the size of the marker disc.
import { brandColors } from '../../common/theme/tokens';

// Device icon key -> top-down shape. Other categories keep the disc with speed streaks.
export const topDownShapes = {
  car: 'car',
  van: 'car',
  truck: 'truck',
  motorcycle: 'motorcycle',
  scooter: 'motorcycle',
};

const rect = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
  `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
  `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

const ellipse = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}Z`;

// body: navy, outlined in white as one silhouette. glass: status tint. lights: white.
const shapes = {
  car: {
    body: [rect(32, 12, 36, 76, 13), rect(26, 33, 9, 5, 2.5), rect(65, 33, 9, 5, 2.5)],
    glass: ['M36 31H64L60 43H40Z', 'M40 70H60L63 79H37Z'],
    lights: [rect(36, 15, 8, 4, 2), rect(56, 15, 8, 4, 2)],
  },
  truck: {
    body: [
      rect(34, 8, 32, 22, 6),
      rect(28, 16, 8, 4, 2),
      rect(64, 16, 8, 4, 2),
      rect(30, 33, 40, 58, 4),
    ],
    glass: ['M37 14H63L61 21H39Z', rect(47, 40, 6, 44, 3)],
    lights: [rect(37, 9.5, 6, 3, 1.5), rect(57, 9.5, 6, 3, 1.5)],
  },
  motorcycle: {
    body: [
      rect(45.5, 8, 9, 20, 4.5),
      rect(45.5, 70, 9, 22, 4.5),
      ellipse(50, 52, 10, 22),
      rect(33, 28, 34, 5, 2.5),
      ellipse(50, 57, 14, 7),
    ],
    glass: [ellipse(50, 50, 8, 8)],
    lights: [ellipse(50, 36, 2.5, 2.5)],
  },
};

const RING = 5.5; // white outline, in box units (about the marker disc's ring)

// Image data for one shape and status tint, at the marker disc's size.
export const createTopDownImage = ({ shape, size, color, pixelRatio }) => {
  const canvas = document.createElement('canvas');
  canvas.width = size * pixelRatio;
  canvas.height = size * pixelRatio;
  const context = canvas.getContext('2d');
  const scale = canvas.width / 100;
  context.scale(scale, scale);
  context.lineJoin = 'round';

  const { body, glass, lights } = shapes[shape];
  const bodyPaths = body.map((d) => new Path2D(d));

  // Soft ink shadow under the silhouette, as on the marker disc. Drawn as a faint ink outline
  // whose shadow is the only thing left once the white ring is painted exactly over it.
  context.save();
  context.globalAlpha = 0.35;
  context.shadowColor = brandColors.ink;
  context.shadowBlur = 3 * scale;
  context.shadowOffsetY = 1.2 * scale;
  context.strokeStyle = brandColors.ink;
  context.lineWidth = RING * 2;
  bodyPaths.forEach((path) => context.stroke(path));
  context.restore();

  context.strokeStyle = brandColors.white;
  context.lineWidth = RING * 2;
  bodyPaths.forEach((path) => context.stroke(path));

  context.fillStyle = brandColors.navy;
  bodyPaths.forEach((path) => context.fill(path));

  context.fillStyle = color;
  glass.forEach((d) => context.fill(new Path2D(d)));

  context.fillStyle = brandColors.white;
  lights.forEach((d) => context.fill(new Path2D(d)));

  return context.getImageData(0, 0, canvas.width, canvas.height);
};
