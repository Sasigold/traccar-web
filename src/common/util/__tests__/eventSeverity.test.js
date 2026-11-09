import { describe, expect, it } from 'vitest';
import { eventSeverity, unreadCount } from '../eventSeverity';

const alarm = (value) => ({ type: 'alarm', attributes: { alarm: value } });

describe('event severity', () => {
  it('makes danger critical', () => {
    expect(eventSeverity(alarm('sos'))).toBe('critical');
    expect(eventSeverity(alarm('accident'))).toBe('critical');
    expect(eventSeverity(alarm('overspeed,sos'))).toBe('critical');
  });

  it('makes other alarms and attention events warnings', () => {
    expect(eventSeverity(alarm('overspeed'))).toBe('warning');
    expect(eventSeverity(alarm(undefined))).toBe('warning');
    expect(eventSeverity({ type: 'deviceOverspeed', attributes: {} })).toBe('warning');
    expect(eventSeverity({ type: 'maintenance', attributes: {} })).toBe('warning');
  });

  it('leaves routine events as information', () => {
    expect(eventSeverity({ type: 'ignitionOn', attributes: {} })).toBe('info');
    expect(eventSeverity({ type: 'geofenceEnter', attributes: {} })).toBe('info');
    expect(eventSeverity(undefined)).toBe('info');
  });

  it('follows the sound preferences', () => {
    const preferences = { soundAlarms: 'overspeed, door', soundEvents: 'geofenceExit' };
    expect(eventSeverity(alarm('door'), preferences)).toBe('critical');
    expect(eventSeverity(alarm('overspeed'), preferences)).toBe('critical');
    expect(eventSeverity({ type: 'geofenceExit', attributes: {} }, preferences)).toBe('critical');
    expect(eventSeverity({ type: 'geofenceEnter', attributes: {} }, preferences)).toBe('info');
  });
});

describe('unread events', () => {
  const events = [
    { eventTime: '2026-11-09T12:05:00Z' },
    { eventTime: '2026-11-09T12:00:00Z' },
    { eventTime: 'not a time' },
  ];
  it('counts events after the last visit', () => {
    expect(unreadCount(events, Date.parse('2026-11-09T12:01:00Z'))).toBe(1);
    expect(unreadCount(events, 0)).toBe(2);
    expect(unreadCount(events, null)).toBe(2);
  });
});
