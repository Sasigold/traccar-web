// One illustrative trip, from the depot to a customer, as a function of trip time.
// ILLUSTRATIVE UI / FICTIONAL DATA (BRAND.md, section 8).
//
// Scroll maps linearly to trip time. Distance is the integral of speed, so the
// vehicle stands still on the road while the clock runs during stops (start-up,
// refuelling, arrival), exactly like a real trip on the map.

export const TRIP_MINUTES = 74;
export const START_CLOCK = 7 * 60 + 42; // 07:42
export const ODOMETER_START = 48210;

// [minute, km/h]
const SPEED = [
  [0, 0],
  [2.2, 0],
  [4, 30],
  [7, 46],
  [11, 55],
  [15, 64],
  [19, 70],
  [23, 66],
  [26, 84],
  [28.5, 104],
  [32.5, 102],
  [33.6, 96],
  [34.6, 36],
  [37.5, 60],
  [43, 74],
  [47, 42],
  [49, 0],
  [53.5, 0],
  [55.5, 36],
  [60, 84],
  [66, 90],
  [69, 50],
  [71, 0],
  [TRIP_MINUTES, 0],
];

// Lane changes for an overtake: [minute, lane offset] (0 = own lane, 1 = passing lane).
const LANE = [
  [0, 0],
  [16.5, 0],
  [17.6, 1],
  [20.4, 1],
  [21.5, 0],
  [TRIP_MINUTES, 0],
];

const interpolate = (table, t) => {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    const [t1, v1] = table[i];
    if (t <= t1) {
      const [t0, v0] = table[i - 1];
      const k = (t - t0) / (t1 - t0);
      const s = k * k * (3 - 2 * k); // smoothstep between keyframes
      return v0 + (v1 - v0) * s;
    }
  }
  return table[table.length - 1][1];
};

// A little life in the needle while moving: deterministic, so it never jitters on the same frame.
const wobble = (t, v) => (v > 20 ? Math.sin(t * 2.7) * 1.4 + Math.sin(t * 7.3) * 0.8 : 0);

export const speedAt = (t) => Math.max(0, interpolate(SPEED, t) + wobble(t, interpolate(SPEED, t)));
export const laneAt = (t) => interpolate(LANE, t);

// Distance table, integrated once at load.
const STEP = 0.05;
const DIST = [0];
for (let t = STEP; t <= TRIP_MINUTES + STEP / 2; t += STEP) {
  const v = interpolate(SPEED, t - STEP / 2);
  DIST.push(DIST[DIST.length - 1] + (v / 60) * STEP);
}
export const TRIP_KM = DIST[DIST.length - 1];

export const distanceAt = (t) => {
  const x = Math.min(Math.max(t, 0), TRIP_MINUTES) / STEP;
  const i = Math.floor(x);
  const a = DIST[i] ?? TRIP_KM;
  const b = DIST[i + 1] ?? TRIP_KM;
  return a + (b - a) * (x - i);
};

// Fuel in percent: consumption follows distance, refuelling between minute 49.5 and 53.
const FUEL_START = 34;
const FUEL_PER_KM = 0.36;
const REFUEL = { from: 49.6, to: 53.2, level: 96 };
export const fuelAt = (t) => {
  const used = (km) => km * FUEL_PER_KM;
  if (t < REFUEL.from) return FUEL_START - used(distanceAt(t));
  const before = FUEL_START - used(distanceAt(REFUEL.from));
  if (t < REFUEL.to) {
    const k = (t - REFUEL.from) / (REFUEL.to - REFUEL.from);
    return before + (REFUEL.level - before) * k;
  }
  return REFUEL.level - used(distanceAt(t) - distanceAt(REFUEL.to));
};
export const REFUEL_LITRES = 41;

export const clockAt = (t) => {
  const m = Math.floor(START_CLOCK + t);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const kmAt = (t) => distanceAt(t);

// Zones drawn on the road, in minutes of the trip (converted to positions at layout time).
export const ZONES = [
  { id: 'depot', kind: 'fence', from: -1, to: 3, label: 'מחסן מרכזי', tag: 'GEOFENCE' },
  { id: 'limit', kind: 'limit', from: 25.5, to: 34, label: 'אזור 90', tag: '90' },
  { id: 'station', kind: 'station', at: 51.4, label: 'תחנת דלק', tag: 'FUEL' },
  { id: 'customer', kind: 'fence', from: 69.6, to: 76, label: 'מרכז הפצה דרום', tag: 'GEOFENCE' },
];

// Every event the system raises on this trip.
// tone: info (navy), ok (aqua), warn, alert.
export const EVENTS = [
  { t: 1, icon: 'key', tone: 'info', title: 'המנוע הותנע', meta: 'מחסן מרכזי' },
  { t: 3.2, icon: 'fence', tone: 'info', title: 'יציאה מגדר', meta: 'מחסן מרכזי' },
  { t: 29.4, icon: 'speed', tone: 'warn', title: 'חריגת מהירות', meta: '104 קמ״ש באזור 90' },
  { t: 34.2, icon: 'warning', tone: 'alert', title: 'בלימה חדה', meta: '0.6g · כביש 4' },
  { t: 44, icon: 'gas', tone: 'warn', title: 'דלק נמוך', meta: 'נותרו 22%' },
  { t: 52.8, icon: 'gas', tone: 'ok', title: 'תדלוק', meta: `+${REFUEL_LITRES} ליטר` },
  { t: 58.5, icon: 'build', tone: 'info', title: 'טיפול 15,000 ק״מ', meta: 'בעוד 320 ק״מ' },
  { t: 70.2, icon: 'fence', tone: 'ok', title: 'כניסה לגדר', meta: 'מרכז הפצה דרום' },
  { t: 72.2, icon: 'flag', tone: 'ok', title: 'הנסיעה הסתיימה', meta: 'הדוח נשמר' },
];

export const CHAPTERS = [
  {
    from: 0,
    en: 'DEPART',
    title: ['יוצאים', 'לדרך.'],
    body: 'המנוע הותנע והרכב יצא מהמחסן. אתם יודעים על זה עוד לפני שמישהו מתקשר לעדכן.',
  },
  {
    from: 6,
    en: 'LIVE',
    title: ['רואים הכל.', 'בזמן אמת.'],
    body: 'מיקום, מהירות, דלק ונהג מצטרפים לרכב ומתעדכנים כל הזמן, על מפה אחת.',
  },
  {
    from: 25,
    en: 'ALERTS',
    title: ['כל חריגה.', 'ברגע שקרתה.'],
    body: 'חריגת מהירות, בלימה חדה או דלק נמוך מגיעים אליכם כהתראה, עם מיקום ושעה מדויקים.',
  },
  {
    from: 46,
    en: 'CARE',
    title: ['הרכב מטופל.', 'בזמן.'],
    body: 'תדלוקים, טיפולים ותוקף מסמכים נמדדים אוטומטית, לפי קילומטרים ולפי תאריך.',
  },
  {
    from: 66,
    en: 'ARRIVE',
    title: ['הגיע.', 'ומתועד.'],
    body: 'כל נסיעה נשמרת כדוח מלא: מסלול, זמנים, עצירות ואירועים. בלחיצה אחת.',
  },
];

export const chapterAt = (t) => {
  let index = 0;
  CHAPTERS.forEach((c, i) => {
    if (t >= c.from) index = i;
  });
  return index;
};

// Telemetry rows that join the vehicle one by one, at these minutes.
export const ROWS_AT = [1, 4, 8, 12, 16];

export const DRIVER = 'דניאל אלון';

// Max speed and averages for the closing trip report.
let max = 0;
let moving = 0;
for (let t = 0; t <= TRIP_MINUTES; t += 0.1) {
  max = Math.max(max, speedAt(t));
  if (speedAt(t) > 3) moving += 0.1;
}
export const SUMMARY = {
  km: TRIP_KM,
  minutes: TRIP_MINUTES,
  max: Math.round(max),
  avg: Math.round(TRIP_KM / (moving / 60)),
  events: EVENTS.length,
};
