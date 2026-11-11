import { describe, expect, it } from 'vitest';
import { putPendingFiles, takePendingFiles } from '../pendingFiles';

describe('files handed to the next screen (LIV-17)', () => {
  it('are taken once', () => {
    putPendingFiles('incident', ['frame']);
    expect(takePendingFiles('incident')).toEqual(['frame']);
    expect(takePendingFiles('incident')).toEqual([]);
  });
});
