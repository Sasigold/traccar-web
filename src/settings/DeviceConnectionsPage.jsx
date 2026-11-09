import { useParams } from 'react-router-dom';

import LinkField from '../common/components/LinkField';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { formatNotificationTitle } from '../common/util/formatter';
import useFeatures from '../common/util/useFeatures';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';

const DeviceConnectionsPage = () => {
  const t = useTranslation();

  const { id } = useParams();

  const features = useFeatures();

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedDevice', 'sharedConnections']}
      description={t('connectionsDeviceDescription')}
    >
      <FormSection title={t('sharedConnections')} description={t('connectionsHint')}>
        <LinkField
          endpointAll="api/devices"
          endpointLinked={`api/devices?deviceId=${id}`}
          baseId={id}
          keyBase="deviceId"
          keyLink="linkedDeviceId"
          label={t('deviceTitle')}
          helperText={t('connectionsDevicesHelp')}
        />
        <LinkField
          endpointAll="api/geofences"
          endpointLinked={`api/geofences?deviceId=${id}`}
          baseId={id}
          keyBase="deviceId"
          keyLink="geofenceId"
          label={t('sharedGeofences')}
          helperText={t('connectionsGeofencesHelp')}
        />
        <LinkField
          endpointAll="api/notifications"
          endpointLinked={`api/notifications?deviceId=${id}`}
          baseId={id}
          keyBase="deviceId"
          keyLink="notificationId"
          titleGetter={(it) => formatNotificationTitle(t, it)}
          label={t('notificationRules')}
          helperText={t('connectionsNotificationsHelp')}
        />
        {!features.disableDrivers && (
          <LinkField
            endpointAll="api/drivers"
            endpointLinked={`api/drivers?deviceId=${id}`}
            baseId={id}
            keyBase="deviceId"
            keyLink="driverId"
            titleGetter={(it) => `${it.name} (${it.uniqueId})`}
            label={t('sharedDrivers')}
            helperText={t('connectionsDriversHelp')}
          />
        )}
        {!features.disableComputedAttributes && (
          <LinkField
            endpointAll="api/attributes/computed"
            endpointLinked={`api/attributes/computed?deviceId=${id}`}
            baseId={id}
            keyBase="deviceId"
            keyLink="attributeId"
            titleGetter={(it) => it.description}
            label={t('sharedComputedAttributes')}
            helperText={t('connectionsComputedHelp')}
          />
        )}
        {!features.disableSavedCommands && (
          <LinkField
            endpointAll="api/commands"
            endpointLinked={`api/commands?deviceId=${id}`}
            baseId={id}
            keyBase="deviceId"
            keyLink="commandId"
            titleGetter={(it) => it.description}
            label={t('sharedSavedCommands')}
            helperText={t('connectionsCommandsHelp')}
          />
        )}
        {!features.disableMaintenance && (
          <LinkField
            endpointAll="api/maintenance"
            endpointLinked={`api/maintenance?deviceId=${id}`}
            baseId={id}
            keyBase="deviceId"
            keyLink="maintenanceId"
            label={t('sharedMaintenance')}
            helperText={t('connectionsMaintenanceHelp')}
          />
        )}
      </FormSection>
    </FormPage>
  );
};

export default DeviceConnectionsPage;
