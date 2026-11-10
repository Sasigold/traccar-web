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

// AI-01: an answer of the assistant as a rule ("turn into an alert"): from what the question
// asked and the data the answer was built on. Null when no rule fits. Pure, tested.
export const ruleFromAnswer = (calls = [], question = '') => {
  const text = String(question);
  if (/שבת|חג|shabbat|holiday/i.test(text)) {
    return { template: 'restDay', params: {} };
  }
  if (/לילה|אחרי השעות|מחוץ לשעות|after hours|at night/i.test(text)) {
    return { template: 'afterHours', params: {} };
  }
  const speed = /(\d{2,3})\s*(?:קמ"ש|קמ״ש|km\/?h)/i.exec(text);
  for (const call of [...calls].reverse()) {
    const types = call.input?.types || [];
    if (call.name === 'events' && types.includes('deviceOverspeed')) {
      return { template: 'overspeed', params: { speed: speed ? Number(speed[1]) : 110 } };
    }
    if (call.name === 'events' && types.includes('geofenceEnter')) {
      return { template: 'geofenceEnter', params: { geofenceId: null } };
    }
    if (call.name === 'events' && types.includes('alarm')) {
      return { template: 'criticalFault', params: {} };
    }
    if (call.name === 'stops') {
      const minutes = /(\d{1,3})\s*(?:דק|min)/i.exec(text);
      return { template: 'idling', params: { minutes: minutes ? Number(minutes[1]) : 15 } };
    }
  }
  return null;
};
