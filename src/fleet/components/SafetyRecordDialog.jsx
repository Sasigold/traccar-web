import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FileInput from '../../common/components/FileInput';
import { useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetProfile } from '../../common/fleet/useFleet';
import { ensureDriver, uploadFleetFile } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (date, months) => {
  const value = new Date(`${date}T00:00:00`);
  value.setMonth(value.getMonth() + months);
  return value.toISOString().slice(0, 10);
};

// Training, license check or safety review for one driver (roadmap 4.1 / 4.7).
// kind: training | check | review
const SafetyRecordDialog = ({ kind, driver: initialDriver, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const drivers = useSelector((state) => state.drivers.items);
  const [driverId, setDriverId] = useState(initialDriver ? String(initialDriver.id) : '');
  const [form, setForm] = useState(() => ({
    date: today(),
    topic: '',
    hours: '',
    trainer: '',
    valid_until: '',
    license_valid: true,
    findings: '',
    recommendation: '',
    review_kind: 'conversation',
    summary: '',
    decisions: '',
    follow_up_at: '',
  }));
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const nullable = (value) => (value === '' ? null : value);

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const driver = Object.values(drivers).find((item) => String(item.id) === driverId);
      const base = { org_id: profile.org_id, driver_id: await ensureDriver(driver, profile) };
      const client = getFleetClient();
      if (kind === 'training') {
        unwrap(
          await client.from('driver_trainings').insert({
            ...base,
            topic: form.topic.trim(),
            held_at: form.date,
            hours: nullable(form.hours),
            trainer: nullable(form.trainer.trim()),
            valid_until: nullable(form.valid_until),
            certificate_path: file ? await uploadFleetFile(profile.org_id, 'safety', file) : null,
            signed_at: new Date().toISOString(),
            created_by: profile.id,
          }),
        );
      } else if (kind === 'check') {
        unwrap(
          await client.from('driver_license_checks').insert({
            ...base,
            checked_at: form.date,
            license_valid: form.license_valid,
            findings: nullable(form.findings.trim()),
            recommendation: nullable(form.recommendation.trim()),
            next_check_at: addMonths(form.date, 6),
            checked_by: profile.id,
          }),
        );
      } else {
        unwrap(
          await client.from('safety_reviews').insert({
            ...base,
            kind: form.review_kind,
            held_at: form.date,
            summary: nullable(form.summary.trim()),
            decisions: nullable(form.decisions.trim()),
            follow_up_at: nullable(form.follow_up_at),
            reviewer_id: profile.id,
            signed_at: new Date().toISOString(),
          }),
        );
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  });

  const valid = driverId && form.date && (kind !== 'training' || form.topic.trim());
  const dateProps = { type: 'date', slotProps: { inputLabel: { shrink: true } } };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(`fleetSafetyAdd${kind.replace(/^\w/, (c) => c.toUpperCase())}`)}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            select
            label={t('sharedDriver')}
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
            disabled={Boolean(initialDriver)}
          >
            {Object.values(drivers)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((driver) => (
                <MenuItem key={driver.id} value={String(driver.id)}>
                  {driver.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            label={t('fleetExpenseDate')}
            value={form.date}
            onChange={set('date')}
            {...dateProps}
          />
          {kind === 'training' && (
            <>
              <TextField
                label={t('fleetTrainingTopic')}
                value={form.topic}
                onChange={set('topic')}
              />
              <TextField
                type="number"
                label={t('fleetTrainingHours')}
                value={form.hours}
                onChange={set('hours')}
                slotProps={{ htmlInput: { dir: 'ltr', step: 'any' } }}
              />
              <TextField
                label={t('fleetTrainingTrainer')}
                value={form.trainer}
                onChange={set('trainer')}
              />
              <TextField
                label={t('fleetTrainingValidUntil')}
                value={form.valid_until}
                onChange={set('valid_until')}
                {...dateProps}
              />
              <FileInput
                placeholder={t('fleetTrainingCertificate')}
                value={file}
                onChange={setFile}
                slotProps={{ htmlInput: { accept: 'image/*,application/pdf' } }}
              />
            </>
          )}
          {kind === 'check' && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.license_valid}
                    onChange={(event) => setForm({ ...form, license_valid: event.target.checked })}
                  />
                }
                label={t('fleetCheckLicenseValid')}
              />
              <TextField
                label={t('fleetCheckFindings')}
                value={form.findings}
                onChange={set('findings')}
                multiline
                minRows={2}
              />
              <TextField
                label={t('fleetCheckRecommendation')}
                value={form.recommendation}
                onChange={set('recommendation')}
                multiline
                minRows={2}
              />
            </>
          )}
          {kind === 'review' && (
            <>
              <TextField
                select
                label={t('sharedType')}
                value={form.review_kind}
                onChange={set('review_kind')}
              >
                {['conversation', 'investigation', 'periodic'].map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`fleetReviewKind${value.replace(/^\w/, (c) => c.toUpperCase())}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('fleetReviewSummary')}
                value={form.summary}
                onChange={set('summary')}
                multiline
                minRows={3}
              />
              <TextField
                label={t('fleetReviewDecisions')}
                value={form.decisions}
                onChange={set('decisions')}
                multiline
                minRows={2}
              />
              <TextField
                label={t('fleetReviewFollowUp')}
                value={form.follow_up_at}
                onChange={set('follow_up_at')}
                {...dateProps}
              />
            </>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={saving || !valid}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SafetyRecordDialog;
