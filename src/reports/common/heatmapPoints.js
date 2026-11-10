// LIV-27: what a density map shows, from Traccar's reports. Pure, tested.
//   stops      where vehicles stopped, weighted by how long
//   idle       where engines ran while standing, weighted by the idle time
//   harsh      harsh braking, acceleration and cornering
//   overspeed  speeding events
export const HEATMAP_KINDS = ['stops', 'idle', 'harsh', 'overspeed'];
export const HARSH_ALARMS = ['hardBraking', 'hardAcceleration', 'hardCornering'];

const HOUR = 3600000;
const located = (point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude);

export const stopPoints = (stops, kind) =>
  stops
    .filter(located)
    .filter((stop) => kind !== 'idle' || stop.engineHours > 0)
    .map((stop) => ({
      latitude: stop.latitude,
      longitude: stop.longitude,
      weight: (kind === 'idle' ? stop.engineHours : stop.duration) / HOUR,
    }));

export const eventPoints = (items, kind) =>
  items.flatMap((item) =>
    item.events
      .filter((event) =>
        kind === 'overspeed'
          ? event.type === 'deviceOverspeed'
          : event.type === 'alarm' && HARSH_ALARMS.includes(event.attributes?.alarm),
      )
      .map((event) => item.positions.find((position) => position.id === event.positionId))
      .filter(located)
      .map((position) => ({ latitude: position.latitude, longitude: position.longitude })),
  );
