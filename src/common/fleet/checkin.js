// SAF-02: the QR in a vehicle's cabin opens the driver's check-in. Pure, unit-tested.

export const checkinUrl = (base, deviceId, code) => {
  const url = new URL('driver/checkin', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('d', String(deviceId));
  url.searchParams.set('c', code);
  return url.toString();
};

// A scanned text -> { deviceId, code }, or null when it is not a check-in QR.
export const parseCheckin = (text) => {
  try {
    const url = new URL(String(text).trim());
    if (!url.pathname.endsWith('/driver/checkin')) return null;
    const deviceId = Number(url.searchParams.get('d'));
    const code = url.searchParams.get('c');
    return Number.isInteger(deviceId) && deviceId > 0 && code ? { deviceId, code } : null;
  } catch {
    return null;
  }
};

// The driver of a trip: Traccar's identified driver (iButton / RFID) first, then the
// assignment at the trip's start. resolve(deviceId, moment) -> driver key or null.
export const tripDriverKey = (trip, resolve) =>
  trip.driverUniqueId ||
  (resolve ? resolve(trip.deviceId, Date.parse(trip.startTime)) : null) ||
  null;
