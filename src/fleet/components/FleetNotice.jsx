import { Alert } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useFleetError, useFleetPermission, useFleetStatus } from '../../common/fleet/useFleet';
import { planAllows, requiredPlan, useOrgPlan } from '../../common/fleet/plans';

// Why a fleet database page is empty: not connected, connection failed, or no permission.
const FleetNotice = ({ permission, compact = false }) => {
  const t = useTranslation();
  const status = useFleetStatus();
  const error = useFleetError();
  const allowed = useFleetPermission(permission);
  const plan = useOrgPlan();
  // Inside a dashboard widget: no page margins, a quieter outlined alert.
  const props = compact
    ? { variant: 'outlined', sx: { m: 0, py: 0.25, fontSize: '0.8125rem' } }
    : { sx: { mx: 3, mb: 2 } };
  if (status === 'error') {
    return (
      <Alert severity="warning" {...props}>
        {t('fleetConnectionError').replace('{0}', error || '')}
      </Alert>
    );
  }
  if (status === 'disabled') {
    return (
      <Alert severity="info" {...props}>
        {t('fleetDatabaseDisabled')}
      </Alert>
    );
  }
  // BIZ-02: an area outside the plan says which plan has it, instead of disappearing.
  if (status === 'ready' && !planAllows(plan, permission)) {
    const needed = requiredPlan(permission);
    return (
      <Alert severity="info" {...props}>
        {t('planAvailableIn').replace('{0}', t(`plan${needed[0].toUpperCase()}${needed.slice(1)}`))}
      </Alert>
    );
  }
  if (status === 'ready' && !allowed) {
    return (
      <Alert severity="info" {...props}>
        {t('fleetNoAccess')}
      </Alert>
    );
  }
  return null;
};

export default FleetNotice;
