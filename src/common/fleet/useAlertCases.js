import { useMemo } from 'react';
import { useFleetQuery } from '../data/fleetQuery';
import { useFleetPermission, useFleetReady } from './useFleet';
import { useFleetFeature } from './features';
import { DEFAULT_SLA_MINUTES } from './alertCases';

// LIV-24: the cases of recent alerts, the organization's response target and who can take them.
export const useAlertCaseAccess = () => {
  const ready = useFleetReady();
  const canRead = useFleetPermission('alerts.read');
  const enabled = useFleetFeature('alertCases');
  return ready && canRead && enabled;
};

export const useAlertCases = (days = 7, enabled = true) => {
  const since = useMemo(() => {
    const date = new Date(Date.now() - days * 86400000);
    date.setMinutes(0, 0, 0);
    return date.toISOString();
  }, [days]);
  const { data: cases } = useFleetQuery(
    'alert_cases',
    [since],
    (client) =>
      client.from('alert_cases').select('*').gte('occurred_at', since).order('occurred_at', {
        ascending: false,
      }),
    { enabled },
  );
  const { data: settings } = useFleetQuery(
    'org_alert_settings',
    [],
    (client) => client.from('org_alert_settings').select('sla_minutes').maybeSingle(),
    { enabled },
  );
  const { data: people } = useFleetQuery(
    'profiles',
    ['alertPeople'],
    (client) => client.from('profiles').select('id, full_name').eq('is_active', true),
    { enabled },
  );
  const byEvent = useMemo(
    () => new Map((cases || []).map((item) => [Number(item.traccar_event_id), item])),
    [cases],
  );
  return {
    cases: cases || [],
    byEvent,
    slaMinutes: settings?.sla_minutes ?? DEFAULT_SLA_MINUTES,
    people: people || [],
  };
};
