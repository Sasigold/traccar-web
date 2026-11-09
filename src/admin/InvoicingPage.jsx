import { useState } from 'react';
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
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../reactHelper';
import PageLayout from '../common/components/PageLayout';
import FormSection from '../settings/components/FormSection';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import { useAdminAccess } from './useAdmin';
import {
  loadBillingKeysStatus,
  loadBillingProvider,
  saveBillingProvider,
  setBillingSecret,
} from './adminApi';

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
  steps: {
    margin: 0,
    paddingInlineStart: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
}));

const DEFAULTS = {
  provider: 'morning',
  enabled: false,
  environment: 'production',
  clearing: false,
  max_payments: 1,
};

// A key field that is written once and never shown again.
const SecretField = ({ name, label, isSet, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [value, setValue] = useState('');
  const save = useCatch(async () => {
    await setBillingSecret(name, value);
    setValue('');
    onSaved();
  });
  return (
    <div className={classes.row}>
      <TextField
        type="password"
        autoComplete="new-password"
        label={label}
        helperText={t(isSet ? 'invoicingKeyReplace' : 'invoicingKeyNew')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        slotProps={{ htmlInput: { dir: 'ltr' } }}
      />
      <Button className={classes.rowButton} onClick={save} disabled={!value.trim()}>
        {t('invoicingKeySave')}
      </Button>
    </div>
  );
};

// Service management → Tax invoices (BIZ-01): the provider that issues official tax documents
// with an allocation number, its keys (kept in Vault) and the card payment page.
const InvoicingPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const access = useAdminAccess();
  const [settings, setSettings] = useState(null);
  const [keys, setKeys] = useState({ has_id: false, has_secret: false });
  const [saved, setSaved] = useState(false);

  const loadKeys = useCatch(async () => setKeys(await loadBillingKeysStatus()));

  useAsyncTask(async () => {
    if (!access.billingManage) {
      return;
    }
    setSettings({ ...DEFAULTS, ...((await loadBillingProvider()) || {}) });
    setKeys(await loadBillingKeysStatus());
  }, [access.billingManage]);

  const save = useCatch(async () => {
    const { provider, enabled, environment, clearing } = settings;
    setSettings({
      ...DEFAULTS,
      ...(await saveBillingProvider({
        provider,
        enabled,
        environment,
        clearing,
        max_payments: Number(settings.max_payments) || 1,
      })),
    });
    setSaved(true);
  });

  const set = (key, value) => {
    setSaved(false);
    setSettings({ ...settings, [key]: value });
  };
  const ready = keys.has_id && keys.has_secret;
  const maxValid =
    Number.isInteger(Number(settings?.max_payments)) &&
    settings?.max_payments >= 1 &&
    settings?.max_payments <= 36;

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'invoicingTitle']}
      description={t('invoicingDescription')}
    >
      <AdminGate need="billingManage" />
      {access.billingManage && settings && (
        <div className={classes.page}>
          <Alert severity="info">{t('invoicingIntro')}</Alert>

          <FormSection
            title={t('invoicingProvider')}
            description={t('invoicingProviderHelp')}
            icon={<ReceiptRoundedIcon />}
          >
            <div className={classes.grid}>
              <TextField select label={t('invoicingProviderName')} value="morning" disabled>
                <MenuItem value="morning">{t('invoicingMorning')}</MenuItem>
              </TextField>
              <TextField
                select
                label={t('invoicingEnvironment')}
                value={settings.environment}
                onChange={(event) => set('environment', event.target.value)}
              >
                <MenuItem value="production">{t('invoicingProduction')}</MenuItem>
                <MenuItem value="sandbox">{t('invoicingSandbox')}</MenuItem>
              </TextField>
              <FormControlLabel
                className={classes.wide}
                control={
                  <Switch
                    checked={settings.enabled}
                    onChange={(event) => set('enabled', event.target.checked)}
                    disabled={!ready && !settings.enabled}
                  />
                }
                label={t('invoicingEnabled')}
              />
              {!ready && (
                <Typography variant="body2" color="textSecondary" className={classes.wide}>
                  {t('invoicingNeedKeys')}
                </Typography>
              )}
            </div>
          </FormSection>

          <FormSection
            title={t('invoicingKeys')}
            description={t('invoicingKeysHelp')}
            icon={<KeyRoundedIcon />}
            actions={
              <Chip
                size="small"
                label={t(ready ? 'invoicingKeysSet' : 'invoicingKeysMissing')}
                color={ready ? 'success' : 'default'}
                variant="outlined"
              />
            }
          >
            <SecretField
              name="morning_id"
              label={t('invoicingKeyId')}
              isSet={keys.has_id}
              onSaved={loadKeys}
            />
            <SecretField
              name="morning_secret"
              label={t('invoicingKeySecret')}
              isSet={keys.has_secret}
              onSaved={loadKeys}
            />
            <ol className={classes.steps}>
              <li>{t('invoicingStep1')}</li>
              <li>{t('invoicingStep2')}</li>
              <li>{t('invoicingStep3')}</li>
            </ol>
          </FormSection>

          <FormSection
            title={t('invoicingClearing')}
            description={t('invoicingClearingHelp')}
            icon={<CreditCardRoundedIcon />}
          >
            <div className={classes.grid}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.clearing}
                    onChange={(event) => set('clearing', event.target.checked)}
                  />
                }
                label={t('invoicingClearingEnabled')}
              />
              <TextField
                type="number"
                label={t('invoicingMaxPayments')}
                value={settings.max_payments}
                error={!maxValid}
                onChange={(event) => set('max_payments', event.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 36, step: 1 } }}
              />
            </div>
          </FormSection>

          <div className={classes.row}>
            <Button variant="contained" onClick={save} disabled={!maxValid}>
              {t('sharedSave')}
            </Button>
            {saved && (
              <Typography role="status" variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {t('invoicingSaved')}
              </Typography>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default InvoicingPage;
