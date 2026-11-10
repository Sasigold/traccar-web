import { describe, expect, it } from 'vitest';
import {
  cellOf,
  cellsOf,
  conditionSpeedLimit,
  risksByCell,
  speedFactor,
  weatherRisks,
  weatherUrl,
} from '../weather';

describe('weather where the vehicles are (SAF-07)', () => {
  it('rounds positions to coarse cells and groups vehicles', () => {
    expect(cellOf(32.0853, 34.7818)).toBe('32.00,34.75');
    const cells = cellsOf({
      1: { deviceId: 1, latitude: 32.08, longitude: 34.78 },
      2: { deviceId: 2, latitude: 32.06, longitude: 34.8 },
      3: { deviceId: 3, latitude: 31.25, longitude: 34.79 },
      4: { deviceId: 4 },
    });
    expect(cells).toEqual({ '32.00,34.75': [1, 2], '31.25,34.75': [3] });
  });

  it('reads heavy rain, rain, dust and heat', () => {
    expect(weatherRisks({ precipitation: 12, weather_code: 63 })).toEqual(['heavyRain']);
    expect(weatherRisks({ precipitation: 0, weather_code: 95 })).toEqual(['heavyRain']);
    expect(weatherRisks({ precipitation: 1.2, weather_code: 61 })).toEqual(['rain']);
    expect(weatherRisks({ precipitation: 0, weather_code: 3, visibility: 600 })).toEqual(['dust']);
    expect(weatherRisks({ precipitation: 0, weather_code: 0, temperature_2m: 43 })).toEqual([
      'heat',
    ]);
    expect(weatherRisks({ precipitation: 0, weather_code: 1, temperature_2m: 28 })).toEqual([]);
  });

  it('lowers the speed threshold in bad conditions', () => {
    expect(speedFactor(['heavyRain'])).toBe(0.8);
    expect(speedFactor(['rain', 'heat'])).toBe(0.9);
    expect(conditionSpeedLimit(110, ['heavyRain'])).toBe(85);
    expect(conditionSpeedLimit(90, ['rain'])).toBe(80);
    expect(conditionSpeedLimit(90, [])).toBe(90);
  });

  it('asks for several cells at once and maps the answer back', () => {
    const url = new URL(weatherUrl(['32.00,34.75', '31.25,34.75']));
    expect(url.searchParams.get('latitude')).toBe('32,31.25');
    expect(url.searchParams.get('longitude')).toBe('34.75,34.75');
    expect(
      risksByCell(
        ['32.00,34.75', '31.25,34.75'],
        [{ current: { precipitation: 10 } }, { current: { temperature_2m: 41 } }],
      ),
    ).toEqual({ '32.00,34.75': ['heavyRain'], '31.25,34.75': ['heat'] });
  });
});
