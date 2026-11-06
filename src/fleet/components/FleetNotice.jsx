import { Alert } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useFleetError, useFleetPermission, useFleetStatus } from '../../common/fleet/useFleet';

// Why a fleet database page is empty: not connected, connection failed, or no permission.
const FleetNotice = ({ permission }) => {
  const t = useTranslation();
  const status = useFleetStatus();
  const error = useFleetError();
  const allowed = useFleetPermission(permission);
  if (status === 'error') {
    return (
      <Alert severity="warning" sx={{ mx: 3, mb: 2 }}>
        {t('fleetConnectionError').replace('{0}', error || '')}
      </Alert>
    );
  }
  if (status === 'disabled') {
    return (
      <Alert severity="info" sx={{ mx: 3, mb: 2 }}>
        {t('fleetDatabaseDisabled')}
      </Alert>
    );
  }
  if (status === 'ready' && !allowed) {
    return (
      <Alert severity="info" sx={{ mx: 3, mb: 2 }}>
        {t('fleetNoAccess')}
      </Alert>
    );
  }
  return null;
};

export default FleetNotice;
