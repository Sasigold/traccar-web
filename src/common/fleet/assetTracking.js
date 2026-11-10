// OPS-08: equipment and trailers without a wired tracker: a battery tracker that reports once a
// day, or a BLE tag that a vehicle's tracker picks up nearby (Teltonika and others report the
// beacons they see as position attributes). Pure, tested.

// A tag as one comparable string: a MAC address without separators, or "uuid:major:minor", or
// "namespace:instance" (Eddystone), lowercase.
export const normalizeTag = (value) => {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  if (!text) return '';
  if (/^([0-9a-f]{2}[:-]?){5}[0-9a-f]{2}$/.test(text)) return text.replace(/[:-]/g, '');
  return text.replace(/\s+/g, '');
};

// The tags a position's tracker saw: beacon<N><Field> attributes grouped by N, and plain
// tag/bleTag/beacon attributes.
export const beaconsOf = (position) => {
  const attributes = position?.attributes || {};
  const groups = {};
  const plain = [];
  Object.entries(attributes).forEach(([key, value]) => {
    const match =
      /^(?:beacon|tag|ble)(\d+)(uuid|major|minor|namespace|instance|mac|id|address)$/i.exec(key);
    if (match) {
      const group = (groups[match[1]] = groups[match[1]] || {});
      group[match[2].toLowerCase()] = value;
    } else if (/^(tag|bletag|beacon|beaconid)$/i.test(key) && value != null && value !== '') {
      plain.push(value);
    }
  });
  const ids = Object.values(groups).map((group) => {
    if (group.mac || group.address || group.id) return group.mac || group.address || group.id;
    if (group.uuid)
      return [group.uuid, group.major, group.minor].filter((v) => v != null).join(':');
    if (group.namespace)
      return [group.namespace, group.instance].filter((v) => v != null).join(':');
    return null;
  });
  return [...new Set([...ids, ...plain].map(normalizeTag).filter(Boolean))];
};

// The latest position whose tracker saw the tag: { deviceId, position, time } or null.
export const whereIsTag = (tag, positions) => {
  const wanted = normalizeTag(tag);
  if (!wanted) return null;
  let found = null;
  Object.values(positions || {}).forEach((position) => {
    if (!beaconsOf(position).includes(wanted)) return;
    const time = new Date(position.fixTime || position.deviceTime || 0).getTime();
    if (!found || time > found.time) found = { deviceId: position.deviceId, position, time };
  });
  return found;
};

// A battery tracker is late only after twice its interval (default a day), not after minutes.
export const reportState = (lastUpdate, intervalHours, now = Date.now()) => {
  if (!lastUpdate) return 'never';
  const interval = (Number(intervalHours) > 0 ? Number(intervalHours) : 24) * 3600 * 1000;
  return now - new Date(lastUpdate).getTime() > 2 * interval ? 'late' : 'ok';
};
