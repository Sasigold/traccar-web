import { describe, expect, it } from 'vitest';
import { buildEnvProblems } from '../buildEnv';

const KEY = 'anon';

describe('buildEnvProblems', () => {
  it('leaves development, tests and the demo alone', () => {
    expect(buildEnvProblems('development', {})).toEqual([]);
    expect(buildEnvProblems('test', {})).toEqual([]);
  });

  it('wants an explicit fleet database for production', () => {
    expect(buildEnvProblems('production', { VITE_APP_ENV: 'production' })).toHaveLength(1);
    expect(
      buildEnvProblems('production', {
        VITE_APP_ENV: 'production',
        VITE_FLEET_URL: 'https://fleet.example.com',
        VITE_FLEET_ANON_KEY: KEY,
      }),
    ).toEqual([]);
    // Off on purpose.
    expect(buildEnvProblems('production', { VITE_FLEET_URL: '' })).toEqual([]);
  });

  it('wants an https address and a key', () => {
    const problems = buildEnvProblems('production', { VITE_FLEET_URL: 'http://fleet.example.com' });
    expect(problems.join(' ')).toMatch(/https/);
    expect(problems.join(' ')).toMatch(/VITE_FLEET_ANON_KEY/);
  });

  it('never lets staging talk to the production database', () => {
    expect(
      buildEnvProblems('staging', {
        VITE_APP_ENV: 'staging',
        VITE_FLEET_URL: 'https://viper-fleet-api.srv2122641.hstgr.cloud/',
        VITE_FLEET_ANON_KEY: KEY,
      }),
    ).toEqual(['The staging build points at the production fleet database.']);
    expect(
      buildEnvProblems('staging', {
        VITE_APP_ENV: 'staging',
        VITE_FLEET_URL: 'https://fleet-staging.example.com',
        VITE_FLEET_ANON_KEY: KEY,
      }),
    ).toEqual([]);
  });

  it('keeps the environment label and the build mode in step', () => {
    expect(
      buildEnvProblems('staging', { VITE_FLEET_URL: '', VITE_APP_ENV: 'production' }),
    ).toHaveLength(1);
  });
});
