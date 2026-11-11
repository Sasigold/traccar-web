import { readingState, temperatureReadings } from '../../common/fleet/sensors';

// REP-23: the cold chain over a period, per vehicle, from its positions and its limits
// (temp_min, temp_max on the vehicle, set on the sensors page). An excursion starts when any
// sensor leaves the range and ends when all are back; its time runs to the next position.
// Pure, unit-tested.

/**
 * @param {{ fixTime: string, attributes?: Record<string, any> }[]} positions one vehicle's, any order
 * @param {{ temp_min?: number | null, temp_max?: number | null }} limits
 */
export const coldChainOf = (positions, limits) => {
  const readings = (positions || [])
    .map((position) => ({
      time: Date.parse(position.fixTime),
      values: temperatureReadings(position.attributes).map((reading) => reading.value),
    }))
    .filter((point) => point.values.length && Number.isFinite(point.time))
    .sort((a, b) => a.time - b.time);
  let excursions = 0;
  let outMs = 0;
  let min = null;
  let max = null;
  let wasOut = false;
  readings.forEach((point, index) => {
    point.values.forEach((value) => {
      min = min == null ? value : Math.min(min, value);
      max = max == null ? value : Math.max(max, value);
    });
    const out = point.values.some(
      (value) => readingState(value, limits?.temp_min, limits?.temp_max) !== 'ok',
    );
    if (out && !wasOut) excursions += 1;
    if (out && index + 1 < readings.length) outMs += readings[index + 1].time - point.time;
    wasOut = out;
  });
  return { readings: readings.length, excursions, outMs, min, max };
};
