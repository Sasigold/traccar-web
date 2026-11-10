import { useState } from 'react';

import { Autocomplete, Button, TextField, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { useTranslation, useTranslationKeys } from '../common/components/LocalizationProvider';
import EditItemView from './components/EditItemView';
import { prefixString, unprefixString } from '../common/util/stringUtils';
import SelectField from '../common/components/SelectField';
import SettingsMenu from './components/SettingsMenu';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import CheckboxField from './components/CheckboxField';
import { useAsyncTask, useCatch } from '../reactHelper';
import {
  TARGETS_LIMIT,
  loadTargets,
  permissionBodies,
  targetChanges,
} from './common/notificationTargets';

const NotificationPage = () => {
  const t = useTranslation();

  const [item, setItem] = useState();
  const devices = useSelector((state) => state.devices.items);
  const deviceList = Object.values(devices).sort((a, b) => a.name.localeCompare(b.name));
  const manageable = deviceList.length <= TARGETS_LIMIT;
  // ADM-25: the vehicles it applies to, in this form (not only on the connections screens).
  const [linked, setLinked] = useState(null);
  const [targets, setTargets] = useState(null);

  const notificationId = item?.id;
  const loaded = Boolean(item);
  const deviceKey = Object.keys(devices).join(',');
  useAsyncTask(
    async ({ signal }) => {
      if (!loaded) return;
      if (!notificationId || !manageable) {
        setLinked(notificationId ? null : []);
        return;
      }
      const ids = await loadTargets(
        notificationId,
        deviceKey ? deviceKey.split(',').map(Number) : [],
        async (deviceId) =>
          (await fetchOrThrow(`api/notifications?deviceId=${deviceId}`, { signal })).json(),
      );
      setLinked(ids);
    },
    [notificationId, loaded, manageable, deviceKey],
  );

  const saveTargets = async (saved) => {
    if (saved.always || !linked || !targets) return;
    const { add, remove } = permissionBodies(saved.id, targetChanges(linked, targets));
    await Promise.all([
      ...add.map((body) =>
        fetchOrThrow('api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      ),
      ...remove.map((body) =>
        fetchOrThrow('api/permissions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      ),
    ]);
  };
  const chosen = targets ?? linked ?? [];

  const alarms = useTranslationKeys((it) => it.startsWith('alarm')).map((it) => ({
    key: unprefixString('alarm', it),
    name: t(it),
  }));

  const testNotificators = useCatch(async () => {
    await Promise.all(
      item.notificators.split(/[, ]+/).map(async (notificator) => {
        await fetchOrThrow(`api/notifications/test/${notificator}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      }),
    );
  });

  const validate = () =>
    item &&
    item.type &&
    item.notificators &&
    (!item.notificators?.includes('command') || item.commandId);

  return (
    <EditItemView
      endpoint="notifications"
      item={item}
      setItem={setItem}
      validate={validate}
      onItemSaved={saveTargets}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedNotification']}
      description={t('notificationPageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            <SelectField
              value={item.type}
              onChange={(e) => setItem({ ...item, type: e.target.value })}
              endpoint="api/notifications/types"
              keyGetter={(it) => it.type}
              titleGetter={(it) => t(prefixString('event', it.type))}
              label={t('notificationTypeLabel')}
              helperText={
                ['geofenceEnter', 'geofenceExit', 'geofenceCrossed'].includes(item.type)
                  ? t('notificationGeofenceLabel')
                  : t('notificationTypeHelp')
              }
            />
            {item.type === 'alarm' && (
              <SelectField
                multiple
                value={
                  item.attributes && item.attributes.alarms
                    ? item.attributes.alarms.split(/[, ]+/)
                    : []
                }
                onChange={(e) =>
                  setItem({
                    ...item,
                    attributes: { ...item.attributes, alarms: e.target.value.join() },
                  })
                }
                data={alarms}
                keyGetter={(it) => it.key}
                label={t('sharedAlarms')}
                helperText={t('notificationAlarmsHelp')}
              />
            )}
            <SelectField
              multiple
              value={item.notificators ? item.notificators.split(/[, ]+/) : []}
              onChange={(e) => setItem({ ...item, notificators: e.target.value.join() })}
              endpoint="api/notifications/notificators"
              keyGetter={(it) => it.type}
              titleGetter={(it) => t(prefixString('notificator', it.type))}
              label={t('notificationChannelsLabel')}
              helperText={t('notificationChannelsHelp')}
            />
            {item.notificators?.includes('command') && (
              <SelectField
                value={item.commandId}
                onChange={(e) => setItem({ ...item, commandId: Number(e.target.value) })}
                endpoint="api/commands"
                titleGetter={(it) => it.description}
                label={t('sharedSavedCommand')}
                helperText={t('notificationCommandHelp')}
              />
            )}
            <CheckboxField
              checked={item.always}
              onChange={(e) => setItem({ ...item, always: e.target.checked })}
              label={t('notificationAlwaysLabel')}
              helperText={t('notificationAlwaysHelp')}
            />
            {!item.always && manageable && (
              <Autocomplete
                multiple
                size="small"
                loading={!linked}
                disabled={!linked}
                options={deviceList.map((device) => device.id)}
                getOptionLabel={(id) => devices[id]?.name || `#${id}`}
                value={chosen}
                onChange={(_, value) => setTargets(value)}
                slotProps={{ chip: { size: 'small' } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('notificationAppliesTo')}
                    helperText={t(
                      chosen.length ? 'notificationAppliesToHelp' : 'notificationAppliesToNone',
                    )}
                  />
                )}
              />
            )}
            {!item.always && !manageable && (
              <Typography variant="body2" color="textSecondary">
                {t('notificationAppliesToLarge')}
              </Typography>
            )}
            <div>
              <Button
                variant="outlined"
                color="primary"
                onClick={testNotificators}
                disabled={!item.notificators}
              >
                {t('sharedTestNotificators')}
              </Button>
              <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 0.5 }}>
                {t('notificationTestHelp')}
              </Typography>
            </div>
          </FormSection>
          <FormSection title={t('formSectionMore')}>
            <TextField
              value={item.description || ''}
              onChange={(e) => setItem({ ...item, description: e.target.value })}
              label={t('sharedDescription')}
              helperText={t('notificationDescriptionHelp')}
            />
            <SelectField
              value={item.calendarId}
              onChange={(e) => setItem({ ...item, calendarId: Number(e.target.value) })}
              endpoint="api/calendars"
              label={t('sharedCalendar')}
              helperText={t('notificationCalendarHelp')}
            />
            {['geofenceEnter', 'geofenceExit', 'geofenceCrossed'].includes(item.type) && (
              <SelectField
                multiple
                value={item.attributes?.geofenceIds ? item.attributes.geofenceIds.split(',') : []}
                onChange={(e) => {
                  const geofenceIds = e.target.value.join();
                  const attributes = { ...item.attributes };
                  if (geofenceIds) {
                    attributes.geofenceIds = geofenceIds;
                  } else {
                    delete attributes.geofenceIds;
                  }
                  setItem({ ...item, attributes });
                }}
                endpoint="api/geofences"
                keyGetter={(it) => String(it.id)}
                label={t('sharedGeofences')}
                helperText={t('notificationGeofencesHelp')}
              />
            )}
            <CheckboxField
              checked={item.attributes?.priority}
              onChange={(e) =>
                setItem({
                  ...item,
                  attributes: { ...item.attributes, priority: e.target.checked },
                })
              }
              label={t('notificationPriorityLabel')}
              helperText={t('notificationPriorityHelp')}
            />
          </FormSection>
        </>
      )}
    </EditItemView>
  );
};

export default NotificationPage;
