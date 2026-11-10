import { describe, expect, it } from 'vitest';
import { playbackMode, streamUrl } from '../streamPlayback';

describe('live video playback (LIV-17)', () => {
  it('uses hls.js where it is supported', () => {
    expect(playbackMode({ isSupported: () => true }, { canPlayType: () => 'maybe' })).toBe('hls');
  });

  it('falls back to the built-in player on iPhone', () => {
    const video = {
      canPlayType: (type) => (type === 'application/vnd.apple.mpegurl' ? 'maybe' : ''),
    };
    expect(playbackMode({ isSupported: () => false }, video)).toBe('native');
  });

  it('says so when neither works', () => {
    expect(playbackMode({ isSupported: () => false }, { canPlayType: () => '' })).toBe(
      'unsupported',
    );
    expect(playbackMode(undefined, undefined)).toBe('unsupported');
  });

  it('builds the stream address under the app base', () => {
    expect(streamUrl(7, 2, 'https://fleet.example/app/')).toBe(
      'https://fleet.example/app/api/stream/7/2/live.m3u8',
    );
  });
});
