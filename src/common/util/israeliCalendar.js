// ISR-09: Shabbat and the Israeli holidays, worked out here (no service to call): the Hebrew date
// from the browser's own Hebrew calendar (Intl), the times from sunset. A rest period starts at
// candle lighting (sunset minus 18 minutes) on the eve and ends at nightfall (sunset plus 40
// minutes) on the day. Pure, tested.

export const ISRAEL = 'Asia/Jerusalem';
export const DEFAULT_PLACE = { latitude: 32.08, longitude: 34.78 }; // Tel Aviv
export const CANDLES_MINUTES = 18;
export const NIGHTFALL_MINUTES = 40;
const DAY = 86400000;

// The Israeli calendar date of a moment: { year, month, day, weekday (0 Sunday) }.
export const israeliDate = (time) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ISRAEL,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })
      .formatToParts(new Date(time))
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
  };
};

// Noon in Israel of a calendar day, as a timestamp (safe for day arithmetic across DST).
const noonOf = ({ year, month, day }) => Date.UTC(year, month - 1, day, 9, 30);

const hebrewOf = (time) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-u-ca-hebrew', {
      timeZone: ISRAEL,
      day: 'numeric',
      month: 'long',
    })
      .formatToParts(new Date(time))
      .map((part) => [part.type, part.value]),
  );
  return { day: Number(parts.day), month: parts.month };
};

// The holidays that are days of rest in Israel (yom tov), by Hebrew date.
const HOLIDAYS = {
  'Tishri 1': 'roshHashana',
  'Tishri 2': 'roshHashana',
  'Tishri 10': 'yomKippur',
  'Tishri 15': 'sukkot',
  'Tishri 22': 'simchatTorah',
  'Nisan 15': 'pesach',
  'Nisan 21': 'pesach',
  'Sivan 6': 'shavuot',
};

// Independence Day: 5 Iyar, moved so it never touches Shabbat (Thursday when 5 Iyar is a Friday
// or Shabbat, Tuesday when it is a Monday).
const isIndependenceDay = (hebrew, weekday) => {
  if (hebrew.month !== 'Iyar') return false;
  if (hebrew.day === 5) return weekday >= 2 && weekday <= 4;
  if (hebrew.day === 4) return weekday === 4; // 5 Iyar on Friday
  if (hebrew.day === 3) return weekday === 4; // 5 Iyar on Shabbat
  if (hebrew.day === 6) return weekday === 2; // 5 Iyar on Monday
  return false;
};

// What the day is, if it is a day of rest: 'shabbat', a holiday's key, or null.
export const restDayOf = (date) => {
  const noon = noonOf(date);
  const hebrew = hebrewOf(noon);
  const holiday = HOLIDAYS[`${hebrew.month} ${hebrew.day}`];
  if (holiday) return holiday;
  if (isIndependenceDay(hebrew, date.weekday)) return 'independenceDay';
  return date.weekday === 6 ? 'shabbat' : null;
};

// Sunset of a calendar day at a place (NOAA's algorithm, about a minute off), as a timestamp.
export const sunsetOf = ({ year, month, day }, { latitude, longitude } = DEFAULT_PLACE) => {
  const rad = Math.PI / 180;
  const n = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / DAY);
  const lngHour = longitude / 15;
  const t = n + (18 - lngHour) / 24;
  const anomaly = 0.9856 * t - 3.289;
  let lon =
    anomaly + 1.916 * Math.sin(anomaly * rad) + 0.02 * Math.sin(2 * anomaly * rad) + 282.634;
  lon = ((lon % 360) + 360) % 360;
  let ra = Math.atan(0.91764 * Math.tan(lon * rad)) / rad;
  ra = ((ra % 360) + 360) % 360;
  ra = (ra + (Math.floor(lon / 90) * 90 - Math.floor(ra / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(lon * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(90.833 * rad) - sinDec * Math.sin(latitude * rad)) /
    (cosDec * Math.cos(latitude * rad));
  const hour = Math.acos(cosH) / rad / 15;
  const local = hour + ra - 0.06571 * t - 6.622;
  const ut = (((local - lngHour) % 24) + 24) % 24;
  return Date.UTC(year, month - 1, day) + ut * 3600000;
};

// The rest period a moment falls in, or null: { kind, start, end }.
export const restPeriodAt = (time, place = DEFAULT_PLACE) => {
  const today = israeliDate(time);
  const tomorrow = israeliDate(noonOf(today) + DAY);
  const todayRest = restDayOf(today);
  const tomorrowRest = restDayOf(tomorrow);
  if (todayRest && time < sunsetOf(today, place) + NIGHTFALL_MINUTES * 60000) {
    const eve = israeliDate(noonOf(today) - DAY);
    return {
      kind: todayRest,
      start: sunsetOf(eve, place) - CANDLES_MINUTES * 60000,
      end: sunsetOf(today, place) + NIGHTFALL_MINUTES * 60000,
    };
  }
  if (tomorrowRest && time >= sunsetOf(today, place) - CANDLES_MINUTES * 60000) {
    return {
      kind: tomorrowRest,
      start: sunsetOf(today, place) - CANDLES_MINUTES * 60000,
      end: sunsetOf(tomorrow, place) + NIGHTFALL_MINUTES * 60000,
    };
  }
  return null;
};

export const isRestTime = (time, place) => Boolean(restPeriodAt(time, place));
