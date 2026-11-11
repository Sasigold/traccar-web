import fetchOrThrow from '../../common/util/fetchOrThrow';
import { privateCombined, privateRows } from '../../common/fleet/privacyData';
import { eventPoints, stopPoints } from './heatmapPoints';

// LIV-27: the points of a density map for vehicles and a period, private time left out. Shared by
// the heat map report and the heat layer of the live map.
const loadHeatPoints = async ({ kind, deviceIds = [], groupIds = [], from, to, signal }) => {
  const query = new URLSearchParams({ from, to });
  deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
  groupIds.forEach((groupId) => query.append('groupId', groupId));
  if (kind === 'stops' || kind === 'idle') {
    const response = await fetchOrThrow(`api/reports/stops?${query}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    const rows = await response.json();
    const { rows: shown } = await privateRows(rows, {
      deviceIds: [...deviceIds, ...rows.map((row) => row.deviceId)],
      from,
      to,
      times: undefined,
    });
    return stopPoints(shown, kind);
  }
  const response = await fetchOrThrow(`api/reports/combined?${query}`, { signal });
  const { items } = await privateCombined(await response.json(), { deviceIds, from, to });
  return eventPoints(items, kind);
};

export default loadHeatPoints;
