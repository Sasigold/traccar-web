import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import { useAsyncTask } from '../reactHelper';
import { formatStatus, formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetLabel, useFleetProfile, useFleetStatus } from '../common/fleet/useFleet';
import { statusColor } from '../common/theme/surfaces';
import ExpiryBadge from './components/ExpiryBadge';
import FleetNotice from './components/FleetNotice';
import DriverJobsCard from './components/DriverJobsCard';
import DriverPrivacyCard from './components/DriverPrivacyCard';
import DriverSafetyCard from './components/DriverSafetyCard';
import { incidentKey } from './IncidentsPage';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 3, 4),
    maxWidth: 720,
    width: '100%',
    marginInline: 'auto',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 2, 4),
    },
  },
  card: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1.5),
  },
  action: {
    minHeight: 64,
    flexDirection: 'column',
    gap: 4,
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    paddingBlock: theme.spacing(0.75),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '&:last-of-type': {
      borderBottom: 'none',
    },
  },
}));

// Roadmap 4.6: the driver's own view, made for a phone. Data is limited by the database to
// the driver's vehicle and the driver's own reports.
const DriverPortalPage = () => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const label = useFleetLabel();
  const status = useFleetStatus();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  const profileId = profile?.id;
  const [data, setData] = useState(null);

  useAsyncTask(async () => {
    if (status !== 'ready' || !profileId) {
      return;
    }
    const client = getFleetClient();
    const driver = unwrap(
      await client
        .from('drivers')
        .select('id, full_name')
        .eq('profile_id', profileId)
        .maybeSingle(),
    );
    if (!driver) {
      setData({ driver: null });
      return;
    }
    const [assignment, documents, incidents, inspections] = await Promise.all([
      client.from('current_assignments').select('*').eq('driver_id', driver.id).limit(1),
      client.from('documents_expiring').select('*').eq('driver_id', driver.id).order('expires_at'),
      client
        .from('incidents')
        .select('id, number, occurred_at, type, status')
        .or(`reported_by.eq.${profileId},driver_id.eq.${driver.id}`)
        .order('occurred_at', { ascending: false })
        .limit(5),
      client
        .from('inspections')
        .select('id, started_at, result, template_name')
        .or(`created_by.eq.${profileId},driver_id.eq.${driver.id}`)
        .order('started_at', { ascending: false })
        .limit(5),
    ]);
    setData({
      driver,
      assignment: (assignment.data || [])[0] || null,
      documents: documents.data || [],
      incidents: incidents.data || [],
      inspections: inspections.data || [],
    });
  }, [status, profileId]);

  const deviceId = data?.assignment?.traccar_device_id;
  const device = deviceId ? devices[deviceId] : null;
  const position = deviceId ? positions[deviceId] : null;

  return (
    <PageLayout breadcrumbs={['fleetDriverPortal']} description={t('fleetDriverPortalDescription')}>
      <FleetNotice permission="inspections.write" />
      <div className={classes.root}>
        {data && !data.driver && <Alert severity="info">{t('fleetDriverPortalNotLinked')}</Alert>}
        {data?.driver && (
          <>
            <Paper elevation={0} className={classes.card}>
              <div className={classes.head}>
                <DirectionsCarRoundedIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  {t('fleetDriverPortalMyVehicle')}
                </Typography>
              </div>
              {data.assignment ? (
                <>
                  <Typography variant="h6" component="p">
                    {device?.name || data.assignment.plate_number}
                    {' · '}
                    <span dir="ltr">{data.assignment.plate_number}</span>
                  </Typography>
                  {device && (
                    <Typography variant="body2" className={classes.head}>
                      <span
                        className={classes.dot}
                        style={{ backgroundColor: statusColor(theme, device.status) }}
                      />
                      {formatStatus(device.status, t)}
                      {position?.address && ` · ${position.address}`}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography color="textSecondary">{t('fleetNoVehicle')}</Typography>
              )}
              <div className={classes.actions}>
                <Button
                  variant="contained"
                  className={classes.action}
                  component={RouterLink}
                  to={`/fleet/inspection${deviceId ? `?deviceId=${deviceId}` : ''}`}
                >
                  <FactCheckRoundedIcon />
                  {t('fleetDriverPortalMorningCheck')}
                </Button>
                <Button
                  variant="outlined"
                  className={classes.action}
                  component={RouterLink}
                  to={`/fleet/incident${deviceId ? `?deviceId=${deviceId}` : ''}`}
                >
                  <CarCrashRoundedIcon />
                  {t('fleetIncidentAdd')}
                </Button>
              </div>
            </Paper>

            <DriverJobsCard driverId={data.driver.id} />

            <DriverPrivacyCard driverId={data.driver.id} hasVehicle={Boolean(data.assignment)} />

            <DriverSafetyCard driverId={data.driver.id} />

            <Paper elevation={0} className={classes.card}>
              <div className={classes.head}>
                <DescriptionRoundedIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  {t('fleetDriverPortalMyDocuments')}
                </Typography>
              </div>
              {data.documents.length === 0 && (
                <Typography color="textSecondary">{t('fleetNoDocuments')}</Typography>
              )}
              {data.documents.map((document) => (
                <div key={document.id} className={classes.line}>
                  <Typography variant="body2">
                    {label(document)} · {formatTime(document.expires_at, 'date')}
                  </Typography>
                  <ExpiryBadge date={document.expires_at} />
                </div>
              ))}
            </Paper>

            <Paper elevation={0} className={classes.card}>
              <div className={classes.head}>
                <HistoryRoundedIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  {t('fleetDriverPortalMyReports')}
                </Typography>
              </div>
              {data.inspections.length + data.incidents.length === 0 && (
                <Typography color="textSecondary">{t('fleetHistoryEmpty')}</Typography>
              )}
              {data.inspections.map((inspection) => (
                <div key={inspection.id} className={classes.line}>
                  <Typography variant="body2">
                    {t('fleetInspection')} · {inspection.template_name} ·{' '}
                    {formatTime(inspection.started_at, 'minutes')}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {t(
                      inspection.result === 'pass' ? 'fleetInspectionPass' : 'fleetInspectionFail',
                    )}
                  </Typography>
                </div>
              ))}
              {data.incidents.map((incident) => (
                <div key={incident.id} className={classes.line}>
                  <Typography variant="body2">
                    {t(incidentKey('Type', incident.type))} ·{' '}
                    {formatTime(incident.occurred_at, 'minutes')}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {t(incidentKey('Status', incident.status))}
                  </Typography>
                </div>
              ))}
            </Paper>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default DriverPortalPage;
