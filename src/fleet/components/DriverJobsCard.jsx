import { useReducer, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import dayjs from 'dayjs';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { formatTime } from '../../common/util/formatter';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../../common/fleet/useFleet';
import { driverNextStatuses } from '../../common/fleet/dispatch';
import { uploadFleetFile } from '../fleetData';
import { JobStatusChip, jobKey } from '../DispatchPage';
import { wazeUrl } from '../../common/util/waze';

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

  const save = useCatch(async () => {
    const values = { status, proof_name: name.trim() || null, notes: notes.trim() || null };
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
          disabled={status === 'done' && !name.trim() && !photo}
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
    reload();
  });

  if (!canRead) {
    return null;
  }

  return (
    <Paper elevation={0} className={classes.card}>
      <div className={classes.head}>
        <LocalShippingRoundedIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700}>
          {t('fleetDriverPortalMyJobs')}
        </Typography>
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
