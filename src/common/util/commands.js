// Commands that stop a vehicle or cut its power. Sending one needs the plate number typed out,
// and a warning when the vehicle is moving.
const DANGEROUS = new Set(['engineStop']);

// The quick commands offered as large buttons in the vehicle card's dialog, when the device
// supports them.
export const QUICK_COMMANDS = ['positionSingle', 'engineStop', 'engineResume'];

export const isDangerousCommand = (type) => DANGEROUS.has(type);

// What the user types to confirm: the plate number, or the vehicle's name when it has none.
export const confirmationTarget = (device) => {
  const plate = device?.attributes?.plateNumber?.trim();
  if (plate) {
    return { kind: 'plate', value: plate };
  }
  return { kind: 'name', value: device?.name?.trim() || '' };
};

// Spaces, dashes and dots do not count, nor letter case: "1234567" confirms "12-345-67".
const normalize = (value) =>
  (value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();

export const confirmationMatches = (input, target) => {
  const expected = normalize(target);
  return expected.length > 0 && normalize(input) === expected;
};

// Command status on the card fades out half an hour after the last change.
export const COMMAND_STATUS_TTL_MS = 30 * 60 * 1000;

export const commandStatusVisible = (item, now) =>
  Boolean(item) && now - (item.answeredAt || item.sentAt) < COMMAND_STATUS_TTL_MS;
