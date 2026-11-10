// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { aqua, navy, status } from '../theme/tokens';

// Route speed in the brand: five steps of the aqua-navy family, slow to fast (no rainbow).
// The night map needs the light end for the fast steps to stay visible. Segments over the
// vehicle's speed limit take the status error color.
export const SPEED_RAMP = {
  light: [aqua[300], aqua[500], aqua[700], navy[600], navy[800]],
  dark: [navy[300], aqua[700], aqua[600], aqua[500], aqua[300]],
};

export const overspeedColor = (dark) => (dark ? status.dark.error : status.light.error);

const getSpeedColor = (speed, minSpeed, maxSpeed, { dark = false, limit } = {}) => {
  if (limit > 0 && speed > limit) {
    return overspeedColor(dark);
  }
  const ramp = dark ? SPEED_RAMP.dark : SPEED_RAMP.light;
  const range = maxSpeed - minSpeed;
  const normalized = range > 0 ? (speed - minSpeed) / range : 0;
  const step = Math.round(Math.max(0, Math.min(1, normalized)) * (ramp.length - 1));
  return ramp[step];
};

export default getSpeedColor;
