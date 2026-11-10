import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import SmsRoundedIcon from '@mui/icons-material/SmsRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch, useCatchCallback } from '../reactHelper';
import PageLayout from '../common/components/PageLayout';
import FormSection from '../settings/components/FormSection';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import { useAdminAccess } from './useAdmin';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { capitalize } from '../common/util/stringUtils';

const CHANNELS = [
  { channel: 'whatsapp', providers: ['meta', 'webhook'], icon: <ChatRoundedIcon /> },
  { channel: 'sms', providers: ['vonage', 'webhook'], icon: <SmsRoundedIcon /> },
  { channel: 'email', providers: ['resend', 'webhook'], icon: <EmailRoundedIcon /> },
];

const useStyles = makeStyles()((theme) => ({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 3, 3),
    maxWidth: 820,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2, 2),
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    '& .MuiTextField-root': {
      flex: 1,
    },
  },
  rowButton: {
    marginTop: theme.spacing(1),
    whiteSpace: 'nowrap',
  },
}));

// One channel: how it sends, its key (write-only) and a test message.
const ChannelCard = ({ spec, settings, hasSecret, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [values, setValues] = useState(
    () =>
      settings || {
        channel: spec.channel,
        provider: spec.providers[0],
        enabled: false,
        sender: '',
        template: '',
        language: 'he',
      },
  );
  const [secret, setSecret] = useState('');
  const [testAddress, setTestAddress] = useState('');
  const [notice, setNotice] = useState(null);

  const client = getFleetClient();
  const providerKey = capitalize(values.provider);

  const save = useCatch(async () => {
    unwrap(await client.from('messaging_channels').upsert({ ...values, updated_at: new Date() }));
    setNotice({ severity: 'success', text: t('messagingSaved') });
    onSaved();
  });

  const saveSecret = useCatch(async () => {
    unwrap(await client.rpc('messaging_set_secret', { p_channel: spec.channel, p_secret: secret }));
    setSecret('');
    setNotice({ severity: 'success', text: t('messagingKeySaved') });
    onSaved();
  });

  const test = useCatch(async () => {
    unwrap(await client.rpc('messaging_test', { p_channel: spec.channel, p_address: testAddress }));
    setNotice({ severity: 'info', text: t('messagingTestQueued') });
  });

  return (
    <FormSection
      title={t(`fleetChannel${capitalize(spec.channel)}`)}
      description={t(`messagingHelp${capitalize(spec.channel)}`)}
      icon={spec.icon}
      actions={
        <Chip
          size="small"
          color={values.enabled && hasSecret ? 'success' : 'default'}
          label={t(
            values.enabled && hasSecret
              ? 'messagingActive'
              : hasSecret
                ? 'messagingOff'
                : 'messagingNoKey',
          )}
        />
      }
    >
      <div className={classes.grid}>
        <TextField
          select
          label={t('messagingProvider')}
          value={values.provider}
          onChange={(event) => setValues({ ...values, provider: event.target.value })}
        >
          {spec.providers.map((provider) => (
            <MenuItem key={provider} value={provider}>
              {t(`messagingProvider${capitalize(provider)}`)}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch
              checked={values.enabled}
              onChange={(event) => setValues({ ...values, enabled: event.target.checked })}
            />
          }
          label={t('messagingEnabled')}
        />
        <TextField
          className={values.provider === 'meta' ? undefined : classes.wide}
          label={t(`messagingSender${providerKey}`)}
          value={values.sender || ''}
          onChange={(event) => setValues({ ...values, sender: event.target.value })}
          slotProps={{ htmlInput: { dir: 'ltr' } }}
        />
        {values.provider === 'meta' && (
          <TextField
            label={t('messagingTemplate')}
            helperText={t('messagingTemplateHelp')}
            value={values.template || ''}
            onChange={(event) => setValues({ ...values, template: event.target.value })}
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
        )}
        <div className={classes.wide}>
          <Button variant="outlined" onClick={save}>
            {t('sharedSave')}
          </Button>
        </div>
        <div className={`${classes.row} ${classes.wide}`}>
          <TextField
            type="password"
            autoComplete="new-password"
            label={t(`messagingKey${providerKey}`)}
            helperText={t(hasSecret ? 'messagingKeyReplace' : 'messagingKeyNew')}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
          <Button className={classes.rowButton} onClick={saveSecret} disabled={!secret}>
            {t('messagingKeySave')}
          </Button>
        </div>
        <div className={`${classes.row} ${classes.wide}`}>
          <TextField
            type={spec.channel === 'email' ? 'email' : 'tel'}
            label={t('messagingTestAddress')}
            value={testAddress}
            onChange={(event) => setTestAddress(event.target.value)}
          />
          <Button
            className={classes.rowButton}
            onClick={test}
            disabled={!testAddress || !settings?.enabled || !hasSecret}
          >
            {t('messagingTestSend')}
          </Button>
        </div>
        {notice && (
          <Alert className={classes.wide} severity={notice.severity} role="status">
            {notice.text}
          </Alert>
        )}
      </div>
    </FormSection>
  );
};

// Service management → Sending: the channels that deliver alerts (WhatsApp, SMS, email).
const MessagingPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const access = useAdminAccess();
  const [channels, setChannels] = useState(null);
  const [status, setStatus] = useState({});

  const load = useCatchCallback(async () => {
    if (!access.customersManage) {
      return;
    }
    const client = getFleetClient();
    const rows = unwrap(await client.from('messaging_channels').select('*')) || [];
    const statusRows = unwrap(await client.rpc('messaging_status')) || [];
    setChannels(Object.fromEntries(rows.map((row) => [row.channel, row])));
    setStatus(Object.fromEntries(statusRows.map((row) => [row.channel, row.has_secret])));
  }, [access.customersManage]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'messagingTitle']}
      description={t('messagingDescription')}
    >
      <AdminGate need="customersManage" />
      {access.customersManage && channels && (
        <div className={classes.page}>
          <Typography variant="body2" color="textSecondary">
            {t('messagingIntro')}
          </Typography>
          {CHANNELS.map((spec) => (
            <ChannelCard
              key={spec.channel}
              spec={spec}
              settings={channels[spec.channel]}
              hasSecret={Boolean(status[spec.channel])}
              onSaved={load}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default MessagingPage;
