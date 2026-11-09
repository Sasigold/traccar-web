import { useReducer, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button, FormControlLabel, Paper, Switch, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PrivacyTipRoundedIcon from '@mui/icons-material/PrivacyTipRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetProfile } from '../../common/fleet/useFleet';
import { loadPrivacy } from '../../common/fleet/privacyData';
import { fleetActions } from '../../store';

const useStyles = makeStyles()((theme) => ({
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
  notice: {
    maxHeight: 220,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    padding: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
  },
}));

// The driver's side of privacy (ISR-03): read and agree to the notice, and turn "private" on for
// personal use of the vehicle. Both are recorded with the time.
const DriverPrivacyCard = ({ driverId, hasVehicle }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const profile = useFleetProfile();
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [data, setData] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    const client = getFleetClient();
    const [policy, notice, consents, open] = await Promise.all([
      client.from('privacy_policies').select('allow_private_switch').maybeSingle(),
      client
        .from('privacy_notices')
        .select('version, body, published_at')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('privacy_consents')
        .select('notice_version, consented_at')
        .eq('driver_id', driverId),
      client
        .from('privacy_private_periods')
        .select('started_at')
        .eq('driver_id', driverId)
        .is('ended_at', null)
        .maybeSingle(),
    ]);
    if (policy.error || notice.error) {
      setData(null); // privacy tables not there yet
      return;
    }
    setData({
      allowSwitch: policy.data?.allow_private_switch ?? true,
      notice: notice.data,
      consent: (consents.data || []).find((row) => row.notice_version === notice.data?.version),
      open: open.data,
    });
  }, [driverId, reloadKey]);

  const agree = useCatch(async () => {
    unwrap(
      await getFleetClient().from('privacy_consents').insert({
        org_id: profile.org_id,
        driver_id: driverId,
        notice_version: data.notice.version,
        method: 'portal',
      }),
    );
    reload();
  });

  const toggle = useCatch(async (on) => {
    unwrap(await getFleetClient().rpc('privacy_private_set', { p_on: on }));
    reload();
    // The live map follows at once rather than at the next refresh.
    const now = Date.now();
    dispatch(fleetActions.privacy(await loadPrivacy(now - 24 * 60 * 60 * 1000, now + 60000)));
  });

  if (!data) {
    return null;
  }

  return (
    <Paper elevation={0} className={classes.card}>
      <div className={classes.head}>
        <PrivacyTipRoundedIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700} component="h2">
          {t('privacyDriverTitle')}
        </Typography>
      </div>
      {data.notice && !data.consent && (
        <>
          <Typography variant="body2">{t('privacyDriverNoticeIntro')}</Typography>
          <div className={classes.notice} tabIndex={0} role="document">
            <Typography variant="body2">{data.notice.body}</Typography>
          </div>
          <Button variant="outlined" onClick={agree}>
            {t('privacyDriverAgree')}
          </Button>
        </>
      )}
      {data.consent && (
        <Typography variant="body2" color="textSecondary">
          {t('privacyDriverAgreed')
            .replace('{0}', data.notice.version)
            .replace('{1}', formatTime(data.consent.consented_at, 'date'))}
        </Typography>
      )}
      {data.allowSwitch && (
        <>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(data.open)}
                onChange={(event) => toggle(event.target.checked)}
                disabled={!data.open && !hasVehicle}
              />
            }
            label={t('privacyDriverSwitch')}
          />
          <Typography variant="body2" color="textSecondary">
            {data.open
              ? t('privacyDriverSwitchOn').replace(
                  '{0}',
                  formatTime(data.open.started_at, 'minutes'),
                )
              : t('privacyDriverSwitchHelp')}
          </Typography>
        </>
      )}
    </Paper>
  );
};

export default DriverPrivacyCard;
