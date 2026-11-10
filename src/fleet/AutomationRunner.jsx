import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import { getFleetClient } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { useFleetFeature } from '../common/fleet/features';
import { TEMPLATES, matches } from '../common/fleet/automations';
import { messagesActions } from '../store';
import { useFleetRows } from './stage5Data';

const FRESH = 10 * 60000;

// AI-05: the active rules applied to live events while the app is open: a notice on screen and a
// run in the log (once per rule and event, also across open tabs).
const AutomationRunner = () => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('alerts.read');
  const enabled = useFleetFeature('automations') && canRead && Boolean(profile);
  const rules = useFleetRows('automation_rules', { enabled });
  const events = useSelector((state) => state.events.items);
  const devices = useSelector((state) => state.devices.items);
  const handledRef = useRef(new Set());

  useEffect(() => {
    const active = (rules || []).filter(
      (rule) => rule.active && TEMPLATES[rule.template]?.source === 'events',
    );
    if (!active.length) return;
    events.forEach((event) => {
      if (event.id == null || Date.now() - Date.parse(event.eventTime) > FRESH) return;
      active.forEach((rule) => {
        const key = `${rule.id}:${event.id}`;
        if (handledRef.current.has(key) || !matches(rule, event)) return;
        handledRef.current.add(key);
        getFleetClient()
          .from('automation_runs')
          .insert({
            org_id: profile.org_id,
            rule_id: rule.id,
            traccar_event_id: event.id,
            traccar_device_id: event.deviceId,
            actions_done: ['notify'],
          })
          .then(({ error }) => {
            // Another tab ran it first: nothing to show twice.
            if (error) return;
            dispatch(
              messagesActions.push({
                message: t('autoFired')
                  .replace('{0}', rule.name)
                  .replace('{1}', devices[event.deviceId]?.name || ''),
                severity: 'info',
              }),
            );
          });
      });
    });
  }, [events, rules, devices, profile, dispatch, t]);

  return null;
};

export default AutomationRunner;
