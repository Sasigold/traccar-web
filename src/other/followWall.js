// LIV-28: which vehicles the follow wall shows. Pure, tested.
//
// By hand: the chosen ones that still exist. Rotating: the groups in name order, one per step,
// each showing its online vehicles first (at most `slots`); groups with no vehicles are skipped.
export const wallVehicles = ({ chosen, rotate, tick, devices, groups, slots = 4 }) => {
  if (!rotate) {
    return {
      ids: chosen
        .map(Number)
        .filter((id) => devices[id])
        .slice(0, slots),
      groupName: null,
    };
  }
  const withVehicles = Object.values(groups)
    .map((group) => ({
      group,
      members: Object.values(devices)
        .filter((device) => device.groupId === group.id)
        .sort(
          (a, b) =>
            Number(b.status === 'online') - Number(a.status === 'online') ||
            a.name.localeCompare(b.name),
        ),
    }))
    .filter((entry) => entry.members.length)
    .sort((a, b) => a.group.name.localeCompare(b.group.name));
  if (!withVehicles.length) {
    return { ids: [], groupName: null };
  }
  const current = withVehicles[tick % withVehicles.length];
  return {
    ids: current.members.slice(0, slots).map((device) => device.id),
    groupName: current.group.name,
  };
};
