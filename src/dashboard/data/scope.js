// Which vehicles the filter row covers. Group filters include subgroups. Pure.

const childGroups = (groups, ids) => {
  const result = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    Object.values(groups).forEach((group) => {
      if (group.groupId && result.has(group.groupId) && !result.has(group.id)) {
        result.add(group.id);
        grew = true;
      }
    });
  }
  return result;
};

export const scopeDeviceIds = (devices, groups, groupIds = []) => {
  const all = Object.values(devices);
  if (!groupIds.length) {
    return all.map((device) => device.id).sort((a, b) => a - b);
  }
  const wanted = childGroups(groups, groupIds);
  return all
    .filter((device) => wanted.has(device.groupId))
    .map((device) => device.id)
    .sort((a, b) => a - b);
};

// Short stable key for a set of ids (cache keys).
export const scopeKey = (ids) => {
  let hash = 5381;
  ids.forEach((id) => {
    const text = `${id},`;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
    }
  });
  return `${ids.length}:${(hash >>> 0).toString(36)}`;
};

// REP-05: the vehicles a driver had during the period, by their assignment history
// ({ traccarDeviceId, start, end } with end null while open). Pure.
export const driverDeviceIds = (assignments, range) => {
  const from = range.from.valueOf();
  const to = range.to.valueOf();
  const ids = new Set();
  (assignments || []).forEach((row) => {
    if (!row.traccarDeviceId) return;
    const start = Date.parse(row.start);
    const end = row.end ? Date.parse(row.end) : Infinity;
    if (start < to && end > from) ids.add(row.traccarDeviceId);
  });
  return ids;
};
