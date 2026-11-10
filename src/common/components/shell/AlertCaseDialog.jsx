import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTranslation } from '../LocalizationProvider';
import { useCatch } from '../../../reactHelper';
import { getFleetClient, unwrap } from '../../fleet/client';
import { useFleetQuery, useInvalidateFleet } from '../../data/fleetQuery';
import { CASE_STATUSES, caseRow } from '../../fleet/alertCases';
import { formatNotificationTitle, formatTime } from '../../util/formatter';

const statusKey = (status) =>
  ({ new: 'alertCaseNew', in_progress: 'alertCaseInProgress', closed: 'alertCaseClosed' })[status];

// LIV-24: one alert's handling: its status, who handles it and the notes, in one place.
const AlertCaseDialog = ({ event, alertCase, people, onClose }) => {
  const t = useTranslation();
  const invalidate = useInvalidateFleet();
  const profile = useSelector((state) => state.fleet.profile);
  const device = useSelector((state) => state.devices.items[event.deviceId]);
  const [note, setNote] = useState('');

  const { data: notes } = useFleetQuery(
    'alert_case_notes',
    [alertCase?.id ?? null],
    (client) =>
      client.from('alert_case_notes').select('*').eq('case_id', alertCase.id).order('created_at'),
    { enabled: Boolean(alertCase?.id) },
  );

  const nameOf = (id) => people.find((person) => person.id === id)?.full_name || '—';

  // The case is created the first time anything changes on the alert.
  const save = async (changes) => {
    const row = {
      ...caseRow(event, profile.org_id, alertCase?.status || 'new', alertCase?.assigned_to),
      ...changes,
    };
    const saved = unwrap(
      await getFleetClient()
        .from('alert_cases')
        .upsert(row, { onConflict: 'org_id,traccar_event_id' })
        .select('*')
        .single(),
    );
    invalidate('alert_cases');
    return saved;
  };

  const setStatus = useCatch(async (status) => {
    if (status) await save({ status });
  });
  const setAssignee = useCatch(async (assignedTo) => save({ assigned_to: assignedTo || null }));
  const addNote = useCatch(async () => {
    const body = note.trim();
    if (!body) return;
    const saved = alertCase?.id ? alertCase : await save({});
    unwrap(
      await getFleetClient()
        .from('alert_case_notes')
        .insert({ org_id: profile.org_id, case_id: saved.id, body }),
    );
    setNote('');
    invalidate('alert_case_notes');
  });

  const title = formatNotificationTitle(t, {
    type: event.type,
    attributes: { alarms: event.attributes?.alarm },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{[title, device?.name].filter(Boolean).join(' · ')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="textSecondary">
            {formatTime(event.eventTime, 'minutes')}
            {alertCase?.taken_at &&
              ` · ${t('alertCaseTakenAfter').replace(
                '{0}',
                Math.max(0, dayjs(alertCase.taken_at).diff(dayjs(event.eventTime), 'minute')),
              )}`}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={alertCase?.status || 'new'}
            onChange={(_, value) => setStatus(value)}
            aria-label={t('alertCaseStatus')}
          >
            {CASE_STATUSES.map((status) => (
              <ToggleButton key={status} value={status}>
                {t(statusKey(status))}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <FormControl size="small">
            <InputLabel id="alert-case-assignee">{t('alertCaseAssignee')}</InputLabel>
            <Select
              labelId="alert-case-assignee"
              label={t('alertCaseAssignee')}
              value={alertCase?.assigned_to || ''}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <MenuItem value="">{t('alertCaseNobody')}</MenuItem>
              {people.map((person) => (
                <MenuItem key={person.id} value={person.id}>
                  {person.full_name || '—'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <div>
            <Typography variant="subtitle2">{t('alertCaseNotes')}</Typography>
            {notes?.length ? (
              <List dense disablePadding>
                {notes.map((item) => (
                  <ListItem key={item.id} disableGutters>
                    <ListItemText
                      primary={item.body}
                      secondary={`${nameOf(item.created_by)} · ${formatTime(item.created_at, 'minutes')}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="textSecondary">
                {t('alertCaseNoNotes')}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small"
                fullWidth
                label={t('alertCaseAddNote')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
              <Button onClick={addNote} disabled={!note.trim()}>
                {t('sharedAdd')}
              </Button>
            </Stack>
          </div>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button component={RouterLink} to="/fleet/alerts/response" onClick={onClose}>
          {t('alertResponseTitle')}
        </Button>
        <Button onClick={onClose}>{t('sharedClose')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlertCaseDialog;
