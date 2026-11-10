import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { parseCheckin } from '../common/fleet/checkin';
import DriverDoneCard from './components/DriverDoneCard';

const useStyles = makeStyles()((theme) => ({
  root: {
    maxWidth: 480,
    margin: theme.spacing(2, 'auto'),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 2),
  },
  scanner: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  video: {
    borderRadius: theme.tokens.radius.lg,
    overflow: 'hidden',
  },
}));

// SAF-02: the driver scans the QR in the cabin (or opens its link) and the trips from now on are
// theirs. The code is checked in the database against the driver's own organization.
const DriverCheckInPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceId = Number(searchParams.get('d'));
  const code = searchParams.get('c');
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deviceId || !code) return;
    setError(null);
    getFleetClient()
      .rpc('driver_check_in', { p_device: deviceId, p_code: code })
      .then((result) => setDone({ ...unwrap(result), time: new Date() }))
      .catch(() => setError('driverCheckInFailed'));
  }, [deviceId, code]);

  return (
    <PageLayout breadcrumbs={['fleetDriverPortal']} title={t('driverCheckIn')}>
      <div className={classes.root}>
        {done ? (
          <DriverDoneCard titleKey="driverCheckInDone" time={done.time}>
            {done.plate_number && (
              <Typography variant="h6" component="p" dir="ltr">
                {done.plate_number}
              </Typography>
            )}
          </DriverDoneCard>
        ) : (
          <Paper elevation={0} className={classes.scanner}>
            {error && <Alert severity="error">{t(error)}</Alert>}
            <Typography>{t('driverCheckInHelp')}</Typography>
            <div className={classes.video}>
              <Scanner
                constraints={{ facingMode: 'environment' }}
                onScan={(codes) => {
                  const value = codes?.[0]?.rawValue || '';
                  const parsed = parseCheckin(value);
                  if (parsed) {
                    navigate(
                      `/driver/checkin?d=${parsed.deviceId}&c=${encodeURIComponent(parsed.code)}`,
                      {
                        replace: true,
                      },
                    );
                  } else if (value) {
                    setError('driverCheckInNotQr');
                  }
                }}
                onError={() => setError('driverCheckInCamera')}
              />
            </div>
            <Button onClick={() => navigate('/driver')}>{t('sharedCancel')}</Button>
          </Paper>
        )}
      </div>
    </PageLayout>
  );
};

export default DriverCheckInPage;
