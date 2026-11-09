// Loading the privacy rules (ISR-03) and recording who looked at locations.
import store from '../../store';
import { getFleetClient } from './client';
import {
  DEFAULT_POLICY,
  isPrivacyActive,
  maskPositions,
  maskReportRow,
  rangeTouchesHidden,
} from './privacy';

const fleetReady = () => store.getState().fleet.status === 'ready';
const FLEET_WAIT_MS = 15000;

// A report opened straight from a link can ask before the fleet session is up: wait for it to
// settle (ready, failed or disabled) so the rules are not skipped by accident.
const settledFleet = () =>
  new Promise((resolve) => {
    const settled = () => !['idle', 'loading'].includes(store.getState().fleet.status);
    if (settled()) {
      resolve();
      return;
    }
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve();
    }, FLEET_WAIT_MS);
    unsubscribe = store.subscribe(() => {
      if (settled()) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });

// The organization's policy and the private periods that overlap [from, to]. Null when the fleet
// database is not connected (nothing is hidden then: Traccar alone has no privacy rules) or the
// privacy tables are not there yet.
export const loadPrivacy = async (from, to) => {
  await settledFleet();
  if (!fleetReady()) {
    return null;
  }
  const client = getFleetClient();
  const [policy, periods] = await Promise.all([
    client.from('privacy_policies').select('*').maybeSingle(),
    client
      .from('privacy_private_periods')
      .select('traccar_device_id, driver_id, started_at, ended_at')
      .lt('started_at', new Date(to).toISOString())
      .or(`ended_at.is.null,ended_at.gt.${new Date(from).toISOString()}`),
  ]);
  if (policy.error || periods.error) {
    return null;
  }
  return { policy: { ...DEFAULT_POLICY, ...policy.data }, periods: periods.data || [] };
};

// Every look at locations is recorded (data security regulations); a failure never blocks the page.
export const logPrivacyView = (deviceIds, view, from, to) => {
  const ids = [...new Set((deviceIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) {
    return;
  }
  settledFleet()
    .then(() =>
      fleetReady()
        ? getFleetClient().rpc('privacy_log_view', {
            p_device_ids: ids,
            p_view: view,
            p_from: from ? new Date(from).toISOString() : null,
            p_to: to ? new Date(to).toISOString() : null,
          })
        : null,
    )
    .then(
      () => {},
      () => {},
    );
};

// Positions for a period with the hidden ones taken out; records the view.
export const privatePositions = async (positions, { deviceIds, from, to, view }) => {
  logPrivacyView(deviceIds, view, from, to);
  const privacy = await loadPrivacy(from, to);
  return maskPositions(positions, privacy);
};

// Report rows (trips, stops, events) without places in hidden time; records the view.
export const privateRows = async (rows, { deviceIds, from, to, view = 'report', times }) => {
  logPrivacyView(deviceIds, view, from, to);
  const privacy = await loadPrivacy(from, to);
  if (!isPrivacyActive(privacy)) {
    return { rows, hidden: 0 };
  }
  const masked = rows.map((row) => maskReportRow(row, privacy, times));
  return { rows: masked, hidden: masked.filter((row) => row.privacy).length };
};

// The combined report: a vehicle whose period touches hidden time loses its route line (it has no
// times to cut by), and the events in hidden time lose their positions.
export const privateCombined = async (items, { deviceIds, from, to }) => {
  logPrivacyView([...deviceIds, ...items.map((item) => item.deviceId)], 'report', from, to);
  const privacy = await loadPrivacy(from, to);
  if (!isPrivacyActive(privacy)) {
    return { items, hidden: 0 };
  }
  let hidden = 0;
  const masked = items.map((item) => {
    if (!rangeTouchesHidden(privacy, item.deviceId, from, to)) {
      return item;
    }
    const { positions } = maskPositions(item.positions || [], privacy);
    const kept = new Set(positions.map((position) => position.id));
    const events = (item.events || []).map((event) =>
      event.positionId && !kept.has(event.positionId) ? { ...event, positionId: null } : event,
    );
    hidden += 1;
    return { ...item, route: [], positions, events, privacy: 'route' };
  });
  return { items: masked, hidden };
};
