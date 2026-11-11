import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { coachingEffect, countByStatus, inboxItems } from '../common/fleet/safetyInbox';
import { loadDriving } from './safetyData';
import FleetNotice from './components/FleetNotice';
import { keepOnBackdrop } from '../common/util/formDialog';
import { capitalize, pascalCase } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 2, 0),
    },
  },
  tile: {
    minWidth: 120,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    justifyContent: 'flex-end',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

const DAYS = 30;
const time = (value) => Date.parse(value);

// SAF-01: the safety inbox. Every event waits here until someone decides what it is; the goal
// of the day is no event waiting.
const SafetyInboxPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('safety.read');
  const canWrite = useFleetPermission('safety.write');
  const devices = useSelector((state) => state.devices.items);
  const traccarDrivers = useSelector((state) => state.drivers.items);
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [driving, setDriving] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [fleetDrivers, setFleetDrivers] = useState([]);
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [coaching, setCoaching] = useState(null);

  const deviceIds = useMemo(() => Object.keys(devices).map(Number), [devices]);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      if (!canRead) return;
      const to = new Date();
      const from = new Date(to.getTime() - DAYS * 86400000);
      const client = getFleetClient();
      const [data, rows, drivers, profiles] = await Promise.all([
        loadDriving(deviceIds, from, to, signal),
        client.from('safety_event_reviews').select('*').gte('occurred_at', from.toISOString()),
        client.from('drivers').select('id, traccar_driver_id, full_name'),
        client.from('profiles').select('id, full_name').eq('is_active', true),
      ]);
      setDriving(data);
      setReviews(unwrap(rows) || []);
      setFleetDrivers(drivers.data || []);
      setPeople(profiles.data || []);
    },
    [canRead, deviceIds, reloadKey],
  );

  // The driver of an event: the identified driver of the trip it happened in.
  const driverOf = useMemo(() => {
    const trips = driving?.trips || [];
    return (event) =>
      trips.find(
        (trip) =>
          trip.deviceId === event.deviceId &&
          time(trip.startTime) <= time(event.eventTime) &&
          time(event.eventTime) <= time(trip.endTime),
      )?.driverUniqueId || null;
  }, [driving]);

  const items = useMemo(
    () => (driving ? inboxItems(driving.events, reviews, { driverOf }) : []),
    [driving, reviews, driverOf],
  );
  const counts = countByStatus(items);
  const effect = useMemo(
    () =>
      coachingEffect(
        items,
        (driving?.trips || []).map((trip) => ({ ...trip, driverKey: trip.driverUniqueId })),
      ),
    [items, driving],
  );
  const shown = filter === 'all' ? items : items.filter((item) => item.status === filter);

  const driverName = (uniqueId) =>
    Object.values(traccarDrivers).find((driver) => driver.uniqueId === uniqueId)?.name || '—';
  const fleetDriverId = (uniqueId) => {
    const traccar = Object.values(traccarDrivers).find((driver) => driver.uniqueId === uniqueId);
    return fleetDrivers.find((row) => row.traccar_driver_id === traccar?.id)?.id || null;
  };

  const decide = useCatch(async (item, status, extra = {}) => {
    const now = new Date().toISOString();
    unwrap(
      await getFleetClient()
        .from('safety_event_reviews')
        .upsert(
          {
            org_id: profile.org_id,
            traccar_event_id: item.eventId,
            traccar_device_id: item.deviceId,
            driver_id: fleetDriverId(item.driver),
            category: item.category,
            occurred_at: item.time,
            severity: item.severity,
            status,
            coached_at: status === 'coaching' ? now : null,
            reviewed_by: profile.id,
            reviewed_at: now,
            self_review: false,
            assigned_to: null,
            ...extra,
          },
          { onConflict: 'org_id,traccar_event_id' },
        ),
    );
    setCoaching(null);
    reload();
  });

  const filterChips = ['pending', 'coaching', 'praise', 'dismissed', 'all'].map((key) => (
    <Chip
      key={key}
      size="small"
      label={
        key === 'all' ? t('fleetFilterAll') : `${t(`safetyInbox${capitalize(key)}`)} ${counts[key]}`
      }
      color={filter === key ? 'primary' : 'default'}
      variant={filter === key ? 'filled' : 'outlined'}
      onClick={() => setFilter(key)}
    />
  ));

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetSafetyPage', 'safetyInboxTitle']}
      description={t('safetyInboxDescription')}
    >
      <FleetNotice permission="safety.read" />
      {driving && (
        <div className={classes.stats}>
          <div className={classes.tile} role="status">
            <Typography variant="caption" color="textSecondary">
              {t('safetyInboxPending')}
            </Typography>
            <div className={classes.value}>{counts.pending}</div>
            <Typography variant="caption" color="textSecondary">
              {counts.pending ? t('safetyInboxGoal') : t('safetyInboxClear')}
            </Typography>
          </div>
          <div className={classes.tile}>
            <Typography variant="caption" color="textSecondary">
              {t('safetyInboxEffect')}
            </Typography>
            <div className={classes.value}>
              {effect.change == null ? '—' : `${effect.change > 0 ? '+' : ''}${effect.change}%`}
            </div>
            <Typography variant="caption" color="textSecondary">
              {t('safetyInboxEffectHelp')}
            </Typography>
          </div>
        </div>
      )}
      <DataTable
        toolbar={
          <TableToolbar
            filters={filterChips}
            count={shown.length}
            actions={
              <Button size="small" component={RouterLink} to="/fleet/safety">
                {t('fleetSafetyPage')}
              </Button>
            }
          />
        }
        empty={Boolean(driving) && shown.length === 0}
        emptyState={{
          icon: <InboxRoundedIcon />,
          title: t(filter === 'pending' ? 'safetyInboxClear' : 'tableEmptyTitle'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetFuelFieldOccurredAt')}</TableCell>
            <TableCell>{t('sharedDevice')}</TableCell>
            <TableCell>{t('sharedDriver')}</TableCell>
            <TableCell>{t('fleetSafetyEvents')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            {canWrite && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {canRead && !driving && <TableShimmer columns={canWrite ? 6 : 5} />}
          {shown.slice(0, 300).map((item) => (
            <TableRow key={item.eventId} hover>
              <TableCell>{formatTime(item.time, 'minutes')}</TableCell>
              <TableCell>{devices[item.deviceId]?.name}</TableCell>
              <TableCell>{driverName(item.driver)}</TableCell>
              <TableCell>
                {t(`fleetSafetyEvent${capitalize(item.category)}`)}
                {item.severity === 'severe' && (
                  <Chip
                    size="small"
                    color="error"
                    label={t('safetyInboxSevere')}
                    sx={{ marginInlineStart: 1 }}
                  />
                )}
              </TableCell>
              <TableCell>
                {t(`safetyStatus${capitalize(item.status)}`)}
                {item.review?.self_review && (
                  <Typography variant="caption" display="block" color="textSecondary">
                    {item.review.driver_ack_at
                      ? t(`safetyAnswer${pascalCase(item.review.driver_answer)}`)
                      : t('safetyInboxSentToDriver')}
                  </Typography>
                )}
              </TableCell>
              {canWrite && (
                <TableCell>
                  <div className={classes.actions}>
                    {item.status === 'pending' ? (
                      <>
                        <Button size="small" variant="outlined" onClick={() => setCoaching(item)}>
                          {t('safetyInboxToCoaching')}
                        </Button>
                        <Button size="small" onClick={() => decide(item, 'praise')}>
                          {t('safetyInboxToPraise')}
                        </Button>
                        <Button size="small" onClick={() => decide(item, 'dismissed')}>
                          {t('safetyInboxDismiss')}
                        </Button>
                      </>
                    ) : (
                      <Button size="small" onClick={() => decide(item, 'pending')}>
                        {t('safetyInboxReopen')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {coaching && (
        <CoachingDialog
          item={coaching}
          people={people}
          hasDriver={Boolean(fleetDriverId(coaching.driver))}
          onClose={() => setCoaching(null)}
          onSave={(extra) => decide(coaching, 'coaching', extra)}
        />
      )}
    </PageLayout>
  );
};

// Coaching: a minor event can go to the driver for a self-review; a severe one goes to a named
// person.
const CoachingDialog = ({ item, people, hasDriver, onClose, onSave }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const severe = item.severity === 'severe';
  const [selfReview, setSelfReview] = useState(!severe && hasDriver);
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');
  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t('safetyInboxToCoaching')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          {!severe && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={selfReview}
                  disabled={!hasDriver}
                  onChange={(event) => setSelfReview(event.target.checked)}
                />
              }
              label={t(hasDriver ? 'safetyInboxSelfReview' : 'safetyInboxNoDriver')}
            />
          )}
          <TextField
            select
            label={t('safetyInboxAssignee')}
            value={assignee}
            required={severe}
            helperText={severe ? t('safetyInboxSevereHelp') : undefined}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <MenuItem value="">&nbsp;</MenuItem>
            {people.map((person) => (
              <MenuItem key={person.id} value={person.id}>
                {person.full_name || person.id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            multiline
            minRows={2}
            label={t('fleetNotes')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button
          variant="contained"
          disabled={severe && !assignee}
          onClick={() =>
            onSave({
              self_review: selfReview && !severe,
              assigned_to: assignee || null,
              note: note.trim() || null,
            })
          }
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SafetyInboxPage;
