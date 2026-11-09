import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import useDriverContext from './useDriverContext';
import DriverDoneCard from './components/DriverDoneCard';
import { useTranslation } from '../common/components/LocalizationProvider';
import FormPage from '../settings/components/FormPage';
import FormSection from '../settings/components/FormSection';
import SaveBar from '../settings/components/SaveBar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  evaluateItem,
  inspectionResult,
  issuesFromFailures,
  missingAnswers,
  allPassing,
  criticalWithoutEvidence,
  failedCritical,
} from '../common/fleet/inspections';
import { odometerKm } from '../common/fleet/workOrders';
import FleetNotice from './components/FleetNotice';
import SignaturePad from './components/SignaturePad';
import { ensureDriver, ensureVehicle, openFleetFile, uploadFleetFile } from './fleetData';

const useStyles = makeStyles()((theme) => ({
  top: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  // ADM-11: an item still to answer, after an attempt to send.
  itemMissing: {
    borderInlineStart: `3px solid ${theme.palette.error.main}`,
    paddingInlineStart: theme.spacing(1.5),
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    paddingBlock: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '&:last-of-type': {
      borderBottom: 'none',
    },
  },
  itemHead: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  toggle: {
    '& .MuiToggleButton-root': {
      minWidth: 88,
      minHeight: 44,
      gap: 4,
    },
  },
  // Gloves: the driver's buttons are 56px high.
  big: {
    '& .MuiToggleButton-root, & .MuiButton-root': {
      minHeight: 56,
      minWidth: 112,
    },
  },
}));

// Roadmap stage 2: fill in a checklist for a vehicle (or view a filled one).
// Failed items open issues; the inspection fails when any item fails.
// driverMode (/driver/check, ADM-09): the driver and the assigned vehicle are filled in and locked,
// the controls are large, and sending ends on a confirmation instead of the manager's list.
const InspectionPage = ({ driverMode = false }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('inspections.read');
  const canFill = useFleetPermission('inspections.write');

  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const positions = useSelector((state) => state.session.positions);

  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(searchParams.get('template') || '');
  const [deviceId, setDeviceId] = useState(searchParams.get('deviceId') || '');
  const [driverId, setDriverId] = useState('');
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [done, setDone] = useState(null);
  // ADM-11: the check ended with a failed critical item: the driver must not drive.
  const [stopped, setStopped] = useState(false);
  const driverContext = useDriverContext(driverMode);
  const assigned = driverMode ? driverContext?.assignment : null;
  const selectedDeviceId = assigned ? String(assigned.traccar_device_id) : deviceId;

  useAsyncTask(async () => {
    // Filling in a check needs the templates: inspections.write is enough (drivers have no .read).
    if (!canRead && !(canFill && !id)) {
      return;
    }
    const client = getFleetClient();
    if (id) {
      const row = unwrap(
        await client
          .from('inspections')
          .select('*, vehicles(plate_number), drivers(full_name), inspection_items(*)')
          .eq('id', id)
          .order('sort_order', { referencedTable: 'inspection_items' })
          .single(),
      );
      setSaved(row);
      return;
    }
    const rows = unwrap(
      await client
        .from('inspection_templates')
        .select('*, inspection_template_items(*)')
        .eq('active', true)
        .order('name')
        .order('sort_order', { referencedTable: 'inspection_template_items' }),
    );
    let list = rows || [];
    // ADM-11: no checklist yet: the organization gets the daily one, so the check never blocks.
    if (!list.length && canFill) {
      await client.rpc('inspection_default_template');
      list =
        unwrap(
          await client
            .from('inspection_templates')
            .select('*, inspection_template_items(*)')
            .eq('active', true)
            .order('name')
            .order('sort_order', { referencedTable: 'inspection_template_items' }),
        ) || [];
    }
    setTemplates(list);
    if (list.length === 1) {
      setTemplateId((current) => current || list[0].id);
    }
  }, [id, canRead, canFill]);

  const template = templates.find((it) => it.id === templateId);
  const items = useMemo(() => template?.inspection_template_items || [], [template]);
  const missing = missingAnswers(items, answers);
  const needEvidence = criticalWithoutEvidence(items, answers);
  const remaining = missing.length + needEvidence.length;

  // ADM-11: a draft on this device, so a reload or a lost connection keeps what was filled in.
  // Photos and signatures are files and are not kept.
  const draftKey = template && `vfInspectionDraft:${template.id}:${selectedDeviceId || ''}`;
  const [restored, setRestored] = useState(null);
  useEffect(() => {
    if (!draftKey || restored === draftKey) return;
    try {
      const draft = JSON.parse(window.localStorage.getItem(draftKey) || 'null');
      if (draft) {
        setAnswers(draft.answers || {});
        setNotes(draft.notes || '');
      }
    } catch {
      // no draft
    }
    setRestored(draftKey);
  }, [draftKey, restored]);
  useEffect(() => {
    if (!draftKey || restored !== draftKey) return;
    const plain = Object.fromEntries(
      Object.entries(answers).map(([key, value]) => [
        key,
        Object.fromEntries(
          Object.entries(value).filter(([field]) => field !== 'photo' && field !== 'signature'),
        ),
      ]),
    );
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ answers: plain, notes }));
    } catch {
      // storage full or unavailable: the form still works
    }
  }, [draftKey, restored, answers, notes]);

  const answer = (itemId, changes) =>
    setAnswers((current) => ({ ...current, [itemId]: { ...current[itemId], ...changes } }));

  const handleSave = useCatch(async () => {
    if (remaining) {
      setShowMissing(true);
      return;
    }
    setSaving(true);
    try {
      const client = getFleetClient();
      let vehicleId;
      let driverRowId;
      if (driverMode) {
        vehicleId = assigned.vehicle_id;
        driverRowId = driverContext.driver.id;
      } else {
        vehicleId = await ensureVehicle(devices[deviceId], profile);
        const driver = Object.values(drivers).find((it) => String(it.id) === driverId);
        driverRowId = driver ? await ensureDriver(driver, profile) : null;
      }
      const position = positions[selectedDeviceId];
      const result = inspectionResult(items, answers);
      const inspection = unwrap(
        await client
          .from('inspections')
          .insert({
            org_id: profile.org_id,
            vehicle_id: vehicleId,
            driver_id: driverRowId,
            template_id: template.id,
            template_name: template.name,
            finished_at: new Date().toISOString(),
            odometer_km: odometerKm(position),
            latitude: position?.latitude ?? null,
            longitude: position?.longitude ?? null,
            result,
            notes: notes.trim() || null,
            created_by: profile.id,
          })
          .select('id')
          .single(),
      );
      const rows = [];
      for (const [index, item] of items.entries()) {
        const value = answers[item.id] || {};
        const file =
          value.photo ||
          (value.signature && new File([value.signature], 'signature.png', { type: 'image/png' }));
        const photoPath = file ? await uploadFleetFile(profile.org_id, 'inspections', file) : null;
        rows.push({
          org_id: profile.org_id,
          inspection_id: inspection.id,
          template_item_id: item.id,
          label: item.label,
          type: item.type,
          critical: item.critical,
          value: value.value == null ? null : String(value.value),
          passed: evaluateItem(item, value.value),
          photo_path: photoPath,
          comment: value.comment?.trim() || null,
          sort_order: index,
        });
      }
      unwrap(await client.from('inspection_items').insert(rows));
      const issues = issuesFromFailures(items, answers).map((issue) => ({
        ...issue,
        org_id: profile.org_id,
        vehicle_id: vehicleId,
        inspection_id: inspection.id,
        reported_by: profile.id,
      }));
      if (issues.length) {
        unwrap(await client.from('issues').insert(issues));
      }
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // nothing to remove
      }
      setStopped(failedCritical(items, answers));
      if (driverMode) {
        setDone(new Date());
      } else {
        navigate('/fleet/inspections');
      }
    } finally {
      setSaving(false);
    }
  });

  const renderInput = (item) => {
    const value = answers[item.id] || {};
    switch (item.type) {
      case 'pass_fail':
        return (
          <ToggleButtonGroup
            exclusive
            className={cx(classes.toggle, driverMode && classes.big)}
            value={value.value ?? null}
            onChange={(_, next) => next && answer(item.id, { value: next })}
            aria-label={item.label}
          >
            <ToggleButton value="pass" color="success">
              <CheckRoundedIcon fontSize="small" />
              {t('fleetInspectionPass')}
            </ToggleButton>
            <ToggleButton value="fail" color="error">
              <CloseRoundedIcon fontSize="small" />
              {t('fleetInspectionFail')}
            </ToggleButton>
          </ToggleButtonGroup>
        );
      case 'number_range':
        return (
          <TextField
            size="small"
            type="number"
            value={value.value ?? ''}
            onChange={(event) => answer(item.id, { value: event.target.value })}
            helperText={
              [item.min_value, item.max_value].some((v) => v != null)
                ? `${item.min_value ?? ''} – ${item.max_value ?? ''}`
                : undefined
            }
            slotProps={{ htmlInput: { dir: 'ltr', step: 'any', 'aria-label': item.label } }}
          />
        );
      case 'photo':
        return (
          <Button
            component="label"
            variant="outlined"
            startIcon={<PhotoCameraRoundedIcon />}
            sx={{ alignSelf: 'flex-start', minHeight: driverMode ? 56 : undefined }}
          >
            {value.photo ? value.photo.name : t('fleetInspectionTakePhoto')}
            <input
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => answer(item.id, { photo: event.target.files[0] })}
            />
          </Button>
        );
      case 'signature':
        return (
          <SignaturePad
            label={item.label || t('fleetInspectionSignature')}
            onChange={(blob) => answer(item.id, { signature: blob, value: blob ? 'signed' : null })}
          />
        );
      default:
        return (
          <TextField
            size="small"
            multiline
            value={value.value ?? ''}
            onChange={(event) => answer(item.id, { value: event.target.value })}
            slotProps={{ htmlInput: { 'aria-label': item.label } }}
          />
        );
    }
  };

  if (id) {
    return (
      <FormPage
        menu={<SettingsMenu />}
        breadcrumbs={['fleetTitle', 'fleetInspectionsPage']}
        title={t('fleetInspection')}
      >
        <FleetNotice permission="inspections.read" />
        {saved && (
          <FormSection
            title={`${saved.template_name || ''} · ${saved.vehicles?.plate_number || ''}`}
            description={`${formatTime(saved.started_at, 'minutes')}${saved.drivers?.full_name ? ` · ${saved.drivers.full_name}` : ''}`}
            icon={<FactCheckRoundedIcon />}
            actions={
              <Chip
                color={saved.result === 'pass' ? 'success' : 'error'}
                label={t(saved.result === 'pass' ? 'fleetInspectionPass' : 'fleetInspectionFail')}
              />
            }
          >
            {saved.inspection_items.map((item) => (
              <div
                key={item.id}
                className={cx(
                  classes.item,
                  showMissing &&
                    (missing.includes(item) || needEvidence.includes(item)) &&
                    classes.itemMissing,
                )}
              >
                <div className={classes.itemHead}>
                  <Typography variant="body2" fontWeight={600}>
                    {item.label}
                  </Typography>
                  {item.passed != null ? (
                    <Chip
                      size="small"
                      color={item.passed ? 'success' : 'error'}
                      label={t(item.passed ? 'fleetInspectionPass' : 'fleetInspectionFail')}
                    />
                  ) : (
                    item.value && <Typography variant="body2">{item.value}</Typography>
                  )}
                </div>
                {item.comment && (
                  <Typography variant="body2" color="textSecondary">
                    {item.comment}
                  </Typography>
                )}
                {item.photo_path && (
                  <Button
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                    onClick={() => openFleetFile(item.photo_path)}
                  >
                    {t('fleetOpenFile')}
                  </Button>
                )}
              </div>
            ))}
            {saved.notes && <Typography variant="body2">{saved.notes}</Typography>}
          </FormSection>
        )}
      </FormPage>
    );
  }

  const valid = driverMode ? assigned && template : deviceId && devices[deviceId] && template;

  if (driverMode && done) {
    return (
      <FormPage breadcrumbs={['fleetDriverPortal']} title={t('fleetDriverPortalMorningCheck')}>
        {stopped ? (
          <Alert severity="error" variant="filled" sx={{ m: 2 }}>
            <strong>{t('fleetInspectionDoNotDrive')}</strong>
            <div>{t('fleetInspectionDoNotDriveHelp')}</div>
          </Alert>
        ) : (
          <DriverDoneCard titleKey="driverCheckSent" time={done} />
        )}
      </FormPage>
    );
  }

  return (
    <FormPage
      menu={driverMode ? undefined : <SettingsMenu />}
      breadcrumbs={driverMode ? ['fleetDriverPortal'] : ['fleetTitle', 'fleetInspectionsPage']}
      title={t(driverMode ? 'fleetDriverPortalMorningCheck' : 'fleetInspectionAdd')}
      footer={
        canFill && (
          <SaveBar
            onCancel={() => navigate(driverMode ? '/driver' : -1)}
            onSave={handleSave}
            saving={saving}
            disabled={!valid}
            saveLabel={t('fleetInspectionSubmit')}
          />
        )
      }
    >
      <FleetNotice permission="inspections.write" />
      <FormSection title={t('fleetInspectionAdd')} icon={<FactCheckRoundedIcon />}>
        {driverMode && driverContext && !assigned && (
          <Alert severity="info">{t('driverNoVehicle')}</Alert>
        )}
        {driverMode && assigned && (
          <Typography variant="body1">
            {devices[assigned.traccar_device_id]?.name || assigned.plate_number}
            {' · '}
            <span dir="ltr">{assigned.plate_number}</span>
            {' · '}
            {driverContext.driver.full_name}
          </Typography>
        )}
        <div className={classes.top}>
          {!driverMode && (
            <TextField
              select
              label={t('fleetEntityVehicle')}
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
            >
              {Object.values(devices)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((device) => (
                  <MenuItem key={device.id} value={String(device.id)}>
                    {device.name}
                  </MenuItem>
                ))}
            </TextField>
          )}
          {(!driverMode || templates.length > 1) && (
            <TextField
              select
              label={t('fleetInspectionTemplate')}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              {templates.map((it) => (
                <MenuItem key={it.id} value={it.id}>
                  {it.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!driverMode && (
            <TextField
              select
              label={t('sharedDriver')}
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <MenuItem value="">&nbsp;</MenuItem>
              {Object.values(drivers)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((driver) => (
                  <MenuItem key={driver.id} value={String(driver.id)}>
                    {driver.name}
                  </MenuItem>
                ))}
            </TextField>
          )}
        </div>
        {(canRead || canFill) && templates.length === 0 && (
          <Alert severity="info">{t('fleetInspectionNoTemplates')}</Alert>
        )}
      </FormSection>
      {template && (!driverMode || assigned) && (
        <FormSection
          title={template.name}
          actions={
            <Button
              variant="outlined"
              startIcon={<CheckRoundedIcon />}
              onClick={() => setAnswers((current) => allPassing(items, current))}
            >
              {t('fleetInspectionAllOk')}
            </Button>
          }
        >
          {remaining > 0 && (
            <Alert severity={showMissing ? 'warning' : 'info'} role="status">
              {t('fleetInspectionRemaining').replace('{0}', String(remaining))}
            </Alert>
          )}
          {failedCritical(items, answers) && (
            <Alert severity="error">{t('fleetInspectionCriticalFailed')}</Alert>
          )}
          {items.map((item) => {
            const passed = evaluateItem(item, answers[item.id]?.value);
            return (
              <div key={item.id} className={classes.item}>
                <div className={classes.itemHead}>
                  <Typography variant="body2" fontWeight={600}>
                    {item.label}
                    {item.critical && ` · ${t('fleetInspectionCritical')}`}
                  </Typography>
                  {renderInput(item)}
                </div>
                {passed === false && (
                  <TextField
                    size="small"
                    required={item.critical}
                    label={t('fleetInspectionFailComment')}
                    value={answers[item.id]?.comment || ''}
                    onChange={(event) => answer(item.id, { comment: event.target.value })}
                  />
                )}
                {passed === false && item.critical && item.type !== 'photo' && (
                  <Button
                    component="label"
                    variant="outlined"
                    color={answers[item.id]?.photo ? 'primary' : 'error'}
                    startIcon={<PhotoCameraRoundedIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {answers[item.id]?.photo
                      ? answers[item.id].photo.name
                      : t('fleetInspectionCriticalPhoto')}
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => answer(item.id, { photo: event.target.files[0] })}
                    />
                  </Button>
                )}
              </div>
            );
          })}
          <TextField
            label={t('fleetNotes')}
            multiline
            minRows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormSection>
      )}
    </FormPage>
  );
};

export default InspectionPage;
