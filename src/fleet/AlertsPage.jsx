import { useEffect, useReducer, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { useFleetRows } from './stage5Data';
import ValidityTabs from './components/ValidityTabs';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import {
  useFleetError,
  useFleetLabel,
  useFleetPermission,
  useFleetProfile,
  useFleetStatus,
} from '../common/fleet/useFleet';
import { fleetActions, messagesActions } from '../store';
import ExpiryBadge, { useDaysText } from './components/ExpiryBadge';
import {
  acknowledgeAlerts,
  alertChannels,
  alertKinds,
  isPhoneChannel,
  normalizeRecipientAddress,
  loadOpenAlerts,
  validRecipientAddress,
} from './alerts';
import { useConfirm } from '../common/components/confirm/ConfirmProvider';
import { keepOnBackdrop } from '../common/util/formDialog';
import { capitalize, pascalCase } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  row: {
    cursor: 'pointer',
  },
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  actions: {
    width: '1%',
    whiteSpace: 'nowrap',
  },
}));

// document_expiry -> fleetAlertKindDocumentExpiry
// The alert kinds that something produces today (ADM-08); the others are offered as "soon".
const WORKING_KINDS = ['document_expiry'];

const kindKey = (kind) => `fleetAlertKind${pascalCase(kind)}`;
const emptyRecipient = {
  name: '',
  channel: 'whatsapp',
  address: '',
  kinds: ['document_expiry'],
  active: true,
};
const deliveryColor = {
  queued: 'default',
  sending: 'info',
  sent: 'success',
  failed: 'error',
  skipped: 'default',
};

// Roadmap 4.4: open expiry alerts with "handled", who gets which alert, and the outgoing queue.
const AlertsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const label = useFleetLabel();
  const daysText = useDaysText();

  const status = useFleetStatus();
  const error = useFleetError();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('alerts.read');
  const canManage = useFleetPermission('alerts.manage');
  const openCount = useSelector((state) => state.fleet.alertsCount);

  const views = ['open', ...(canManage ? ['recipients', 'outbox'] : [])];
  const [view, setView] = useState('open');
  // null while unknown (an older database without messaging_ready).
  const [sendingReady, setSendingReady] = useState(null);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    setRows(null);
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
    if (view === 'open') {
      setRows(await loadOpenAlerts());
    } else if (view === 'recipients') {
      setRows(unwrap(await client.from('alert_recipients').select('*').order('name')) || []);
    } else {
      // ADM-08: is any channel set up? Otherwise the queued messages are only waiting.
      const { data: channels } = await client.rpc('messaging_ready');
      setSendingReady(channels ? channels.some((channel) => channel.ready) : null);
      setRows(
        unwrap(
          await client
            .from('notification_deliveries')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200),
        ) || [],
      );
    }
  }, [view, canRead, reloadKey]);

  const acknowledge = useCatch(async (ids) => {
    await acknowledgeAlerts(ids, profile.id);
    dispatch(fleetActions.alertsCount(Math.max(0, openCount - ids.length)));
    setSelected([]);
    reload();
  });

  const saveRecipient = useCatch(async () => {
    const client = getFleetClient();
    const { id, ...values } = editing;
    const address = normalizeRecipientAddress(values.channel, values.address);
    const payload = { ...values, address, name: values.name.trim() };
    if (id) {
      unwrap(await client.from('alert_recipients').update(payload).eq('id', id));
    } else {
      unwrap(await client.from('alert_recipients').insert({ ...payload, org_id: profile.org_id }));
    }
    setEditing(null);
    reload();
  });

  // ADM-27: a test message, once the channel can send.
  const [ready, setReady] = useState({});
  useEffect(() => {
    if (!canManage || view !== 'recipients') return;
    getFleetClient()
      .rpc('messaging_ready')
      .then(({ data }) =>
        setReady(Object.fromEntries((data || []).map((row) => [row.channel, row.ready]))),
      );
  }, [canManage, view]);
  const people = useFleetRows('profiles', {
    select: 'id, full_name, email',
    order: 'full_name',
    enabled: Boolean(editing),
  });
  const testRecipient = useCatch(async (row) => {
    unwrap(await getFleetClient().rpc('alert_recipient_test', { p_recipient: row.id }));
    dispatch(
      messagesActions.push({
        message: t('fleetRecipientTestSent').replace('{0}', row.name),
        severity: 'success',
      }),
    );
  });

  const removeRecipient = useCatch(async (id, name) => {
    if (
      !(await confirm({
        title: t('sharedRemoveNamed').replace('{0}', name || ''),
        message: t('alertRecipientRemoveConsequence'),
        confirmLabel: t('sharedRemove'),
      }))
    ) {
      return;
    }
    unwrap(await getFleetClient().from('alert_recipients').delete().eq('id', id));
    reload();
  });

  const openEntity = (row) => {
    if (row.entity === 'vehicle' && row.traccar_device_id) {
      navigate(`/settings/device/${row.traccar_device_id}`);
    } else if (row.entity === 'driver' && row.traccar_driver_id) {
      navigate(`/settings/driver/${row.traccar_driver_id}`);
    }
  };

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((it) => it !== id) : [...current, id],
    );

  const viewChips = views.map((key) => (
    <Chip
      key={key}
      size="small"
      label={t(`fleetAlertsView${capitalize(key)}`)}
      color={view === key ? 'primary' : 'default'}
      variant={view === key ? 'filled' : 'outlined'}
      onClick={() => {
        setSelected([]);
        setView(key);
      }}
    />
  ));

  const toolbarActions =
    view === 'open' && selected.length > 0 ? (
      <Button size="small" startIcon={<TaskAltRoundedIcon />} onClick={() => acknowledge(selected)}>
        {t('fleetAlertsAcknowledgeSelected').replace('{0}', String(selected.length))}
      </Button>
    ) : view === 'recipients' ? (
      <Button variant="contained" size="small" onClick={() => setEditing(emptyRecipient)}>
        {t('fleetRecipientAdd')}
      </Button>
    ) : null;

  const emptyTitle = {
    open: 'fleetAlertsNoneOpen',
    recipients: 'fleetRecipientsNone',
    outbox: 'fleetOutboxEmpty',
  }[view];

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetAlertsPage']}
      description={t('fleetAlertsPageDescription')}
    >
      <ValidityTabs />
      {status === 'error' && (
        <Alert severity="warning" sx={{ mx: 3, mb: 2 }}>
          {t('fleetConnectionError').replace('{0}', error || '')}
        </Alert>
      )}
      {status === 'ready' && !canRead && (
        <Alert severity="info" sx={{ mx: 3, mb: 2 }}>
          {t('fleetAlertsNoAccess')}
        </Alert>
      )}
      {view === 'recipients' && (
        <Alert severity="info" sx={{ mx: 3, mb: 2 }}>
          {t('fleetRecipientsHint')}
        </Alert>
      )}
      {view === 'outbox' && sendingReady === false && (
        <Alert severity="warning" sx={{ mx: 3, mb: 2 }}>
          {t('fleetOutboxNotConnected')}
        </Alert>
      )}
      <DataTable
        toolbar={
          <TableToolbar
            count={rows ? rows.length : undefined}
            filters={viewChips}
            actions={toolbarActions}
          />
        }
        empty={rows != null && rows.length === 0}
        emptyState={{
          icon: <NotificationsActiveRoundedIcon />,
          title: t(emptyTitle),
          description: view === 'open' ? t('fleetAlertsNoneOpenDescription') : undefined,
        }}
      >
        {view === 'open' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>{t('fleetEntity')}</TableCell>
                <TableCell>{t('fleetDocumentType')}</TableCell>
                <TableCell>{t('fleetExpiresAt')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                <TableCell className={classes.actions} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={6} />}
              {rows?.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  className={classes.row}
                  onClick={() => openEntity(row)}
                >
                  <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      size="small"
                      slotProps={{ input: { 'aria-label': t('fleetAlertsSelect') } }}
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {row.entity === 'vehicle'
                      ? `${t('fleetEntityVehicle')}: `
                      : `${t('fleetEntityDriver')}: `}
                    <span dir="auto">{row.plate_number || row.driver_name}</span>
                  </TableCell>
                  <TableCell>{label(row)}</TableCell>
                  <TableCell className={classes.nowrap}>
                    {formatTime(row.expires_at, 'date')} · {daysText(row.days_left)}
                  </TableCell>
                  <TableCell>
                    <ExpiryBadge date={row.expires_at} />
                  </TableCell>
                  <TableCell
                    className={classes.actions}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      size="small"
                      startIcon={<TaskAltRoundedIcon />}
                      onClick={() => acknowledge([row.id])}
                    >
                      {t('fleetAlertsAcknowledge')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'recipients' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedName')}</TableCell>
                <TableCell>{t('fleetRecipientChannel')}</TableCell>
                <TableCell>{t('fleetRecipientAddress')}</TableCell>
                <TableCell>{t('fleetRecipientKinds')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                <TableCell className={classes.actions} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && <TableShimmer columns={6} />}
              {rows?.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{t(`fleetChannel${capitalize(row.channel)}`)}</TableCell>
                  <TableCell>
                    <span dir="ltr">{row.address}</span>
                  </TableCell>
                  <TableCell>{row.kinds.map((kind) => t(kindKey(kind))).join(', ')}</TableCell>
                  <TableCell>
                    {t(row.active ? 'fleetRecipientActive' : 'fleetRecipientPaused')}
                  </TableCell>
                  <TableCell className={classes.actions}>
                    <Tooltip
                      title={t(
                        ready[row.channel] ? 'fleetRecipientTest' : 'fleetRecipientTestNotReady',
                      )}
                    >
                      <span>
                        <IconButton
                          size="small"
                          disabled={!ready[row.channel]}
                          onClick={() => testRecipient(row)}
                          aria-label={`${t('fleetRecipientTest')}: ${row.name}`}
                        >
                          <SendRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('sharedEdit')}>
                      <IconButton
                        size="small"
                        onClick={() => setEditing(row)}
                        aria-label={t('sharedEdit')}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('sharedRemove')}>
                      <IconButton
                        size="small"
                        onClick={() => removeRecipient(row.id, row.name)}
                        aria-label={t('sharedRemove')}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'outbox' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetOutboxCreated')}</TableCell>
                <TableCell>{t('fleetRecipientChannel')}</TableCell>
                <TableCell>{t('fleetRecipientAddress')}</TableCell>
                <TableCell>{t('fleetOutboxMessage')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && <TableShimmer columns={5} />}
              {rows?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className={classes.nowrap}>
                    {formatTime(row.created_at, 'minutes')}
                  </TableCell>
                  <TableCell>{t(`fleetChannel${capitalize(row.channel)}`)}</TableCell>
                  <TableCell>
                    <span dir="ltr">{row.address}</span>
                  </TableCell>
                  <TableCell>{row.body}</TableCell>
                  <TableCell>
                    <Tooltip title={row.last_error || ''}>
                      <Chip
                        size="small"
                        color={deliveryColor[row.status]}
                        label={t(`fleetDelivery${capitalize(row.status)}`)}
                      />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </DataTable>
      <Dialog
        open={Boolean(editing)}
        onClose={keepOnBackdrop(() => setEditing(null))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t(editing?.id ? 'fleetRecipientEdit' : 'fleetRecipientAdd')}</DialogTitle>
        {editing && (
          <DialogContent>
            <div className={classes.form}>
              <TextField
                label={t('sharedName')}
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
              <TextField
                select
                label={t('fleetRecipientChannel')}
                value={editing.channel}
                onChange={(event) => setEditing({ ...editing, channel: event.target.value })}
              >
                {alertChannels.map((channel) => (
                  <MenuItem key={channel} value={channel}>
                    {t(`fleetChannel${capitalize(channel)}`)}
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete
                options={people || []}
                getOptionLabel={(person) => person.full_name || person.email || ''}
                onChange={(_, person) =>
                  person &&
                  setEditing({
                    ...editing,
                    name: person.full_name || editing.name,
                    profile_id: person.id,
                    address:
                      editing.channel === 'email'
                        ? person.email || ''
                        : person.phone || editing.address,
                  })
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('fleetRecipientFromUsers')} />
                )}
              />
              <TextField
                label={t(editing.channel === 'email' ? 'userEmail' : 'fleetRecipientPhone')}
                error={
                  Boolean(editing.address.trim()) &&
                  !validRecipientAddress(editing.channel, editing.address)
                }
                helperText={
                  Boolean(editing.address.trim()) &&
                  !validRecipientAddress(editing.channel, editing.address)
                    ? t(
                        isPhoneChannel(editing.channel)
                          ? 'fleetRecipientBadPhone'
                          : 'fleetRecipientBadEmail',
                      )
                    : isPhoneChannel(editing.channel)
                      ? t('fleetRecipientPhoneHint')
                      : undefined
                }
                value={editing.address}
                onChange={(event) => setEditing({ ...editing, address: event.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
              <Autocomplete
                multiple
                options={alertKinds}
                value={editing.kinds}
                getOptionLabel={(kind) =>
                  WORKING_KINDS.includes(kind)
                    ? t(kindKey(kind))
                    : `${t(kindKey(kind))} (${t('sharedComingSoon')})`
                }
                // ADM-08: only expiry alerts are sent today.
                getOptionDisabled={(kind) => !WORKING_KINDS.includes(kind)}
                onChange={(_, kinds) => setEditing({ ...editing, kinds })}
                renderInput={(params) => <TextField {...params} label={t('fleetRecipientKinds')} />}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editing.active}
                    onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                  />
                }
                label={t('fleetRecipientActive')}
              />
            </div>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEditing(null)}>{t('sharedCancel')}</Button>
          <Button
            variant="contained"
            onClick={saveRecipient}
            disabled={
              !editing?.name.trim() ||
              !validRecipientAddress(editing?.channel, editing?.address) ||
              !editing?.kinds.length
            }
          >
            {t('sharedSave')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

export default AlertsPage;
