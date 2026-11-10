import { useEffect, useReducer, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Tooltip,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import dayjs from 'dayjs';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../../common/fleet/useFleet';
import { FAILURE_REASONS, driverNextStatuses } from '../../common/fleet/dispatch';
import { uploadFleetFile } from '../fleetData';
import { JobStatusChip, jobKey } from '../DispatchPage';
import { wazeUrl } from '../../common/util/waze';

const REFRESH_MS = 60000;

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
  grow: {
    flex: 1,
  },
  job: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    paddingBlock: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '&:last-of-type': {
      borderBottom: 'none',
    },
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  buttons: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

const navigationLink = (job) => wazeUrl(job);

// Proof of delivery: who received it, and an optional photo.
const ProofDialog = ({ job, status, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [notes, setNotes] = useState(job.notes || '');
  // ADM-20: a failed job says why, with one tap.
  const [reason, setReason] = useState(null);

  const save = useCatch(async () => {
    const values = { status, proof_name: name.trim() || null, notes: notes.trim() || null };
    if (status === 'failed') {
      values.failure_reason = reason;
    }
    if (photo) {
      values.proof_photo_path = await uploadFleetFile(profile.org_id, 'dispatch', photo);
    }
    unwrap(await getFleetClient().from('dispatch_jobs').update(values).eq('id', job.id));
    onSaved();
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(jobKey('Status', status))}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          {status === 'failed' && (
            <div className={classes.buttons} role="group" aria-label={t('fleetJobFailureReason')}>
              {FAILURE_REASONS.map((value) => (
                <Chip
                  key={value}
                  label={t(jobKey('Failure', value))}
                  color={reason === value ? 'primary' : 'default'}
                  variant={reason === value ? 'filled' : 'outlined'}
                  onClick={() => setReason(value)}
                />
              ))}
            </div>
          )}
          {status === 'done' && (
            <TextField
              label={t('fleetJobProofName')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
          <TextField
            label={t('fleetNotes')}
            value={notes}
            multiline
            minRows={2}
            onChange={(event) => setNotes(event.target.value)}
          />
          <Button variant="outlined" component="label">
            {photo ? photo.name : t('fleetJobProofPhoto')}
            <input
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setPhoto(event.target.files?.[0] || null)}
            />
          </Button>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={
            (status === 'done' && !name.trim() && !photo) || (status === 'failed' && !reason)
          }
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Roadmap stage 5: today's jobs in the driver portal, moved forward by the driver.
const DriverJobsCard = ({ driverId }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const canRead = useFleetPermission('dispatch.read');
  const [jobs, setJobs] = useState(null);
  const [proof, setProof] = useState(null);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [undo, setUndo] = useState(null);

  // ADM-22: new jobs show up without a manual refresh: every minute, and when the app is
  // opened again.
  useEffect(() => {
    if (!canRead || !driverId) return undefined;
    const timer = setInterval(reload, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [canRead, driverId]);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead || !driverId) {
      return;
    }
    setJobs(
      unwrap(
        await getFleetClient()
          .from('dispatch_jobs')
          .select('*')
          .eq('driver_id', driverId)
          .in('status', ['planned', 'assigned', 'en_route', 'arrived'])
          .lte('scheduled_at', dayjs().endOf('day').toISOString())
          .order('scheduled_at'),
      ) || [],
    );
  }, [canRead, driverId, reloadKey]);

  const move = useCatch(async (job, status) => {
    if (status === 'done' || status === 'failed') {
      setProof({ job, status });
      return;
    }
    unwrap(await getFleetClient().from('dispatch_jobs').update({ status }).eq('id', job.id));
    // ADM-22: a wrong tap can be taken back for five seconds.
    setUndo({ job, previous: job.status, status });
    reload();
  });

  const takeBack = useCatch(async () => {
    const { job, previous } = undo;
    setUndo(null);
    unwrap(
      await getFleetClient().from('dispatch_jobs').update({ status: previous }).eq('id', job.id),
    );
    reload();
  });

  if (!canRead) {
    return null;
  }

  return (
    <Paper elevation={0} className={classes.card}>
      <div className={classes.head}>
        <LocalShippingRoundedIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700} className={classes.grow}>
          {t('fleetDriverPortalMyJobs')}
        </Typography>
        <Tooltip title={t('sharedRefresh')}>
          <IconButton aria-label={t('sharedRefresh')} onClick={reload}>
            <RefreshRoundedIcon />
          </IconButton>
        </Tooltip>
      </div>
      {jobs && jobs.length === 0 && (
        <Typography color="textSecondary">{t('fleetJobsNone')}</Typography>
      )}
      {(jobs || []).map((job) => {
        const navigate = navigationLink(job);
        return (
          <div key={job.id} className={classes.job}>
            <div className={classes.row}>
              <Typography variant="body1" fontWeight={600}>
                {job.title}
              </Typography>
              <JobStatusChip status={job.status} />
            </div>
            <Typography variant="body2" color="textSecondary">
              {[
                job.scheduled_at && formatTime(job.scheduled_at, 'minutes'),
                job.customer_name,
                job.address,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
            <div className={classes.buttons}>
              {driverNextStatuses(job.status).map((status, index) => (
                <Button
                  key={status}
                  size="small"
                  variant={index === 0 ? 'contained' : 'outlined'}
                  onClick={() => move(job, status)}
                >
                  {t(jobKey('Action', status))}
                </Button>
              ))}
              {navigate && (
                <Button
                  size="small"
                  variant="outlined"
                  href={navigate}
                  target="_blank"
                  rel="noopener"
                  startIcon={<NavigationRoundedIcon />}
                >
                  {t('fleetJobNavigate')}
                </Button>
              )}
              {job.customer_phone && (
                <Button size="small" variant="text" href={`tel:${job.customer_phone}`}>
                  <span dir="ltr">{job.customer_phone}</span>
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <Snackbar
        open={Boolean(undo)}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== 'clickaway' && setUndo(null)}
        message={undo ? t('driverJobMoved').replace('{0}', t(jobKey('Status', undo.status))) : ''}
        action={
          <Button color="inherit" size="small" onClick={takeBack}>
            {t('sharedUndo')}
          </Button>
        }
      />
      {proof && (
        <ProofDialog
          job={proof.job}
          status={proof.status}
          onClose={() => setProof(null)}
          onSaved={() => {
            setProof(null);
            reload();
          }}
        />
      )}
    </Paper>
  );
};

export default DriverJobsCard;
