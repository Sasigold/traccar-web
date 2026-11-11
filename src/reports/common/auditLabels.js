// REP-22: the audit log's values in the user's language, and where each record is edited.

const ACTIONS = {
  create: 'auditActionCreate',
  edit: 'sharedEdit',
  remove: 'sharedRemove',
  link: 'auditActionLink',
  unlink: 'auditActionUnlink',
  login: 'loginLogin',
  logout: 'loginLogout',
  accumulators: 'sharedDeviceAccumulators',
  command: 'auditActionCommand',
};

const OBJECTS = {
  device: ['sharedDevice', 'device'],
  user: ['settingsUser', 'user'],
  group: ['groupDialog', 'group'],
  geofence: ['sharedGeofence', 'geofence'],
  notification: ['sharedNotification', 'notification'],
  calendar: ['sharedCalendar', 'calendar'],
  attribute: ['sharedComputedAttribute', 'attribute'],
  driver: ['sharedDriver', 'driver'],
  maintenance: ['sharedMaintenance', 'maintenance'],
  command: ['sharedSavedCommand', 'command'],
  server: ['settingsServer', null],
};

const lower = (value) => String(value ?? '').toLowerCase();

export const auditAction = (value, t) => (ACTIONS[lower(value)] ? t(ACTIONS[lower(value)]) : value);

export const auditObject = (value, t) => {
  const entry = OBJECTS[lower(value)];
  return entry ? t(entry[0]) : value;
};

// The settings page of the record, or null when it has none (or no id).
export const auditPath = (objectType, objectId) => {
  const page = OBJECTS[lower(objectType)]?.[1];
  return page && objectId ? `/settings/${page}/${objectId}` : null;
};
