import { useReducer, useState } from 'react';
import { Button, Paper, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { openFleetFile } from '../fleetData';
import { capitalize } from '../../common/util/stringUtils';

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
  meeting: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
  },
  text: {
    whiteSpace: 'pre-wrap',
  },
  sign: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
    '& .MuiTextField-root': {
      flex: 1,
    },
  },
  line: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
}));

// One meeting waiting for the driver's signature: the summary, then their typed name.
const MeetingToSign = ({ review, onSigned }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [name, setName] = useState('');

  const sign = useCatch(async () => {
    unwrap(await getFleetClient().rpc('safety_review_sign', { p_id: review.id, p_name: name }));
    onSigned();
  });

  return (
    <div className={classes.meeting}>
      <Typography variant="body2" fontWeight={600}>
        {t(`fleetReviewKind${capitalize(review.kind)}`)} · {formatTime(review.held_at, 'date')}
      </Typography>
      {review.summary && (
        <Typography variant="body2" className={classes.text}>
          {review.summary}
        </Typography>
      )}
      {review.decisions && (
        <Typography variant="body2" className={classes.text}>
          {`${t('fleetReviewDecisions')}: ${review.decisions}`}
        </Typography>
      )}
      <div className={classes.sign}>
        <TextField
          size="small"
          label={t('safetySignName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
        />
        <Button variant="outlined" onClick={sign} disabled={name.trim().length < 2}>
          {t('safetySign')}
        </Button>
      </div>
    </div>
  );
};

// The driver's side of the safety officer's work (ISR-04): meetings to sign and the procedures.
const DriverSafetyCard = ({ driverId }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [reloadKey, reload] = useReducer((key) => key + 1, 0);
  const [data, setData] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    const client = getFleetClient();
    const [reviews, procedures] = await Promise.all([
      client
        .from('safety_reviews')
        .select('id, kind, held_at, summary, decisions')
        .eq('driver_id', driverId)
        .is('driver_signed_at', null)
        .in('kind', ['periodic', 'conversation'])
        .order('held_at', { ascending: false }),
      client.from('safety_procedures').select('id, title, version, document_path').order('title'),
    ]);
    if (reviews.error || procedures.error) {
      setData(null); // the stage is not installed yet
      return;
    }
    setData({ reviews: reviews.data || [], procedures: procedures.data || [] });
  }, [driverId, reloadKey]);

  if (!data || (!data.reviews.length && !data.procedures.length)) {
    return null;
  }

  return (
    <Paper elevation={0} className={classes.card}>
      <div className={classes.head}>
        <HealthAndSafetyRoundedIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700} component="h2">
          {t('safetyDriverTitle')}
        </Typography>
      </div>
      {data.reviews.length > 0 && (
        <>
          <Typography variant="body2">{t('safetyDriverToSign')}</Typography>
          {data.reviews.map((review) => (
            <MeetingToSign key={review.id} review={review} onSigned={reload} />
          ))}
        </>
      )}
      {data.procedures.map((procedure) => (
        <div key={procedure.id} className={classes.line}>
          <Typography variant="body2">
            {procedure.title}
            {procedure.version && ` · ${procedure.version}`}
          </Typography>
          {procedure.document_path && (
            <Button size="small" onClick={() => openFleetFile(procedure.document_path)}>
              {t('safetyProcedureOpen')}
            </Button>
          )}
        </div>
      ))}
    </Paper>
  );
};

export default DriverSafetyCard;
