import { describe, expect, it } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  it('keeps the error until the reset key changes', () => {
    const error = new Error('boom');
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
    expect(
      ErrorBoundary.getDerivedStateFromProps({ resetKey: '/a' }, { error, resetKey: '/a' }),
    ).toBe(null);
    expect(
      ErrorBoundary.getDerivedStateFromProps({ resetKey: '/b' }, { error, resetKey: '/a' }),
    ).toEqual({ error: null, resetKey: '/b' });
  });
});
