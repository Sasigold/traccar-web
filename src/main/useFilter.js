import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { activityGroup, activityOf } from '../common/util/activity';
import { deviceSearchFields, matchDevice, tokenizeSearch } from '../common/util/deviceSearch';
import { sameItems } from '../common/util/stableArray';
import { byImportance } from './importance';

export default (
  keyword,
  filter,
  filterSort,
  filterMap,
  positions,
  setFilteredDevices,
  setFilteredPositions,
) => {
  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  // The last results: unchanged lists are not set again, so the list and the map skip a render
  // when, for example, only the selected vehicle reported.
  const lastDevicesRef = useRef(null);
  const lastPositionsRef = useRef(null);

  useEffect(() => {
    const deviceGroups = (device) => {
      const groupIds = [];
      let { groupId } = device;
      while (groupId) {
        groupIds.push(groupId);
        groupId = groups[groupId]?.groupId || 0;
      }
      return groupIds;
    };

    const tokens = tokenizeSearch(keyword);
    const scores = new Map();
    const now = Date.now();
    const activities = filter.activities || [];
    const filtered = Object.values(devices)
      .filter((device) => !filter.statuses.length || filter.statuses.includes(device.status))
      .filter(
        (device) =>
          !activities.length ||
          activities.includes(activityGroup(activityOf(device, positions[device.id], now))),
      )
      .filter(
        (device) =>
          !filter.groups.length || deviceGroups(device).some((id) => filter.groups.includes(id)),
      )
      .filter(
        (device) =>
          !filter.geofences.length ||
          (positions[device.id]?.geofenceIds || []).some((id) => filter.geofences.includes(id)),
      )
      .filter((device) => {
        if (!tokens.length) {
          return true;
        }
        const match = matchDevice(
          tokens,
          deviceSearchFields(device, { groups, drivers, position: positions[device.id] }),
        );
        if (match) {
          scores.set(device.id, match.score);
        }
        return Boolean(match);
      });
    switch (filterSort) {
      case 'name':
        filtered.sort((device1, device2) => device1.name.localeCompare(device2.name));
        break;
      case 'lastUpdate':
        filtered.sort((device1, device2) => {
          const time1 = device1.lastUpdate ? dayjs(device1.lastUpdate).valueOf() : 0;
          const time2 = device2.lastUpdate ? dayjs(device2.lastUpdate).valueOf() : 0;
          return time2 - time1;
        });
        break;
      default:
        // Without a chosen order: the best match first when searching, otherwise what needs
        // attention first (LIV-11).
        if (tokens.length) {
          filtered.sort(
            (device1, device2) =>
              scores.get(device2.id) - scores.get(device1.id) ||
              device1.name.localeCompare(device2.name),
          );
        } else {
          filtered.sort(byImportance(positions, now));
        }
        break;
    }
    if (!sameItems(lastDevicesRef.current, filtered)) {
      lastDevicesRef.current = filtered;
      setFilteredDevices(filtered);
    }
    const shownPositions = filterMap
      ? filtered.map((device) => positions[device.id]).filter(Boolean)
      : Object.values(positions);
    if (!sameItems(lastPositionsRef.current, shownPositions)) {
      lastPositionsRef.current = shownPositions;
      setFilteredPositions(shownPositions);
    }
  }, [
    keyword,
    filter,
    filterSort,
    filterMap,
    groups,
    devices,
    drivers,
    positions,
    setFilteredDevices,
    setFilteredPositions,
  ]);
};
