import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import dayjs from 'dayjs';
import ScheduleSendRoundedIcon from '@mui/icons-material/ScheduleSendRounded';
import { useOutboxCount } from '../common/fleet/useOutbox';
import { flushOutbox } from '../common/fleet/outbox';
import { makeStyles } from 'tss-react/mui';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import { useAsyncTask } from '../reactHelper';
import { formatStatus, formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetLabel, useFleetProfile, useFleetStatus } from '../common/fleet/useFleet';
import ExpiryBadge from './components/ExpiryBadge';
import FleetNotice from './components/FleetNotice';
import DriverJobsCard from './components/DriverJobsCard';
import DriverPrivacyCard from './components/DriverPrivacyCard';
import DriverSafetyCard from './components/DriverSafetyCard';
import DriverSelfReviewCard from './components/DriverSelfReviewCard';
import { incidentKey } from './IncidentsPage';
import DispatcherContact, { useOrgContact } from './components/DispatcherContact';
import DriverCoursesCard from './components/DriverCoursesCard';

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
    // ADM-22: read in the sun: secondary text in ink and at 17px, not small slate.
    '& .MuiTypography-body2': {
      fontSize: '1.0625rem',
      color: theme.palette.text.primary,
    },
  },
  vehicle: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
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
  const { classes } = useStyles();
  const t = useTranslation();
  const waiting = useOutboxCount();
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
    const current = (assignment.data || [])[0] || null;
    // ADM-11: an open critical fault keeps the vehicle off the road.
    const outOfService = current?.vehicle_id
      ? (
          await client
            .from('vehicle_out_of_service')
            .select('reasons')
            .eq('vehicle_id', current.vehicle_id)
            .maybeSingle()
        ).data
      : null;
    setData({
      driver,
      outOfService,
      assignment: current,
      documents: documents.data || [],
      incidents: incidents.data || [],
      inspections: inspections.data || [],
    });
  }, [status, profileId]);

  const contact = useOrgContact();
  // ADM-22: today's morning check, done or not; while not done it is the main action.
  const todayCheck = (data?.inspections || []).find((inspection) =>
    dayjs(inspection.started_at).isSame(dayjs(), 'day'),
  );
  const deviceId = data?.assignment?.traccar_device_id;
  const device = deviceId ? devices[deviceId] : null;
  const position = deviceId ? positions[deviceId] : null;

  return (
    <PageLayout
      breadcrumbs={['fleetDriverPortal']}
      description={t('fleetDriverPortalDescription')}
      actions={
        contact && (
          <Tooltip title={t('driverContactDispatcher')}>
            <IconButton
              href={`tel:${contact.phone}`}
              aria-label={t('driverContactDispatcher')}
              color="primary"
            >
              <SupportAgentRoundedIcon />
            </IconButton>
          </Tooltip>
        )
      }
    >
      <FleetNotice permission="inspections.write" />
      <div className={classes.root}>
        {/* ADM-10: what waits in the phone for a line. */}
        {waiting > 0 && (
          <Alert
            severity="info"
            icon={<ScheduleSendRoundedIcon />}
            action={
              <Button color="inherit" size="small" onClick={() => flushOutbox(profile?.id)}>
                {t('driverOutboxRetry')}
              </Button>
            }
          >
            {t('driverOutboxWaiting').replace('{0}', waiting)}
          </Alert>
        )}
        {data && !data.driver && (
          <Alert severity="info">
            <Typography gutterBottom>{t('fleetDriverPortalNotLinked')}</Typography>
            {contact ? (
              <DispatcherContact contact={contact} />
            ) : (
              <Typography>{t('driverAskManager')}</Typography>
            )}
          </Alert>
        )}
        {data?.outOfService && (
          <Alert severity="error" variant="filled">
            {t('driverVehicleOutOfService').replace('{0}', data.outOfService.reasons || '')}
          </Alert>
        )}
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
                  <Typography component="p" className={classes.vehicle}>
                    <bdi>{device?.name || data.assignment.plate_number}</bdi>
                    {' · '}
                    <bdi dir="ltr">{data.assignment.plate_number}</bdi>
                  </Typography>
                  {device && (
                    <div className={classes.check}>
                      <Chip
                        label={formatStatus(device.status, t)}
                        color={device.status === 'online' ? 'success' : 'default'}
                      />
                      {position?.address && (
                        <Typography variant="body2">{position.address}</Typography>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <Typography color="textSecondary">{t('fleetNoVehicle')}</Typography>
              )}
              <div className={classes.check} role="status">
                {todayCheck ? (
                  <Chip
                    color="success"
                    icon={<CheckCircleRoundedIcon />}
                    label={t('driverMorningCheckDone').replace(
                      '{0}',
                      dayjs(todayCheck.started_at).format('HH:mm'),
                    )}
                  />
                ) : (
                  <Chip color="warning" label={t('driverMorningCheckPending')} />
                )}
              </div>
              <div className={classes.actions}>
                <Button
                  variant={todayCheck ? 'outlined' : 'contained'}
                  className={classes.action}
                  component={RouterLink}
                  to="/driver/check"
                >
                  <FactCheckRoundedIcon />
                  {t('fleetDriverPortalMorningCheck')}
                </Button>
                <Button
                  variant="outlined"
                  className={classes.action}
                  component={RouterLink}
                  to="/driver/damage"
                >
                  <CarCrashRoundedIcon />
                  {t('fleetIncidentAdd')}
                </Button>
                {/* SAF-02: the QR in the cabin makes the trips from now on the driver's. */}
                <Button
                  variant="outlined"
                  className={classes.action}
                  component={RouterLink}
                  to="/driver/checkin"
                >
                  <QrCodeScannerRoundedIcon />
                  {t('driverCheckIn')}
                </Button>
                {/* ISR-11: handing the vehicle over or back, signed. */}
                <Button
                  variant="outlined"
                  className={classes.action}
                  component={RouterLink}
                  to="/driver/handover"
                >
                  <KeyRoundedIcon />
                  {t('driverHandover')}
                </Button>
                {/* ADM-18: a fueling paid on the road, with the receipt's photo. */}
                <Button
                  variant="outlined"
                  className={classes.action}
                  component={RouterLink}
                  to="/driver/fuel"
                >
                  <LocalGasStationRoundedIcon />
                  {t('driverFuel')}
                </Button>
              </div>
            </Paper>

            <DriverJobsCard driverId={data.driver.id} />

            <DriverPrivacyCard driverId={data.driver.id} hasVehicle={Boolean(data.assignment)} />

            <DriverCoursesCard />

            <DriverSelfReviewCard />
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
