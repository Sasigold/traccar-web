// BRD-05: an Israeli demo fleet for sales, screenshots and demonstrations: Hebrew names, Israeli
// plates, real cities and streets, drivers, and validity dates some of which have expired.
// It is chosen with the cookie demoFleet=il, or for the whole server with DEMO_FLEET=il
// (`npm run demo:il`). The default fleet stays as it was, because the e2e tests are written
// against it. All of it is fictional (ILLUSTRATIVE UI / FICTIONAL DATA).
import route from './route.js';

// The London route's shape, moved to each city: [longitude, latitude] of the start.
const LONDON_START = [route[0][0], route[0][1]];

export const CITIES = [
  { center: [34.7915, 32.0853], address: 'דרך מנחם בגין 132, תל אביב-יפו' },
  { center: [34.9896, 32.794], address: 'שדרות הנשיא 104, חיפה' },
  { center: [34.7913, 31.2518], address: 'שדרות רגר 18, באר שבע' },
  { center: [35.2137, 31.7683], address: 'יפו 97, ירושלים' },
  { center: [34.8113, 31.9642], address: 'הרצל 60, ראשון לציון' },
  { center: [34.8878, 32.1782], address: 'אחוזה 120, רעננה' },
];

export const VEHICLES = [
  'טרנזיט חלוקה צפון',
  'קנגו טכנאי',
  'הסעות עובדים',
  'שליח עירוני',
  'רכב מנהל אזור',
  'משאית קירור',
];

export const DRIVER_NAMES = {
  1: 'דנה לוי',
  2: 'יוסי כהן',
  3: 'נועה מזרחי',
};

// The route point in a city: the same turns, starting at that city.
export const placeOf = (cityIndex, [longitude, latitude]) => {
  const city = CITIES[cityIndex % CITIES.length];
  return [
    city.center[0] + (longitude - LONDON_START[0]),
    city.center[1] + (latitude - LONDON_START[1]),
  ];
};

export const israeliDrivers = (drivers) =>
  drivers.map((driver) => ({ ...driver, name: DRIVER_NAMES[driver.id] || driver.name }));
