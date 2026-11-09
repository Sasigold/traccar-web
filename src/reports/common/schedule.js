// Plain schedules for emailed reports (REP-08). Traccar sends a scheduled report when an event of
// its calendar ends, covering that event, so "daily at 07:00" is a 24-hour event that ends at
// 07:00 every day: each email covers the 24 hours before it. Pure, unit-tested.

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (value) => String(value).padStart(2, '0');

// Local wall-clock time as iCal YYYYMMDDTHHmmss.
const stamp = (date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;

// { frequency: 'daily' | 'weekly', weekday (0 = Sunday), hour } → iCal text.
export const scheduleCalendar = ({ frequency, weekday = 0, hour }, timezone, now = new Date()) => {
  const days = frequency === 'weekly' ? 7 : 1;
  // The event that ends at the next send time starts one period earlier; any start in the past
  // keeps the same rhythm.
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
  if (frequency === 'weekly') {
    end.setDate(end.getDate() - ((end.getDay() - weekday + 7) % 7));
  }
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const rule =
    frequency === 'weekly'
      ? `RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[start.getDay()]}`
      : 'RRULE:FREQ=DAILY';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//viper fleet//scheduled report//EN',
    'BEGIN:VEVENT',
    `UID:report-${frequency}-${weekday}-${hour}`,
    `DTSTART;TZID=${timezone}:${stamp(start)}`,
    `DTEND;TZID=${timezone}:${stamp(end)}`,
    rule,
    'SUMMARY:Scheduled report',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
};

// Back from iCal to { frequency, weekday, hour } when the calendar is one of ours; null otherwise
// (an advanced calendar made by hand).
export const describeSchedule = (ical) => {
  const text = String(ical || '');
  const uid = /UID:report-(daily|weekly)-(\d)-(\d{1,2})/.exec(text);
  if (!uid) {
    return null;
  }
  return { frequency: uid[1], weekday: Number(uid[2]), hour: Number(uid[3]) };
};
