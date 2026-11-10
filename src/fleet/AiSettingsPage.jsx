import { useReducer, useState } from 'react';
import { Alert, Button, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import FormSection from '../settings/components/FormSection';
import { useAsyncTask, useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { loadAiStatus } from '../common/fleet/ai';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { useAdministrator } from '../common/util/permissions';
import FleetNotice from './components/FleetNotice';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 520,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
}));

// AI (AI-01..04) for the organization: on or off, a daily limit of model calls, today's use,
// and for the service administrator the key, which goes straight to Vault.
const AiSettingsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const canManage = useFleetPermission('users.manage');
  const administrator = useAdministrator();
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [status, setStatus] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [limit, setLimit] = useState('200');
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useAsyncTask(async () => {
    void reloadKey;
    const value = await loadAiStatus();
    setStatus(value);
    if (value) {
      setEnabled(value.enabled);
      setLimit(String(value.daily_limit));
    }
  }, [reloadKey]);

  const limitValue = Number(limit);
  const limitValid = Number.isInteger(limitValue) && limitValue >= 0 && limitValue <= 10000;

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient().from('ai_settings').upsert({
        org_id: profile.org_id,
        enabled,
        daily_limit: limitValue,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      }),
    );
    setSaved(true);
    reload();
  });

  const saveKey = useCatch(async () => {
    unwrap(await getFleetClient().rpc('ai_set_secret', { p_secret: key.trim() }));
    setKey('');
    reload();
  });

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'aiSettingsPage']}
      description={t('aiSettingsDescription')}
    >
      <FleetNotice permission="users.manage" />
      {status && (
        <FormSection title={t('aiSettingsPage')} icon={<AutoAwesomeRoundedIcon />}>
          <div className={classes.form}>
            {!status.ready && <Alert severity="info">{t('aiErrorNotConfigured')}</Alert>}
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(event) => {
                    setEnabled(event.target.checked);
                    setSaved(false);
                  }}
                  disabled={!canManage}
                />
              }
              label={t('aiSettingsEnabled')}
            />
            <Typography variant="body2" color="textSecondary">
              {t('aiSettingsSends')}
            </Typography>
            <div className={classes.row}>
              <TextField
                type="number"
                label={t('aiSettingsLimit')}
                value={limit}
                onChange={(event) => {
                  setLimit(event.target.value);
                  setSaved(false);
                }}
                error={!limitValid}
                helperText={t('aiSettingsLimitHelp')}
                disabled={!canManage || !enabled}
                slotProps={{ htmlInput: { min: 0, max: 10000, dir: 'ltr', inputMode: 'numeric' } }}
              />
              <Typography role="status">
                {t('aiSettingsUsed')
                  .replace('{0}', status.used_today)
                  .replace('{1}', status.daily_limit)}
              </Typography>
            </div>
            {canManage && (
              <div className={classes.row}>
                <Button variant="contained" onClick={save} disabled={!limitValid}>
                  {t('sharedSave')}
                </Button>
                {saved && (
                  <Typography color="textSecondary" role="status">
                    {t('sharedSaved')}
                  </Typography>
                )}
              </div>
            )}
          </div>
        </FormSection>
      )}
      {administrator && (
        <FormSection
          title={t('aiSettingsKey')}
          description={t('aiSettingsKeyHelp')}
          icon={<KeyRoundedIcon />}
        >
          <div className={classes.row}>
            <TextField
              type="password"
              label={t('aiSettingsKey')}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="off"
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
            <Button variant="outlined" onClick={saveKey} disabled={!key.trim()}>
              {t('aiSettingsKeySave')}
            </Button>
            {status?.ready && (
              <Typography color="textSecondary">{t('aiSettingsKeySet')}</Typography>
            )}
          </div>
        </FormSection>
      )}
    </PageLayout>
  );
};

export default AiSettingsPage;
