import { describe, expect, it } from 'vitest';
import { eventPoints, stopPoints } from '../common/heatmapPoints';

describe('density map points (LIV-27)', () => {
  const stops = [
    { latitude: 32, longitude: 34.8, duration: 2 * 3600000, engineHours: 0 },
    { latitude: 32.1, longitude: 34.9, duration: 3600000, engineHours: 1800000 },
    { latitude: null, longitude: null, duration: 3600000, engineHours: 0 },
  ];

  it('weights stops by their length, and idling by the engine time', () => {
    expect(stopPoints(stops, 'stops').map((point) => point.weight)).toEqual([2, 1]);
    expect(stopPoints(stops, 'idle')).toEqual([{ latitude: 32.1, longitude: 34.9, weight: 0.5 }]);
  });

  it('places harsh driving and speeding events at their positions', () => {
    const items = [
      {
        positions: [
          { id: 1, latitude: 32, longitude: 34.8 },
          { id: 2, latitude: 32.2, longitude: 35 },
        ],
        events: [
          { type: 'alarm', positionId: 1, attributes: { alarm: 'hardBraking' } },
          { type: 'alarm', positionId: 2, attributes: { alarm: 'sos' } },
          { type: 'deviceOverspeed', positionId: 2 },
        ],
      },
    ];
    expect(eventPoints(items, 'harsh')).toEqual([{ latitude: 32, longitude: 34.8 }]);
    expect(eventPoints(items, 'overspeed')).toEqual([{ latitude: 32.2, longitude: 35 }]);
  });
});
