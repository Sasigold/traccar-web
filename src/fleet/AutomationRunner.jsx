import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import { getFleetClient } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { useFleetFeature } from '../common/fleet/features';
import {
  REPORT_POLL,
  REPORT_WINDOW,
  TEMPLATES,
  matches,
  runKey,
} from '../common/fleet/automations';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { messagesActions } from '../store';
import { useFleetRows } from './fleetRows';

const FRESH = 10 * 60000;

// AI-05: the active rules applied while the app is open: live events as they come, and trips and
// stops (after hours, idling) from the reports of the last half hour, every five minutes. Each
// fires once per rule and row (also across open tabs): a notice on screen and a run in the log.
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

  const fire = (rule, row) => {
    const key = `${rule.id}:${runKey(row)}`;
    if (handledRef.current.has(key) || !matches(rule, row)) return;
    handledRef.current.add(key);
    getFleetClient()
      .from('automation_runs')
      .insert({
        org_id: profile.org_id,
        rule_id: rule.id,
        traccar_event_id: runKey(row),
        traccar_device_id: row.deviceId,
        actions_done: ['notify'],
      })
      .then(({ error }) => {
        // Another tab ran it first: nothing to show twice.
        if (error) return;
        dispatch(
          messagesActions.push({
            message: t('autoFired')
              .replace('{0}', rule.name)
              .replace('{1}', devices[row.deviceId]?.name || ''),
            severity: 'info',
          }),
        );
      });
  };
  const fireRef = useRef(fire);
  fireRef.current = fire;

  useEffect(() => {
    const active = (rules || []).filter(
      (rule) => rule.active && TEMPLATES[rule.template]?.source === 'events',
    );
    if (!active.length) return;
    events.forEach((event) => {
      if (event.id == null || Date.now() - Date.parse(event.eventTime) > FRESH) return;
      active.forEach((rule) => fireRef.current(rule, event));
    });
  }, [events, rules]);

  const deviceKey = Object.keys(devices).join(',');
  useEffect(() => {
    const active = (rules || []).filter(
      (rule) => rule.active && ['trips', 'stops'].includes(TEMPLATES[rule.template]?.source),
    );
    if (!active.length || !deviceKey) return undefined;
    const controller = new AbortController();
    const poll = async () => {
      const to = new Date();
      const query = new URLSearchParams({
        from: new Date(to.getTime() - REPORT_WINDOW).toISOString(),
        to: to.toISOString(),
      });
      deviceKey.split(',').forEach((id) => query.append('deviceId', id));
      const sources = [...new Set(active.map((rule) => TEMPLATES[rule.template].source))];
      await Promise.all(
        sources.map(async (source) => {
          try {
            const response = await fetchOrThrow(`api/reports/${source}?${query}`, {
              headers: { Accept: 'application/json' },
              signal: controller.signal,
            });
            const rows = await response.json();
            active
              .filter((rule) => TEMPLATES[rule.template].source === source)
              .forEach((rule) => rows.forEach((row) => fireRef.current(rule, row)));
          } catch {
            // The next pass tries again.
          }
        }),
      );
    };
    poll();
    const timer = setInterval(poll, REPORT_POLL);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [rules, deviceKey]);

  return null;
};

export default AutomationRunner;
