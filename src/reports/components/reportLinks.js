import dayjs from 'dayjs';

// REP-07: links from a vehicle in a period to the same vehicle and period elsewhere. Pure.

const range = (from, to) => ({
  from: dayjs(from).toISOString(),
  to: dayjs(to).toISOString(),
});

const link = (path, deviceId, from, to) =>
  `${path}?${new URLSearchParams({ deviceId: String(deviceId), ...range(from, to) })}`;

export const tripsLink = (deviceId, from, to) => link('/reports/trips', deviceId, from, to);

export const replayLink = (deviceId, from, to) => link('/replay', deviceId, from, to);

// A stop: replay from ten minutes before it to ten minutes after.
export const STOP_MARGIN_MINUTES = 10;
export const stopReplayLink = (stop) =>
  replayLink(
    stop.deviceId,
    dayjs(stop.startTime).subtract(STOP_MARGIN_MINUTES, 'minute'),
    dayjs(stop.endTime || stop.startTime).add(STOP_MARGIN_MINUTES, 'minute'),
  );

// A summary row: its day (daily summary) or its period.
export const summaryTripsLink = (item, daily) =>
  daily
    ? tripsLink(
        item.deviceId,
        dayjs(item.startTime).startOf('day'),
        dayjs(item.startTime).endOf('day'),
      )
    : tripsLink(item.deviceId, item.startTime, item.endTime || item.startTime);
