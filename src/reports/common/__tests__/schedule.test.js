import { describe, expect, it } from 'vitest';
import { describeSchedule, scheduleCalendar } from '../schedule';

const field = (ical, name) => ical.split('\n').find((line) => line.startsWith(name));

describe('report schedules', () => {
  // A Wednesday afternoon.
  const now = new Date(2026, 10, 11, 15, 30);

  it('sends daily at the hour, covering the 24 hours before', () => {
    const ical = scheduleCalendar({ frequency: 'daily', hour: 7 }, 'Asia/Jerusalem', now);
    expect(field(ical, 'DTSTART')).toBe('DTSTART;TZID=Asia/Jerusalem:20261110T070000');
    expect(field(ical, 'DTEND')).toBe('DTEND;TZID=Asia/Jerusalem:20261111T070000');
    expect(field(ical, 'RRULE')).toBe('RRULE:FREQ=DAILY');
  });

  it('sends weekly on the day, covering the week before', () => {
    const ical = scheduleCalendar(
      { frequency: 'weekly', weekday: 0, hour: 8 },
      'Asia/Jerusalem',
      now,
    );
    // The last Sunday was 8.11; the week before it started on Sunday 1.11.
    expect(field(ical, 'DTSTART')).toBe('DTSTART;TZID=Asia/Jerusalem:20261101T080000');
    expect(field(ical, 'DTEND')).toBe('DTEND;TZID=Asia/Jerusalem:20261108T080000');
    expect(field(ical, 'RRULE')).toBe('RRULE:FREQ=WEEKLY;BYDAY=SU');
  });

  it('reads its own schedules back, and not hand-made calendars', () => {
    const ical = scheduleCalendar({ frequency: 'weekly', weekday: 4, hour: 18 }, 'UTC', now);
    expect(describeSchedule(ical)).toEqual({ frequency: 'weekly', weekday: 4, hour: 18 });
    expect(describeSchedule('BEGIN:VCALENDAR\nUID:abc\nEND:VCALENDAR')).toBeNull();
  });
});
