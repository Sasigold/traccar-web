import { Alert, Button } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useFleetError } from '../../common/fleet/useFleet';
import { useAdminAccess, useFleetReconnect } from '../useAdmin';

const useStyles = makeStyles()((theme) => ({
  alert: {
    margin: theme.spacing(0.5, 3, 2),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(1, 2, 2),
    },
  },
}));

// Explains why the customer / billing parts are unavailable and offers to
// reconnect. Renders nothing when `need` is satisfied.
const AdminGate = ({ need = 'customersRead', className }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const access = useAdminAccess();
  const error = useFleetError();
  const reconnect = useFleetReconnect();

  if (access[need]) {
    return null;
  }

  let message;
  if (access.fleetStatus === 'disabled') {
    message = t('adminFleetDisabled');
  } else if (access.fleetStatus === 'error') {
    message = t('fleetConnectionError').replace('{0}', error || '');
  } else if (access.fleetStatus === 'loading' || access.fleetStatus === 'idle') {
    message = t('adminFleetConnecting');
  } else {
    message = t(
      need.startsWith('billing') ? 'adminNoBillingPermission' : 'adminNoCustomerPermission',
    );
  }

  return (
    <Alert
      severity={access.fleetStatus === 'loading' ? 'info' : 'warning'}
      className={cx(classes.alert, className)}
      action={
        access.fleetStatus !== 'disabled' && access.fleetStatus !== 'loading' ? (
          <Button color="inherit" size="small" onClick={reconnect}>
            {t('adminReconnect')}
          </Button>
        ) : null
      }
    >
      {message}
    </Alert>
  );
};

export default AdminGate;
