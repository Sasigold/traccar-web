import { describe, expect, it } from 'vitest';
import { releaseFile, releaseOf } from '../release';

const SHA = '3F2A9C1D0E5B6A7C8D9E0F1A2B3C4D5E6F7A8B9C';

describe('release', () => {
  it('is the version plus the short commit', () => {
    expect(releaseOf({ version: '1.0.0', sha: SHA })).toBe('1.0.0+3f2a9c1');
  });

  it('says local when the commit is unknown or not a commit', () => {
    expect(releaseOf({ version: '1.0.0', sha: '' })).toBe('1.0.0+local');
    expect(releaseOf({ version: '1.0.0', sha: 'main; rm -rf' })).toBe('1.0.0+local');
  });

  it('describes the build for version.json', () => {
    expect(
      releaseFile({ version: '1.0.0', sha: SHA, environment: 'staging', builtAt: 't' }),
    ).toEqual({
      release: '1.0.0+3f2a9c1',
      version: '1.0.0',
      commit: SHA.toLowerCase(),
      environment: 'staging',
      builtAt: 't',
    });
  });
});
