import { useReducer, useState } from 'react';
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
import { fleetActions } from '../store';
import ExpiryBadge, { useDaysText } from './components/ExpiryBadge';
import {
  acknowledgeAlerts,
  alertChannels,
  alertKinds,
  isPhoneChannel,
  loadOpenAlerts,
  validRecipientAddress,
} from './alerts';

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

const capital = (value) => value.replace(/^\w/, (c) => c.toUpperCase());
// document_expiry -> fleetAlertKindDocumentExpiry
const kindKey = (kind) =>
  `fleetAlertKind${capital(kind.replace(/_(\w)/g, (_, c) => c.toUpperCase()))}`;
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
    const address = isPhoneChannel(values.channel)
      ? values.address.replace(/[\s-]/g, '')
      : values.address.trim();
    const payload = { ...values, address, name: values.name.trim() };
    if (id) {
      unwrap(await client.from('alert_recipients').update(payload).eq('id', id));
    } else {
      unwrap(await client.from('alert_recipients').insert({ ...payload, org_id: profile.org_id }));
    }
    setEditing(null);
    reload();
  });

  const removeRecipient = useCatch(async (id) => {
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
      label={t(`fleetAlertsView${capital(key)}`)}
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
                  <TableCell>{t(`fleetChannel${capital(row.channel)}`)}</TableCell>
                  <TableCell>
                    <span dir="ltr">{row.address}</span>
                  </TableCell>
                  <TableCell>{row.kinds.map((kind) => t(kindKey(kind))).join(', ')}</TableCell>
                  <TableCell>
                    {t(row.active ? 'fleetRecipientActive' : 'fleetRecipientPaused')}
                  </TableCell>
                  <TableCell className={classes.actions}>
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
                        onClick={() => removeRecipient(row.id)}
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
                  <TableCell>{t(`fleetChannel${capital(row.channel)}`)}</TableCell>
                  <TableCell>
                    <span dir="ltr">{row.address}</span>
                  </TableCell>
                  <TableCell>{row.body}</TableCell>
                  <TableCell>
                    <Tooltip title={row.last_error || ''}>
                      <Chip
                        size="small"
                        color={deliveryColor[row.status]}
                        label={t(`fleetDelivery${capital(row.status)}`)}
                      />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </DataTable>
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
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
                    {t(`fleetChannel${capital(channel)}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t(editing.channel === 'email' ? 'userEmail' : 'fleetRecipientPhone')}
                helperText={
                  isPhoneChannel(editing.channel) ? t('fleetRecipientPhoneHint') : undefined
                }
                value={editing.address}
                onChange={(event) => setEditing({ ...editing, address: event.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
              <Autocomplete
                multiple
                options={alertKinds}
                value={editing.kinds}
                getOptionLabel={(kind) => t(kindKey(kind))}
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
