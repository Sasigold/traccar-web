import { useState } from 'react';

import { Button, TextField, Typography } from '@mui/material';
import { useTranslation, useTranslationKeys } from '../common/components/LocalizationProvider';
import EditItemView from './components/EditItemView';
import { prefixString, unprefixString } from '../common/util/stringUtils';
import SelectField from '../common/components/SelectField';
import SettingsMenu from './components/SettingsMenu';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import CheckboxField from './components/CheckboxField';

const NotificationPage = () => {
  const t = useTranslation();

  const [item, setItem] = useState();

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
