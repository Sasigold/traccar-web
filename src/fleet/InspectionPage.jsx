import { useMemo, useState } from 'react';
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
} from '../common/fleet/inspections';
import { odometerKm } from '../common/fleet/workOrders';
import FleetNotice from './components/FleetNotice';
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
}));

// Roadmap stage 2: fill in a checklist for a vehicle (or view a filled one).
// Failed items open issues; the inspection fails when any item fails.
const InspectionPage = () => {
  const { classes } = useStyles();
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

  useAsyncTask(async () => {
    if (!canRead) {
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
    setTemplates(rows || []);
    if (rows?.length === 1) {
      setTemplateId((current) => current || rows[0].id);
    }
  }, [id, canRead]);

  const template = templates.find((it) => it.id === templateId);
  const items = useMemo(() => template?.inspection_template_items || [], [template]);
  const missing = missingAnswers(items, answers);

  const answer = (itemId, changes) =>
    setAnswers((current) => ({ ...current, [itemId]: { ...current[itemId], ...changes } }));

  const handleSave = useCatch(async () => {
    if (missing.length) {
      setShowMissing(true);
      return;
    }
    setSaving(true);
    try {
      const client = getFleetClient();
      const vehicleId = await ensureVehicle(devices[deviceId], profile);
      const driver = Object.values(drivers).find((it) => String(it.id) === driverId);
      const driverRowId = driver ? await ensureDriver(driver, profile) : null;
      const position = positions[deviceId];
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
        const photoPath = value.photo
          ? await uploadFleetFile(profile.org_id, 'inspections', value.photo)
          : null;
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
      navigate('/fleet/inspections');
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
            className={classes.toggle}
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
            sx={{ alignSelf: 'flex-start' }}
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
          <TextField
            size="small"
            label={t('fleetInspectionSignature')}
            value={value.value ?? ''}
            onChange={(event) => answer(item.id, { value: event.target.value })}
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
              <div key={item.id} className={classes.item}>
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

  const valid = deviceId && devices[deviceId] && template;

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetInspectionsPage']}
      title={t('fleetInspectionAdd')}
      footer={
        canFill && (
          <SaveBar
            onCancel={() => navigate(-1)}
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
        <div className={classes.top}>
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
        </div>
        {canRead && templates.length === 0 && (
          <Alert severity="info">{t('fleetInspectionNoTemplates')}</Alert>
        )}
      </FormSection>
      {template && (
        <FormSection title={template.name}>
          {showMissing && missing.length > 0 && (
            <Alert severity="warning">
              {t('fleetInspectionMissing').replace('{0}', String(missing.length))}
            </Alert>
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
                    label={t('fleetInspectionFailComment')}
                    value={answers[item.id]?.comment || ''}
                    onChange={(event) => answer(item.id, { comment: event.target.value })}
                  />
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
