import { useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button, FormControlLabel, Paper, Radio, RadioGroup, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { formatTime } from '../../common/util/formatter';
import { DRIVER_ANSWERS } from '../../common/fleet/safetyInbox';
import { capitalize, pascalCase } from '../../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  card: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  event: {
    padding: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
}));

const answerKey = (answer) => `safetyAnswer${pascalCase(answer)}`;

// SAF-01: events the manager sent to the driver for a 30-second self-review: what happened,
// one question, "understood". Only the driver's own events are readable here.
const DriverSelfReviewCard = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [events, setEvents] = useState([]);
  const [answers, setAnswers] = useState({});

  useAsyncTask(async () => {
    void reloadKey;
    const { data } = await getFleetClient()
      .from('safety_event_reviews')
      .select('id, category, occurred_at, traccar_device_id, note')
      .eq('self_review', true)
      .is('driver_ack_at', null)
      .order('occurred_at', { ascending: false });
    setEvents(data || []);
  }, [reloadKey]);

  const acknowledge = useCatch(async (id) => {
    unwrap(await getFleetClient().rpc('safety_driver_ack', { p_id: id, p_answer: answers[id] }));
    reload();
  });

  if (!events.length) return null;

  return (
    <Paper elevation={0} className={classes.card}>
      <Typography variant="subtitle1" fontWeight={700} component="h2">
        {t('safetySelfReviewTitle').replace('{0}', events.length)}
      </Typography>
      {events.map((event) => (
        <div key={event.id} className={classes.event}>
          <Typography fontWeight={600}>
            {t(`fleetSafetyEvent${capitalize(event.category)}`)}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {formatTime(event.occurred_at, 'minutes')}
            {devices[event.traccar_device_id] && ` · ${devices[event.traccar_device_id].name}`}
          </Typography>
          {event.note && <Typography variant="body2">{event.note}</Typography>}
          <RadioGroup
            aria-label={t('safetySelfReviewQuestion')}
            value={answers[event.id] || ''}
            onChange={(change) => setAnswers({ ...answers, [event.id]: change.target.value })}
          >
            <Typography variant="body2" fontWeight={600}>
              {t('safetySelfReviewQuestion')}
            </Typography>
            {DRIVER_ANSWERS.map((answer) => (
              <FormControlLabel
                key={answer}
                value={answer}
                control={<Radio size="small" />}
                label={t(answerKey(answer))}
              />
            ))}
          </RadioGroup>
          <Button
            variant="outlined"
            disabled={!answers[event.id]}
            onClick={() => acknowledge(event.id)}
          >
            {t('safetySelfReviewDone')}
          </Button>
        </div>
      ))}
    </Paper>
  );
};

export default DriverSelfReviewCard;
