import { useMemo, useReducer, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatGrouped, formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { eventCategory } from '../../common/fleet/safety';
import {
  DISPUTE_REASONS,
  disputeState,
  myDriving,
  scoreCard,
} from '../../common/fleet/driverScore';
import { capitalize, pascalCase } from '../../common/util/stringUtils';
import { keepOnBackdrop } from '../../common/util/formDialog';
import { loadDriving } from '../safetyData';

const DAYS = 30;
const SHOWN_EVENTS = 10;

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
  figures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1),
  },
  figure: {
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
    minWidth: 0,
    '& .MuiTypography-caption': {
      color: theme.palette.surface.textSecondaryOnTint,
    },
  },
  value: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  event: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    paddingBlock: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '&:last-of-type': {
      borderBottom: 'none',
    },
  },
  plate: {
    whiteSpace: 'nowrap',
    display: 'inline-block',
  },
  eventText: {
    flex: 1,
    minWidth: 160,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

const stateColor = { waiting: 'info', accepted: 'success', rejected: 'default' };

// SAF-05, SEC-23: the driver's own score: what is counted about them, and "I disagree".
const DriverScoreCard = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [data, setData] = useState(null);
  const [disputing, setDisputing] = useState(null);
  const [reason, setReason] = useState('device_error');
  const [note, setNote] = useState('');
  const [now] = useState(() => Date.now());

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      const to = new Date();
      const from = new Date(to.getTime() - DAYS * 86400000);
      const client = getFleetClient();
      const periods = await client.rpc('driver_my_periods', { p_from: from.toISOString() });
      if (periods.error) {
        setData(null); // the migration is not installed yet
        return;
      }
      const rows = periods.data || [];
      const deviceIds = [...new Set(rows.map((row) => row.traccar_device_id))];
      const [driving, reviews] = await Promise.all([
        loadDriving(deviceIds, from, to, signal),
        client
          .from('safety_event_reviews')
          .select('traccar_event_id, disputed_at, dispute_result, dispute_reason')
          .not('disputed_at', 'is', null),
      ]);
      const plates = Object.fromEntries(
        rows.map((row) => [row.traccar_device_id, row.plate_number]),
      );
      setData({
        mine: myDriving(driving.trips, driving.events, rows),
        reviews: new Map((reviews.data || []).map((row) => [Number(row.traccar_event_id), row])),
        plates,
        hasPeriods: rows.length > 0,
      });
    },
    [reloadKey],
  );

  const card = useMemo(() => {
    if (!data) return null;
    const excluded = new Set(
      [...data.reviews.values()]
        .filter((row) => row.dispute_result === 'accepted')
        .map((row) => Number(row.traccar_event_id)),
    );
    return scoreCard(data.mine, { now, excluded });
  }, [data, now]);

  const send = useCatch(async () => {
    unwrap(
      await getFleetClient().rpc('safety_driver_dispute', {
        p_event: disputing.id,
        p_device: disputing.deviceId,
        p_category: eventCategory(disputing),
        p_occurred_at: disputing.eventTime,
        p_reason: reason,
        p_note: note.trim() || null,
      }),
    );
    setDisputing(null);
    setNote('');
    reload();
  });

  if (!data || !data.hasPeriods) {
    return null;
  }

  const events = [...data.mine.events]
    .sort((a, b) => Date.parse(b.eventTime) - Date.parse(a.eventTime))
    .slice(0, SHOWN_EVENTS);

  return (
    <Paper elevation={0} className={classes.card}>
      <div className={classes.head}>
        <SpeedRoundedIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700} component="h2">
          {t('driverScoreTitle')}
        </Typography>
      </div>
      <div className={classes.figures}>
        <div className={classes.figure}>
          <Typography variant="caption">{t('driverScoreWeek')}</Typography>
          <div className={classes.value}>{card.score ?? '—'}</div>
        </div>
        <div className={classes.figure}>
          <Typography variant="caption">{t('driverScoreKm')}</Typography>
          <div className={classes.value}>{formatGrouped(card.km, 0)}</div>
        </div>
        <div className={classes.figure}>
          <Typography variant="caption">{t('driverScoreStreak')}</Typography>
          <div className={classes.value}>{card.streak}</div>
        </div>
      </div>
      {card.score == null && <Typography variant="body2">{t('driverScoreTooLittle')}</Typography>}
      {card.badges.length > 0 && (
        <div className={classes.badges}>
          {card.badges.map((badge) => (
            <Chip
              key={badge}
              icon={<EmojiEventsRoundedIcon />}
              variant="outlined"
              label={t(`driverBadge${capitalize(badge)}`)}
            />
          ))}
        </div>
      )}

      <Typography variant="subtitle2" component="h3">
        {t('driverScoreEvents').replace('{0}', String(DAYS))}
      </Typography>
      {events.length === 0 && <Typography variant="body2">{t('driverScoreNoEvents')}</Typography>}
      {events.map((event) => {
        const state = disputeState(data.reviews.get(Number(event.id)));
        return (
          <div key={event.id} className={classes.event}>
            <div className={classes.eventText}>
              <Typography variant="body2" fontWeight={600}>
                {t(`fleetSafetyEvent${capitalize(eventCategory(event))}`)}
              </Typography>
              <Typography variant="body2">
                {formatTime(event.eventTime, 'minutes')}
                {data.plates[event.deviceId] && (
                  <>
                    {' · '}
                    <span dir="ltr" className={classes.plate}>
                      {data.plates[event.deviceId]}
                    </span>
                  </>
                )}
              </Typography>
            </div>
            {state === 'none' ? (
              <Button variant="outlined" onClick={() => setDisputing(event)}>
                {t('driverDispute')}
              </Button>
            ) : (
              <Chip
                color={stateColor[state]}
                label={t(`driverDispute${capitalize(state)}`)}
                variant={state === 'rejected' ? 'outlined' : 'filled'}
              />
            )}
          </div>
        );
      })}
      <Typography variant="caption" color="textSecondary">
        {t('driverScoreTransparency')}
      </Typography>

      <Dialog
        open={Boolean(disputing)}
        onClose={keepOnBackdrop(() => setDisputing(null))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t('driverDispute')}</DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            {disputing && (
              <DialogContentText>
                {`${t(`fleetSafetyEvent${capitalize(eventCategory(disputing))}`)} · ${formatTime(
                  disputing.eventTime,
                  'minutes',
                )}`}
              </DialogContentText>
            )}
            <RadioGroup
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-label={t('driverDisputeReason')}
            >
              {DISPUTE_REASONS.map((key) => (
                <FormControlLabel
                  key={key}
                  value={key}
                  control={<Radio />}
                  label={t(`driverDisputeReason${pascalCase(key)}`)}
                />
              ))}
            </RadioGroup>
            <TextField
              label={t('driverDisputeNote')}
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
              multiline
              minRows={2}
              helperText={t('driverDisputeHelp')}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisputing(null)}>{t('sharedCancel')}</Button>
          <Button variant="contained" onClick={send}>
            {t('driverDisputeSend')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default DriverScoreCard;
