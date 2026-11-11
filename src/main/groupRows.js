// LIV-22: the vehicle list by group: a header per group (name, count, how many online and
// offline) above its vehicles, groups by name and vehicles without a group last. A collapsed
// group keeps its header only. Pure, tested.

export const NO_GROUP = 0;

export const sortByGroup = (devices, groups) =>
  [...devices].sort((a, b) => {
    const ga = groups[a.groupId]?.name;
    const gb = groups[b.groupId]?.name;
    if (ga && !gb) return -1;
    if (!ga && gb) return 1;
    return (ga || '').localeCompare(gb || '') || a.name.localeCompare(b.name);
  });

// devices: already sorted by group. Rows: { type: 'group', ... } or { type: 'device', index }
// (index into devices, so a row can still find its vehicle).
export const groupRows = (devices, groups, collapsed = []) => {
  const rows = [];
  let header = null;
  devices.forEach((device, index) => {
    const groupId = groups[device.groupId] ? device.groupId : NO_GROUP;
    if (!header || header.groupId !== groupId) {
      header = {
        type: 'group',
        groupId,
        name: groups[groupId]?.name || null,
        count: 0,
        online: 0,
        offline: 0,
        collapsed: collapsed.includes(groupId),
      };
      rows.push(header);
    }
    header.count += 1;
    if (device.status === 'online') header.online += 1;
    if (device.status === 'offline') header.offline += 1;
    if (!header.collapsed) rows.push({ type: 'device', index });
  });
  return rows;
};

// The list row of a vehicle (for scrolling to it), or -1 when its group is collapsed.
export const rowOfDevice = (rows, index) =>
  rows.findIndex((row) => row.type === 'device' && row.index === index);
