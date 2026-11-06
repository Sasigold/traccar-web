import { Fragment, useMemo, useReducer, useState } from 'react';
import {
  Alert,
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
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  API_SCOPES,
  WEBHOOK_ACTIONS,
  WEBHOOK_SOURCES,
  generateApiKey,
  isValidWebhookUrl,
  keyState,
  sha256Hex,
  webhookEventKey,
} from '../common/fleet/integrations';
import FleetNotice from './components/FleetNotice';
import { camel, useFleetRows } from './stage5Data';

const useStyles = makeStyles()((theme) => ({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  events: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) repeat(4, auto)',
    alignItems: 'center',
    columnGap: theme.spacing(1),
  },
  action: {
    width: '1%',
    whiteSpace: 'nowrap',
  },
  number: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  code: {
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
}));

const KeyDialog = ({ onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [name, setName] = useState('');
  const [scope, setScope] = useState('read');
  const [created, setCreated] = useState(null);

  const save = useCatch(async () => {
    const { key, prefix } = generateApiKey();
    unwrap(
      await getFleetClient()
        .from('api_keys')
        .insert({
          org_id: profile.org_id,
          name: name.trim(),
          prefix,
          key_hash: await sha256Hex(key),
          scopes: scope === 'write' ? ['read', 'write'] : ['read'],
          created_by: profile.id,
        }),
    );
    setCreated(key);
    onSaved();
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('fleetApiKeyAdd')}</DialogTitle>
      <DialogContent>
        {created ? (
          <div className={classes.stack}>
            <Alert severity="warning">{t('fleetApiKeyShownOnce')}</Alert>
            <Typography className={classes.code} dir="ltr">
              {created}
            </Typography>
          </div>
        ) : (
          <div className={classes.stack}>
            <TextField
              label={t('sharedName')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              select
              label={t('fleetApiKeyScope')}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              {API_SCOPES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`fleetApiScope${camel(value)}`)}
                </MenuItem>
              ))}
            </TextField>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        {created ? (
          <>
            <Button onClick={() => navigator.clipboard?.writeText(created)}>
              {t('sharedCopy')}
            </Button>
            <Button variant="contained" onClick={onClose}>
              {t('fleetDone')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>{t('sharedCancel')}</Button>
            <Button variant="contained" onClick={save} disabled={!name.trim()}>
              {t('fleetApiKeyCreate')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

const emptyWebhook = { name: '', url: '', events: [], active: true };

const WebhookDialog = ({ webhook, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(webhook);

  const toggle = (event) =>
    setForm({
      ...form,
      events: form.events.includes(event)
        ? form.events.filter((item) => item !== event)
        : [...form.events, event],
    });

  const save = useCatch(async () => {
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      events: form.events,
      active: form.active,
    };
    const client = getFleetClient();
    if (form.id) {
      unwrap(await client.from('webhooks').update(payload).eq('id', form.id));
    } else {
      unwrap(
        await client
          .from('webhooks')
          .insert({ ...payload, org_id: profile.org_id, created_by: profile.id }),
      );
    }
    onSaved();
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(form.id ? 'fleetWebhookEdit' : 'fleetWebhookAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.stack}>
          <TextField
            label={t('sharedName')}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <TextField
            label={t('fleetWebhookUrl')}
            value={form.url}
            placeholder="https://"
            error={Boolean(form.url) && !isValidWebhookUrl(form.url)}
            helperText={t('fleetWebhookUrlHelp')}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
          <div className={classes.events}>
            <Typography variant="body2" fontWeight={600}>
              {t('fleetWebhookEvents')}
            </Typography>
            {[...WEBHOOK_ACTIONS, '*'].map((action) => (
              <Typography key={action} variant="caption" align="center">
                {t(`fleetWebhookAction${action === '*' ? 'All' : camel(action)}`)}
              </Typography>
            ))}
            {WEBHOOK_SOURCES.map((source) => (
              <Fragment key={source}>
                <Typography variant="body2">{t(webhookEventKey(source))}</Typography>
                {[...WEBHOOK_ACTIONS, '*'].map((action) => {
                  const event = `${source}.${action}`;
                  return (
                    <Checkbox
                      key={event}
                      size="small"
                      checked={form.events.includes(event)}
                      onChange={() => toggle(event)}
                      slotProps={{
                        input: { 'aria-label': `${t(webhookEventKey(source))} ${event}` },
                      }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
            }
            label={t('fleetWebhookActive')}
          />
          {form.secret && (
            <TextField
              label={t('fleetWebhookSecret')}
              value={form.secret}
              helperText={t('fleetWebhookSecretHelp')}
              slotProps={{ input: { readOnly: true }, htmlInput: { dir: 'ltr' } }}
            />
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={!form.name.trim() || !isValidWebhookUrl(form.url) || form.events.length === 0}
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const views = ['keys', 'webhooks', 'deliveries'];
const deliveryColor = { queued: 'default', sending: 'info', sent: 'success', failed: 'error' };

// Roadmap stage 5: API keys and webhooks for the organization's own systems.
const IntegrationsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const canManage = useFleetPermission('integrations.manage');
  const [view, setView] = useState('keys');
  const [dialog, setDialog] = useState(null);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);

  const keys = useFleetRows('api_keys', {
    select: 'id, name, prefix, scopes, last_used_at, expires_at, revoked_at, created_at',
    order: 'created_at',
    ascending: false,
    enabled: canManage,
    reloadKey,
  });
  const webhooks = useFleetRows('webhooks', {
    order: 'created_at',
    ascending: false,
    enabled: canManage,
    reloadKey,
  });
  const deliveries = useFleetRows('webhook_deliveries', {
    select: 'id, webhook_id, event, status, attempts, response_code, error, created_at, sent_at',
    order: 'created_at',
    ascending: false,
    enabled: canManage && view === 'deliveries',
    reloadKey,
  });
  const webhookName = useMemo(
    () => Object.fromEntries((webhooks || []).map((hook) => [hook.id, hook.name])),
    [webhooks],
  );

  const revoke = useCatch(async (key) => {
    unwrap(
      await getFleetClient()
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', key.id),
    );
    reload();
  });

  const rows = { keys, webhooks, deliveries }[view];

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetIntegrationsPage']}
      description={t('fleetIntegrationsPageDescription')}
    >
      <FleetNotice permission="integrations.manage" />
      <DataTable
        toolbar={
          <TableToolbar
            count={rows?.length || 0}
            filters={views.map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(`fleetIntegrationsView${camel(key)}`)}
                color={view === key ? 'primary' : 'default'}
                variant={view === key ? 'filled' : 'outlined'}
                onClick={() => setView(key)}
              />
            ))}
            actions={
              canManage &&
              view !== 'deliveries' && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() =>
                    setDialog(
                      view === 'keys' ? { type: 'key' } : { type: 'webhook', value: emptyWebhook },
                    )
                  }
                >
                  {t(view === 'keys' ? 'fleetApiKeyAdd' : 'fleetWebhookAdd')}
                </Button>
              )
            }
          />
        }
        empty={canManage && rows && rows.length === 0}
        emptyState={{
          icon: view === 'keys' ? <KeyRoundedIcon /> : <WebhookRoundedIcon />,
          title: t(`fleetIntegrationsNone${camel(view)}`),
        }}
      >
        {view === 'keys' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedName')}</TableCell>
                <TableCell>{t('fleetApiKeyPrefix')}</TableCell>
                <TableCell>{t('fleetApiKeyScope')}</TableCell>
                <TableCell>{t('fleetApiKeyLastUsed')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                <TableCell className={classes.action} />
              </TableRow>
            </TableHead>
            <TableBody>
              {(keys || []).map((key) => {
                const state = keyState(key);
                return (
                  <TableRow key={key.id} hover>
                    <TableCell>{key.name}</TableCell>
                    <TableCell className={classes.code} dir="ltr">
                      {`${key.prefix}…`}
                    </TableCell>
                    <TableCell>
                      {key.scopes.map((scope) => t(`fleetApiScope${camel(scope)}`)).join(', ')}
                    </TableCell>
                    <TableCell className={classes.number}>
                      {key.last_used_at ? formatTime(key.last_used_at, 'minutes') : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={state === 'active' ? 'success' : 'default'}
                        label={t(`fleetApiKeyState${camel(state)}`)}
                      />
                    </TableCell>
                    <TableCell className={classes.action}>
                      {state === 'active' && (
                        <Tooltip title={t('fleetApiKeyRevoke')}>
                          <IconButton
                            size="small"
                            aria-label={t('fleetApiKeyRevoke')}
                            onClick={() => revoke(key)}
                          >
                            <BlockRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </>
        )}
        {view === 'webhooks' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedName')}</TableCell>
                <TableCell>{t('fleetWebhookUrl')}</TableCell>
                <TableCell>{t('fleetWebhookEvents')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                <TableCell className={classes.action} />
              </TableRow>
            </TableHead>
            <TableBody>
              {(webhooks || []).map((hook) => (
                <TableRow key={hook.id} hover>
                  <TableCell>{hook.name}</TableCell>
                  <TableCell className={classes.code} dir="ltr">
                    {hook.url}
                  </TableCell>
                  <TableCell>{hook.events.length}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={hook.active ? 'success' : 'default'}
                      label={t(hook.active ? 'fleetWebhookActive' : 'fleetWebhookPaused')}
                    />
                  </TableCell>
                  <TableCell className={classes.action}>
                    <Tooltip title={t('sharedEdit')}>
                      <IconButton
                        size="small"
                        aria-label={t('sharedEdit')}
                        onClick={() => setDialog({ type: 'webhook', value: hook })}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'deliveries' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetDeliveryCreated')}</TableCell>
                <TableCell>{t('fleetWebhook')}</TableCell>
                <TableCell>{t('fleetWebhookEvent')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                <TableCell>{t('fleetDeliveryAttempts')}</TableCell>
                <TableCell>{t('fleetDeliveryResponse')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(deliveries || []).map((delivery) => (
                <TableRow key={delivery.id} hover>
                  <TableCell className={classes.number}>
                    {formatTime(delivery.created_at, 'seconds')}
                  </TableCell>
                  <TableCell>{webhookName[delivery.webhook_id]}</TableCell>
                  <TableCell className={classes.code} dir="ltr">
                    {delivery.event}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={deliveryColor[delivery.status]}
                      label={t(`fleetDeliveryStatus${camel(delivery.status)}`)}
                    />
                  </TableCell>
                  <TableCell className={classes.number}>{delivery.attempts}</TableCell>
                  <TableCell className={classes.number}>
                    {delivery.response_code || delivery.error || ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </DataTable>
      {view === 'keys' && canManage && (
        <Alert severity="info" sx={{ mx: 3, my: 2 }}>
          {t('fleetApiKeyGatewayNote')}
        </Alert>
      )}
      {dialog?.type === 'key' && <KeyDialog onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.type === 'webhook' && (
        <WebhookDialog
          webhook={dialog.value}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default IntegrationsPage;
