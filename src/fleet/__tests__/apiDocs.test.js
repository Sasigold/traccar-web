import { describe, expect, it } from 'vitest';
import { apiBaseUrl, apiLimits, curlExample, powerBiQuery } from '../apiDocs';

const BASE = 'https://api.example.com/functions/v1/public-api/v1';

describe('apiDocs', () => {
  it('builds the base address from the fleet URL', () => {
    expect(apiBaseUrl('https://api.example.com/')).toBe(BASE);
  });

  it('shows the key header in the curl example', () => {
    expect(curlExample(BASE, 'vehicles')).toBe(
      `curl -H "X-API-Key: vf_…" "${BASE}/vehicles?limit=100"`,
    );
  });

  it('pages through every row in Power BI with a fixed address', () => {
    const query = powerBiQuery(BASE, 'fuel');
    expect(query).toContain(`BaseUrl = "${BASE}/"`);
    expect(query).toContain('RelativePath = Resource');
    expect(query).toContain('Resource = "fuel"');
    expect(query).toContain('[next_cursor]');
    expect(query).toContain('#"X-API-Key" = ApiKey');
    expect(query.startsWith('let\n') && query.endsWith('in\n    Result')).toBe(true);
  });

  it('falls back to the default limits', () => {
    expect(apiLimits(null)).toEqual({ perMinute: 60, perDay: 20000 });
    expect(apiLimits({ per_minute: 300, per_day: 100000 })).toEqual({
      perMinute: 300,
      perDay: 100000,
    });
  });
});
