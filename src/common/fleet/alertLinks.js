// LIV-24: where an alert leads on from the alert center: the safety inbox for driving
// behavior (SAF-01), and an automation rule of the same kind (AI-05). Pure, tested.

const SAFETY_ALARMS = [
  'hardBraking',
  'hardAcceleration',
  'hardCornering',
  'accident',
  'fatigueDriving',
  'laneChange',
  'tampering',
];

export const isSafetyAlert = (event) =>
  event?.type === 'deviceOverspeed' ||
  (event?.type === 'alarm' &&
    String(event.attributes?.alarm || '')
      .split(',')
      .some((alarm) => SAFETY_ALARMS.includes(alarm.trim())));

// The automation template that fires on this kind of alert, with its parameters, or null.
export const ruleFromAlert = (event) => {
  if (event?.type === 'deviceOverspeed') {
    const knots = Number(event.attributes?.speed);
    const speed = Number.isFinite(knots) && knots > 0 ? Math.round(knots * 1.852) : 110;
    return { template: 'overspeed', params: { speed } };
  }
  if (event?.type === 'geofenceEnter' && event.geofenceId) {
    return { template: 'geofenceEnter', params: { geofenceId: event.geofenceId } };
  }
  return null;
};

export const ruleLink = (rule) =>
  rule
    ? `/fleet/automations?${new URLSearchParams({
        template: rule.template,
        params: JSON.stringify(rule.params),
      })}`
    : null;
