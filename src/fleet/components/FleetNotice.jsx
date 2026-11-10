import { useEffect, useState } from 'react';
import { Alert, Button, LinearProgress, Typography } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import EmptyState from '../../common/components/table/EmptyState';
import { useFleetPermission, useFleetStatus } from '../../common/fleet/useFleet';
import { planAllows, requiredPlan, useOrgPlan } from '../../common/fleet/plans';
import useFleetReconnect from '../../common/fleet/useFleetReconnect';
import { useOrgContact } from './DispatcherContact';

// ADM-21: the area a permission opens, in words (never the permission key itself).
const AREAS = [
  'alerts',
  'costs',
  'dispatch',
  'incidents',
  'inspections',
  'integrations',
  'maintenance',
  'poi',
  'privacy',
  'safety',
  'users',
  'vehicles',
];
export const areaKey = (permission) => {
  const area = String(permission || '').split('.')[0];
  return AREAS.includes(area) ? `fleetArea${area[0].toUpperCase()}${area.slice(1)}` : null;
};

// ADM-21: one component for the state of the fleet services on a page: connecting, failed (with
// "try again"), not in the plan, or no access. When the page cannot be used, the class
// `vf-blocked` hides what follows it (public/styles.css): no empty table, toolbar or export.
const FleetNotice = ({ permission, compact = false }) => {
  const t = useTranslation();
  const status = useFleetStatus();
  const allowed = useFleetPermission(permission);
  const plan = useOrgPlan();
  const contact = useOrgContact();
  const reconnect = useFleetReconnect();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await reconnect();
    } finally {
      setBusy(false);
    }
  };
  // The connection is retried by FleetController after 5, 15 and 60 seconds; this says so.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== 'loading') return undefined;
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [status]);

  const margins = compact ? { m: 0 } : { mx: 3, mb: 2 };
  const alertProps = compact
    ? { variant: 'outlined', sx: { m: 0, py: 0.25, fontSize: '0.8125rem' } }
    : { sx: margins };
  const area = areaKey(permission);

  if (status === 'loading' || status === 'idle') {
    return compact ? null : (
      <div role="status" aria-label={t('fleetConnecting')} style={{ marginInline: 24 }}>
        <LinearProgress />
        {slow && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {t('fleetConnecting')}
          </Typography>
        )}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <Alert
        severity="warning"
        {...alertProps}
        action={
          <Button color="inherit" size="small" onClick={retry} loading={busy}>
            {t('fleetRetry')}
          </Button>
        }
      >
        {t('fleetUnavailable')}
      </Alert>
    );
  }
  if (status === 'disabled') {
    return (
      <Alert severity="info" {...alertProps}>
        {t('fleetDatabaseDisabled')}
      </Alert>
    );
  }
  // BIZ-02: an area outside the plan says which plan has it, instead of disappearing.
  if (status === 'ready' && !planAllows(plan, permission)) {
    const needed = requiredPlan(permission);
    const text = t('planAvailableIn').replace(
      '{0}',
      t(`plan${needed[0].toUpperCase()}${needed.slice(1)}`),
    );
    return compact ? (
      <Alert severity="info" {...alertProps}>
        {text}
      </Alert>
    ) : (
      <div className="vf-blocked">
        <EmptyState icon={<WorkspacePremiumRoundedIcon />} title={text} />
      </div>
    );
  }
  if (status === 'ready' && !allowed) {
    const title = area ? t('fleetNoAccessTo').replace('{0}', t(area)) : t('fleetNoAccessHere');
    const ask = contact?.name
      ? t('fleetAskAccessFrom').replace('{0}', contact.name)
      : t('fleetAskAccess');
    return compact ? (
      <Alert severity="info" {...alertProps}>
        {title}
      </Alert>
    ) : (
      <div className="vf-blocked">
        <EmptyState
          icon={<LockRoundedIcon />}
          title={title}
          description={ask}
          action={
            <Button variant="outlined" onClick={retry} loading={busy}>
              {t('fleetRefreshAccess')}
            </Button>
          }
        />
      </div>
    );
  }
  return null;
};

export default FleetNotice;
