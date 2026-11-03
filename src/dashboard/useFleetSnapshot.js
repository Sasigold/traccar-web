import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';

export const fleetStates = ['moving', 'stopped', 'offline', 'unknown'];

// Speeds below this (knots) count as stationary GPS drift.
const MOVING_THRESHOLD = 1;

export const deviceState = (device, position) => {
  if (!position || !device.lastUpdate || device.status === 'unknown') {
    return 'unknown';
  }
  if (device.status === 'offline') {
    return 'offline';
  }
  const moving = position.attributes?.motion || position.speed > MOVING_THRESHOLD;
  return moving ? 'moving' : 'stopped';
};

// A live, client-side snapshot of the whole fleet derived from the store.
export default () => {
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const events = useSelector((state) => state.events.items);

  return useMemo(() => {
    const counts = { moving: 0, stopped: 0, offline: 0, unknown: 0 };
    const vehicles = [];
    let ignitionOn = 0;
    let movingSpeedSum = 0;
    let odometer = 0;
    let odometerCount = 0;

    Object.values(devices).forEach((device) => {
      if (device.disabled) return;
      const position = positions[device.id];
      const state = deviceState(device, position);
      counts[state] += 1;
      if (state === 'moving') {
        movingSpeedSum += position.speed || 0;
      }
      if (position?.attributes?.ignition) {
        ignitionOn += 1;
      }
      const totalDistance = position?.attributes?.totalDistance;
      if (typeof totalDistance === 'number') {
        odometer += totalDistance;
        odometerCount += 1;
      }
      vehicles.push({ device, position, state });
    });

    const total = vehicles.length;
    const active = counts.moving + counts.stopped;

    const attention = [];
    vehicles.forEach(({ device, position, state }) => {
      const battery = position?.attributes?.batteryLevel;
      if (state === 'unknown') {
        attention.push({ device, reason: 'noData', severity: 'neutral' });
      } else if (state === 'offline' && dayjs().diff(dayjs(device.lastUpdate), 'hour') >= 24) {
        attention.push({
          device,
          reason: 'offlineLong',
          severity: 'error',
          since: device.lastUpdate,
        });
      } else if (state === 'offline') {
        attention.push({
          device,
          reason: 'offline',
          severity: 'warning',
          since: device.lastUpdate,
        });
      }
      if (typeof battery === 'number' && battery <= 20) {
        attention.push({ device, reason: 'lowBattery', severity: 'warning', value: battery });
      }
    });

    const severityRank = { error: 0, warning: 1, neutral: 2 };
    attention.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

    const today = dayjs().startOf('day');
    const eventsToday = events.filter((event) => dayjs(event.eventTime).isAfter(today)).length;

    const ranked = [...vehicles].sort((a, b) => {
      const order = fleetStates.indexOf(a.state) - fleetStates.indexOf(b.state);
      if (order !== 0) return order;
      return (b.position?.speed || 0) - (a.position?.speed || 0);
    });

    return {
      total,
      active,
      counts,
      ignitionOn,
      averageMovingSpeed: counts.moving ? movingSpeedSum / counts.moving : 0,
      odometer: odometerCount ? odometer : null,
      vehicles: ranked,
      attention,
      events,
      eventsToday,
    };
  }, [devices, positions, events]);
};
