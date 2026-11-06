// Roadmap stage 2: damage and accident helpers (pure, unit-tested).

export const INCIDENT_TYPES = ['accident', 'damage', 'theft', 'vandalism', 'glass', 'other'];
export const INCIDENT_SEVERITIES = ['minor', 'moderate', 'severe'];
export const INCIDENT_FAULTS = ['unknown', 'ours', 'theirs', 'shared'];
export const INCIDENT_STATUSES = ['reported', 'under_review', 'in_repair', 'claim', 'closed'];
export const PARTY_ROLES = ['third_party', 'witness', 'injured'];
export const CLAIM_STATUSES = ['draft', 'filed', 'approved', 'rejected', 'paid', 'closed'];

// Search window around the reported time when looking up the vehicle's position.
export const LOOKUP_MINUTES = 10;

const timeOf = (position) =>
  Date.parse(position.fixTime || position.deviceTime || position.serverTime);

// The position closest to `time` (ms), if one lies within LOOKUP_MINUTES.
export const nearestPosition = (positions, time) => {
  let best = null;
  let bestGap = LOOKUP_MINUTES * 60000;
  positions.forEach((position) => {
    const gap = Math.abs(timeOf(position) - time);
    if (gap <= bestGap) {
      best = position;
      bestGap = gap;
    }
  });
  return best;
};

// `YYYY-MM-DDTHH:mm` for <input type="datetime-local"> in local time, and back.
export const toLocalInput = (value) => {
  const date = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);
