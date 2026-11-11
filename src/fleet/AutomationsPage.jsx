import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AutoModeRoundedIcon from '@mui/icons-material/AutoModeRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { useInvalidateFleet } from '../common/data/fleetQuery';
import { keepOnBackdrop } from '../common/util/formDialog';
import { TEMPLATES, backtest, sentence } from '../common/fleet/automations';
import FleetNotice from './components/FleetNotice';
import { useFleetRows } from './fleetRows';

const DAY = 86400000;

// The last 7 days of what a template reads: trips, stops or events, for every vehicle.
const loadWeek = async (source, deviceIds) => {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * DAY);
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  deviceIds.forEach((id) => query.append('deviceId', id));
  if (source === 'events') query.append('type', 'allEvents');
  const response = await fetchOrThrow(`api/reports/${source}?${query}`, {
    headers: { Accept: 'application/json' },
  });
  return response.json();
};

const useSentence = () => {
  const t = useTranslation();
  const geofences = useSelector((state) => state.geofences.items);
  return (rule) => {
    const { key, values } = sentence(rule, { geofence: (id) => geofences[id]?.name });
    return values.reduce((text, value, index) => text.replace(`{${index}}`, value), t(key));
  };
};

const RuleDialog = ({ onClose, onSaved, initial = null }) => {
  const t = useTranslation();
  const profile = useFleetProfile();
  const describe = useSentence();
  const devices = useSelector((state) => state.devices.items);
  const geofences = useSelector((state) => state.geofences.items);
  // LIV-24: an alert in the alert center can open this with its kind already chosen.
  const start = initial && TEMPLATES[initial.template] ? initial.template : 'afterHours';
  const [template, setTemplate] = useState(start);
  const [params, setParams] = useState(() => ({
    ...TEMPLATES[start].defaults,
    ...(start === initial?.template ? initial.params : {}),
  }));
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const rule = { template, params };

  const choose = (value) => {
    setTemplate(value);
    setParams(TEMPLATES[value].defaults);
    setResult(null);
  };
  const param = (key) => (event) => {
    setParams({ ...params, [key]: event.target.value });
    setResult(null);
  };

  const test = useCatch(async () => {
    setTesting(true);
    try {
      const rows = await loadWeek(TEMPLATES[template].source, Object.keys(devices));
      setResult(backtest(rule, rows));
    } finally {
      setTesting(false);
    }
  });

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('automation_rules')
        .insert({
          org_id: profile.org_id,
          name: describe(rule).slice(0, 120),
          template,
          // Numbers stay numbers (the fields give text).
          params: Object.fromEntries(
            Object.entries(params).map(([key, value]) => [
              key,
              ['speed', 'minutes', 'geofenceId'].includes(key) && value !== '' && value != null
                ? Number(value)
                : value,
            ]),
          ),
          actions: ['notify'],
          active: true,
          tested_at: new Date().toISOString(),
          tested_matches: result.length,
        }),
    );
    onSaved();
  });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="sm">
      <DialogTitle>{t('autoNew')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label={t('autoTemplate')}
            value={template}
            onChange={(e) => choose(e.target.value)}
          >
            {Object.keys(TEMPLATES).map((key) => (
              <MenuItem key={key} value={key}>
                {t(`autoTemplate${key[0].toUpperCase()}${key.slice(1)}`)}
              </MenuItem>
            ))}
          </TextField>
          {template === 'afterHours' && (
            <Stack direction="row" spacing={2}>
              <TextField
                type="time"
                label={t('autoAfter')}
                value={params.after}
                onChange={param('after')}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
                fullWidth
              />
              <TextField
                type="time"
                label={t('autoBefore')}
                value={params.before}
                onChange={param('before')}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
                fullWidth
              />
            </Stack>
          )}
          {template === 'overspeed' && (
            <TextField
              label={t('autoSpeed')}
              value={params.speed}
              onChange={param('speed')}
              slotProps={{ htmlInput: { inputMode: 'numeric', dir: 'ltr' } }}
            />
          )}
          {template === 'idling' && (
            <TextField
              label={t('autoMinutes')}
              value={params.minutes}
              onChange={param('minutes')}
              slotProps={{ htmlInput: { inputMode: 'numeric', dir: 'ltr' } }}
            />
          )}
          {template === 'geofenceEnter' && (
            <TextField
              select
              label={t('sharedGeofence')}
              value={params.geofenceId ?? ''}
              onChange={param('geofenceId')}
            >
              <MenuItem value="">{t('autoAnyGeofence')}</MenuItem>
              {Object.values(geofences).map((geofence) => (
                <MenuItem key={geofence.id} value={geofence.id}>
                  {geofence.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Alert severity="info" icon={<AutoModeRoundedIcon />}>
            {describe(rule)}
          </Alert>
          {result && (
            <div role="status">
              <Typography variant="subtitle2">
                {t('autoTestResult').replace('{0}', result.length)}
              </Typography>
              <List dense disablePadding>
                {result.slice(0, 8).map((row, index) => (
                  <ListItem key={row.id ?? index} disableGutters>
                    <ListItemText
                      primary={devices[row.deviceId]?.name || `#${row.deviceId}`}
                      secondary={formatTime(row.eventTime || row.startTime, 'minutes')}
                    />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        {result ? (
          <Button variant="contained" onClick={save}>
            {t('autoSaveOn')}
          </Button>
        ) : (
          <Button variant="contained" onClick={test} loading={testing}>
            {t('autoTestWeek')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// AI-05: automations from templates, each tested on the last week before it is turned on.
const AutomationsPage = () => {
  const t = useTranslation();
  const describe = useSentence();
  const canRead = useFleetPermission('alerts.read');
  const canManage = useFleetPermission('alerts.manage');
  const invalidate = useInvalidateFleet();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(() => {
    const template = searchParams.get('template');
    if (!template) return false;
    try {
      return { template, params: JSON.parse(searchParams.get('params') || '{}') };
    } catch {
      return { template, params: {} };
    }
  });
  const closeDialog = () => {
    setCreating(false);
    if (searchParams.has('template')) setSearchParams({}, { replace: true });
  };
  const rules = useFleetRows('automation_rules', {
    order: 'created_at',
    ascending: false,
    enabled: canRead,
  });

  const toggle = useCatch(async (rule) => {
    unwrap(
      await getFleetClient()
        .from('automation_rules')
        .update({ active: !rule.active })
        .eq('id', rule.id),
    );
    invalidate('automation_rules');
  });

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'autoTitle']}
      description={t('autoDescription')}
    >
      <FleetNotice permission="alerts.read" />
      <DataTable
        toolbar={
          <TableToolbar
            count={rules?.length || 0}
            actions={
              canManage && (
                <Button variant="contained" size="small" onClick={() => setCreating(true)}>
                  {t('autoNew')}
                </Button>
              )
            }
          />
        }
        empty={Boolean(rules) && rules.length === 0}
        emptyState={{ icon: <AutoModeRoundedIcon />, title: t('autoNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('autoRule')}</TableCell>
            <TableCell>{t('autoLastTest')}</TableCell>
            <TableCell>{t('autoActive')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(rules || []).map((rule) => (
            <TableRow key={rule.id} hover>
              <TableCell>{describe(rule)}</TableCell>
              <TableCell>
                {rule.tested_at
                  ? t('autoTestedSummary')
                      .replace('{0}', rule.tested_matches ?? 0)
                      .replace('{1}', formatTime(rule.tested_at, 'date'))
                  : '—'}
              </TableCell>
              <TableCell>
                <Switch
                  checked={rule.active}
                  disabled={!canManage}
                  onChange={() => toggle(rule)}
                  slotProps={{ input: { 'aria-label': `${t('autoActive')}: ${describe(rule)}` } }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {creating && (
        <RuleDialog
          initial={typeof creating === 'object' ? creating : null}
          onClose={closeDialog}
          onSaved={() => {
            closeDialog();
            invalidate('automation_rules');
          }}
        />
      )}
    </PageLayout>
  );
};

export default AutomationsPage;
