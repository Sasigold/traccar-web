import { useParams } from 'react-router-dom';

import LinkField from '../common/components/LinkField';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { formatNotificationTitle } from '../common/util/formatter';
import useFeatures from '../common/util/useFeatures';
import FormSection from './components/FormSection';
import FormPage from './components/FormPage';

const GroupConnectionsPage = () => {
  const t = useTranslation();

  const { id } = useParams();

  const features = useFeatures();

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'groupDialog', 'sharedConnections']}
    >
      <FormSection title={t('sharedConnections')}>
        <LinkField
          endpointAll="api/geofences"
          endpointLinked={`api/geofences?groupId=${id}`}
          baseId={id}
          keyBase="groupId"
          keyLink="geofenceId"
          label={t('sharedGeofences')}
        />
        <LinkField
          endpointAll="api/notifications"
          endpointLinked={`api/notifications?groupId=${id}`}
          baseId={id}
          keyBase="groupId"
          keyLink="notificationId"
          titleGetter={(it) => formatNotificationTitle(t, it)}
          label={t('sharedNotifications')}
        />
        {!features.disableDrivers && (
          <LinkField
            endpointAll="api/drivers"
            endpointLinked={`api/drivers?groupId=${id}`}
            baseId={id}
            keyBase="groupId"
            keyLink="driverId"
            titleGetter={(it) => `${it.name} (${it.uniqueId})`}
            label={t('sharedDrivers')}
          />
        )}
        {!features.disableComputedAttributes && (
          <LinkField
            endpointAll="api/attributes/computed"
            endpointLinked={`api/attributes/computed?groupId=${id}`}
            baseId={id}
            keyBase="groupId"
            keyLink="attributeId"
            titleGetter={(it) => it.description}
            label={t('sharedComputedAttributes')}
          />
        )}
        {!features.disableSavedCommands && (
          <LinkField
            endpointAll="api/commands"
            endpointLinked={`api/commands?groupId=${id}`}
            baseId={id}
            keyBase="groupId"
            keyLink="commandId"
            titleGetter={(it) => it.description}
            label={t('sharedSavedCommands')}
          />
        )}
        {!features.disableMaintenance && (
          <LinkField
            endpointAll="api/maintenance"
            endpointLinked={`api/maintenance?groupId=${id}`}
            baseId={id}
            keyBase="groupId"
            keyLink="maintenanceId"
            label={t('sharedMaintenance')}
          />
        )}
      </FormSection>
    </FormPage>
  );
};

export default GroupConnectionsPage;
