// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { deviceSearchFields, matchDevice, tokenizeSearch } from '../../util/deviceSearch';

// REP-05: the rows of the vehicle picker. Pure, unit-tested.
//
// Each group is a heading followed by its vehicles (by the vehicle's own group); vehicles without
// a group come last under "no group". A search keeps the vehicles that match by name, plate,
// identifier or driver, and every vehicle of a group whose name matches.
export const NO_GROUP = 0;

export const pickerRows = (devices, groups, query = '', { drivers = {}, positions = {} } = {}) => {
  const tokens = tokenizeSearch(query);
  const byGroup = new Map();
  Object.values(devices)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((device) => {
      const groupId = groups[device.groupId] ? device.groupId : NO_GROUP;
      if (!byGroup.has(groupId)) byGroup.set(groupId, []);
      byGroup.get(groupId).push(device);
    });
  const groupIds = [...byGroup.keys()].sort((a, b) => {
    if (a === NO_GROUP) return 1;
    if (b === NO_GROUP) return -1;
    return groups[a].name.localeCompare(groups[b].name);
  });
  const rows = [];
  groupIds.forEach((groupId) => {
    const members = byGroup.get(groupId);
    const groupMatches =
      groupId !== NO_GROUP &&
      tokens.length > 0 &&
      matchDevice(tokens, [{ key: 'group', value: groups[groupId].name, weight: 1 }]);
    const shown =
      !tokens.length || groupMatches
        ? members
        : members.filter((device) =>
            matchDevice(
              tokens,
              deviceSearchFields(device, { groups, drivers, position: positions[device.id] }),
            ),
          );
    if (!shown.length) return;
    rows.push({
      type: 'group',
      id: groupId,
      name: groupId === NO_GROUP ? null : groups[groupId].name,
      deviceIds: members.map((device) => device.id),
    });
    shown.forEach((device) =>
      rows.push({
        type: 'device',
        id: device.id,
        groupId,
        name: device.name,
        plate: device.attributes?.plateNumber || null,
      }),
    );
  });
  return rows;
};

// The vehicles a selection covers: chosen vehicles plus every vehicle of the chosen groups.
export const coveredDevices = (devices, { deviceIds = [], groupIds = [] }) => {
  if (deviceIds.includes('all')) {
    return new Set(Object.keys(devices).map(Number));
  }
  const covered = new Set(deviceIds.map(Number));
  Object.values(devices).forEach((device) => {
    if (groupIds.includes(device.groupId)) covered.add(device.id);
  });
  return covered;
};

// Ticking or unticking one vehicle. A vehicle in a chosen group: the group becomes its vehicles
// minus this one ("all of north except two").
export const toggleDevice = (devices, selection, deviceId) => {
  const groupIds = selection.groupIds || [];
  const deviceIds = (selection.deviceIds || []).filter((id) => id !== 'all');
  const device = devices[deviceId];
  if (groupIds.includes(device?.groupId)) {
    const members = Object.values(devices)
      .filter((item) => item.groupId === device.groupId && item.id !== deviceId)
      .map((item) => item.id);
    return {
      groupIds: groupIds.filter((id) => id !== device.groupId),
      deviceIds: [...new Set([...deviceIds, ...members])],
    };
  }
  return {
    groupIds,
    deviceIds: deviceIds.includes(deviceId)
      ? deviceIds.filter((id) => id !== deviceId)
      : [...deviceIds, deviceId],
  };
};

// Ticking a group heading chooses the whole group (its vehicles chosen one by one go away).
export const toggleGroup = (devices, selection, groupId) => {
  const groupIds = selection.groupIds || [];
  const deviceIds = (selection.deviceIds || []).filter((id) => id !== 'all');
  if (groupIds.includes(groupId)) {
    return { groupIds: groupIds.filter((id) => id !== groupId), deviceIds };
  }
  const members = new Set(
    Object.values(devices)
      .filter((device) => device.groupId === groupId)
      .map((device) => device.id),
  );
  return {
    groupIds: [...groupIds, groupId],
    deviceIds: deviceIds.filter((id) => !members.has(id)),
  };
};
