import { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { useManager } from '../../common/util/permissions';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { scheduleCalendar } from '../common/schedule';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  row: {
    display: 'flex',
    gap: theme.spacing(2),
    '& > *': {
      flex: 1,
    },
  },
}));

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// Email this report on a plain schedule (REP-08): every day or every week at an hour, to the
// user and, for managers, to other users too. The Traccar calendar behind it is made here.
// `initial` edits an existing schedule: { name, frequency, weekday, hour }.
const ScheduleDialog = ({ title, defaultName, initial, onSave, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const manager = useManager();
  const [values, setValues] = useState(() => ({
    name: initial?.name ?? defaultName ?? '',
    frequency: initial?.frequency ?? 'weekly',
    weekday: initial?.weekday ?? 0,
    hour: initial?.hour ?? 7,
  }));
  const [users, setUsers] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  useAsyncTask(
    async ({ signal }) => {
      if (manager && !initial) {
        const response = await fetchOrThrow('api/users', { signal });
        setUsers(await response.json());
      }
    },
    [manager, initial],
  );

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const ical = scheduleCalendar(values, timezone);
      await onSave({
        name: values.name.trim(),
        schedule: values,
        calendarData: window.btoa(ical),
        recipients: recipients.map((user) => user.id),
      });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            label={t('sharedName')}
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={values.frequency}
            onChange={(_, value) => value && set('frequency', value)}
            aria-label={t('reportScheduleFrequency')}
          >
            <ToggleButton value="daily">{t('reportScheduleDaily')}</ToggleButton>
            <ToggleButton value="weekly">{t('reportScheduleWeekly')}</ToggleButton>
          </ToggleButtonGroup>
          <div className={classes.row}>
            {values.frequency === 'weekly' && (
              <TextField
                select
                label={t('reportScheduleDay')}
                value={values.weekday}
                onChange={(event) => set('weekday', Number(event.target.value))}
              >
                {WEEKDAYS.map((day) => (
                  <MenuItem key={day} value={day}>
                    {t(`reportScheduleDay${day}`)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              label={t('reportScheduleHour')}
              value={values.hour}
              onChange={(event) => set('hour', Number(event.target.value))}
            >
              {HOURS.map((hour) => (
                <MenuItem key={hour} value={hour}>
                  <span dir="ltr">{`${String(hour).padStart(2, '0')}:00`}</span>
                </MenuItem>
              ))}
            </TextField>
          </div>
          <Alert severity="info">
            {t(
              values.frequency === 'weekly'
                ? 'reportScheduleCoversWeek'
                : 'reportScheduleCoversDay',
            )}
          </Alert>
          {users.length > 1 && (
            <Autocomplete
              multiple
              options={users}
              value={recipients}
              getOptionLabel={(user) => user.name || user.email}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, value) => setRecipients(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('reportScheduleRecipients')}
                  helperText={t('reportScheduleRecipientsHelp')}
                />
              )}
            />
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save} disabled={saving || !values.name.trim()}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleDialog;
