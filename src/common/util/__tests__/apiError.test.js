import { describe, expect, it } from 'vitest';
import { ApiError, endpointOf, errorKind, parseErrorBody, setErrorTranslator } from '../apiError';

describe('error kinds', () => {
  it('maps statuses and database codes', () => {
    expect(errorKind({ status: 401 })).toBe('unauthorized');
    expect(errorKind({ status: 403 })).toBe('forbidden');
    expect(errorKind({ status: 400, code: '42501' })).toBe('forbidden');
    expect(errorKind({ status: 409, code: '23505' })).toBe('duplicate');
    expect(errorKind({ status: 409 })).toBe('conflict');
    expect(errorKind({ status: 404 })).toBe('notFound');
    expect(errorKind({ status: 502 })).toBe('server');
    expect(errorKind({ status: 400 })).toBe('general');
    expect(errorKind({ kind: 'timeout' })).toBe('timeout');
  });
});

describe('error bodies', () => {
  it('reads PostgREST JSON', () => {
    expect(
      parseErrorBody('{"code":"23505","message":"duplicate key value","details":"Key (plate)"}'),
    ).toEqual({ code: '23505', detail: 'duplicate key value\nKey (plate)' });
  });
  it('keeps plain text', () => {
    expect(parseErrorBody('Manager access required - SecurityException')).toEqual({
      detail: 'Manager access required - SecurityException',
    });
    expect(parseErrorBody('')).toEqual({ detail: '' });
  });
});

describe('ApiError', () => {
  it('puts the translated line first and the technical text after it', () => {
    setErrorTranslator((key) => ({ errorForbidden: 'אין הרשאה' })[key] || key);
    const error = new ApiError({ status: 403, endpoint: 'api/users', detail: 'Forbidden' });
    expect(error.message.split('\n')).toEqual(['אין הרשאה', '403 api/users', 'Forbidden']);
    expect(error.kind).toBe('forbidden');
    expect(error.status).toBe(403);
    setErrorTranslator((key) => key);
  });

  it('strips the query from the endpoint', () => {
    expect(endpointOf('api/positions?deviceId=1')).toBe('api/positions');
  });
});
