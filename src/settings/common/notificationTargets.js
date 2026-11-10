// ADM-25: which vehicles a notification applies to, from inside the notification form.
// Traccar has no "devices of a notification" query, only "notifications of a device", so the
// current links are read per vehicle (a few at a time). Fleets above TARGETS_LIMIT keep using
// the connections screens.
export const TARGETS_LIMIT = 300;

export const targetChanges = (before, after) => ({
  add: after.filter((id) => !before.includes(id)),
  remove: before.filter((id) => !after.includes(id)),
});

export const loadTargets = async (notificationId, deviceIds, fetchNotifications, batch = 10) => {
  const linked = [];
  for (let start = 0; start < deviceIds.length; start += batch) {
    const ids = deviceIds.slice(start, start + batch);
    const results = await Promise.all(ids.map((id) => fetchNotifications(id)));
    results.forEach((notifications, index) => {
      if (notifications.some((notification) => notification.id === notificationId)) {
        linked.push(ids[index]);
      }
    });
  }
  return linked;
};

export const permissionBodies = (notificationId, { add, remove }) => ({
  add: add.map((deviceId) => ({ deviceId, notificationId })),
  remove: remove.map((deviceId) => ({ deviceId, notificationId })),
});
