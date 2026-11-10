import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import FormPage from '../settings/components/FormPage';
import FormSection from '../settings/components/FormSection';
import SaveBar from '../settings/components/SaveBar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { messagesActions } from '../store';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  CLAIM_STATUSES,
  INCIDENT_FAULTS,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  LOOKUP_MINUTES,
  PARTY_ROLES,
  fromLocalInput,
  nearestPosition,
  toLocalInput,
} from '../common/fleet/incidents';
import FleetNotice from './components/FleetNotice';
import { useConfirm } from '../common/components/confirm/ConfirmProvider';
import {
  discardUnsavedChanges,
  goBack,
  useFormChanges,
  useLeaveGuard,
} from '../common/components/confirm/unsavedChanges';
import { incidentKey } from './IncidentsPage';
import {
  ensureDriver,
  ensureVehicle,
  fleetFileUrl,
  openFleetFile,
  uploadFleetFile,
  FILES_BUCKET,
} from './fleetData';
import { fleetSave, withUploadedFile } from '../common/fleet/fleetSave';
import { DateField, DateTimeField } from '../common/components/pickers';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import InsuranceFileDialog from './components/InsuranceFileDialog';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  full: {
    gridColumn: '1 / -1',
  },
  photos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: theme.spacing(1),
  },
  photo: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    cursor: 'pointer',
    padding: 0,
    background: 'none',
  },
  party: {
    display: 'grid',
    gap: theme.spacing(1.5),
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto',
    paddingBottom: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr) auto',
    },
  },
}));

const emptyParty = () => ({
  key: crypto.randomUUID(),
  role: 'third_party',
  name: '',
  phone: '',
  national_id: '',
  plate_number: '',
  insurer: '',
  policy_number: '',
});
const emptyClaim = {
  insurer: '',
  claim_number: '',
  filed_at: '',
  status: 'draft',
  deductible: '',
  approved_amount: '',
  paid_at: '',
  notes: '',
};
const partyFields = ['name', 'phone', 'national_id', 'plate_number', 'insurer', 'policy_number'];
const nullable = (value) => (value === '' || value === undefined ? null : value);

// Roadmap stage 2 / Israeli report form: one damage or accident report.
const IncidentPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('incidents.read');
  const canWrite = useFleetPermission('incidents.write');

  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);

  const [incident, setIncident] = useState(null);
  const [deviceId, setDeviceId] = useState(searchParams.get('deviceId') || '');
  const [driverId, setDriverId] = useState('');
  const [parties, setParties] = useState([]);
  const [claim, setClaim] = useState(emptyClaim);
  const [photos, setPhotos] = useState([]);
  // SAF-04: the file for the insurer.
  const [insuranceFile, setInsuranceFile] = useState(false);
  const [newPhotos, setNewPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useAsyncTask(async () => {
    if (!canRead) {
      return;
    }
    if (!id) {
      setIncident({
        occurred_at: toLocalInput(),
        type: 'accident',
        severity: 'minor',
        fault: 'unknown',
        status: 'reported',
        injuries: false,
      });
      return;
    }
    const client = getFleetClient();
    const row = unwrap(
      await client
        .from('incidents')
        .select('*, vehicles(traccar_device_id), drivers(traccar_driver_id)')
        .eq('id', id)
        .single(),
    );
    const [partyRows, claimRow, photoRows] = await Promise.all([
      client.from('incident_parties').select('*').eq('incident_id', id),
      client.from('insurance_claims').select('*').eq('incident_id', id).maybeSingle(),
      client.from('incident_photos').select('*').eq('incident_id', id).order('created_at'),
    ]);
    setIncident({ ...row, occurred_at: toLocalInput(row.occurred_at) });
    setDeviceId(String(row.vehicles?.traccar_device_id || ''));
    setDriverId(String(row.drivers?.traccar_driver_id || ''));
    setParties((unwrap(partyRows) || []).map((party) => ({ ...party, key: party.id })));
    setClaim({
      ...emptyClaim,
      ...Object.fromEntries(Object.entries(unwrap(claimRow) || {}).filter(([, v]) => v != null)),
    });
    const stored = unwrap(photoRows) || [];
    setPhotos(
      await Promise.all(
        stored.map(async (photo) => ({ ...photo, url: await fleetFileUrl(photo.storage_path) })),
      ),
    );
  }, [id, canRead]);

  const deviceOptions = useMemo(
    () =>
      Object.values(devices)
        .map((device) => ({
          id: String(device.id),
          name: device.attributes?.plateNumber
            ? `${device.name} · ${device.attributes.plateNumber}`
            : device.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );
  const driverList = useMemo(
    () => Object.values(drivers).sort((a, b) => a.name.localeCompare(b.name)),
    [drivers],
  );

  const set = (changes) => setIncident((current) => ({ ...current, ...changes }));

  // Location, address and driver from the vehicle's track around the reported time.
  const fillFromTracker = async () => {
    setLocating(true);
    try {
      const time = Date.parse(fromLocalInput(incident.occurred_at));
      const windowMs = LOOKUP_MINUTES * 60000;
      const query = new URLSearchParams({
        deviceId,
        from: new Date(time - windowMs).toISOString(),
        to: new Date(time + windowMs).toISOString(),
      });
      const response = await fetchOrThrow(`api/positions?${query.toString()}`);
      const position = nearestPosition(await response.json(), time);
      if (!position) {
        dispatch(messagesActions.push(t('fleetIncidentNoTrack')));
        return;
      }
      let { address } = position;
      if (!address) {
        try {
          const geocode = await fetchOrThrow(
            `api/server/geocode?latitude=${position.latitude}&longitude=${position.longitude}`,
          );
          address = await geocode.text();
        } catch {
          address = null;
        }
      }
      set({
        latitude: position.latitude,
        longitude: position.longitude,
        ...(address && { address }),
      });
      const driver = drivers[position.attributes?.driverUniqueId];
      if (driver) {
        setDriverId(String(driver.id));
      }
    } catch (error) {
      dispatch(messagesActions.push(error.message));
    } finally {
      setLocating(false);
    }
  };

  // ADM-05: unsaved changes are asked about before leaving.
  const leave = useLeaveGuard(useConfirm(), t);
  useFormChanges(
    { incident, parties, claim, deviceId, driverId, photos: newPhotos.length },
    Boolean(incident),
  );

  const handleSave = useCatch(async () => {
    setSaving(true);
    try {
      const client = getFleetClient();
      const vehicleId = await ensureVehicle(devices[deviceId], profile);
      const driver = driverList.find((item) => String(item.id) === driverId);
      const driverRowId = driver ? await ensureDriver(driver, profile) : null;
      const payload = {
        vehicle_id: vehicleId,
        driver_id: driverRowId,
        occurred_at: fromLocalInput(incident.occurred_at),
        type: incident.type,
        severity: incident.severity,
        injuries: Boolean(incident.injuries),
        description: nullable(incident.description),
        latitude: incident.latitude ?? null,
        longitude: incident.longitude ?? null,
        address: nullable(incident.address),
        police_report_no: nullable(incident.police_report_no),
        fault: incident.fault,
        preventable: incident.preventable ?? null,
        status: incident.status,
        repair_cost: nullable(incident.repair_cost),
        investigation_notes: nullable(incident.investigation_notes),
      };
      const partyRows = parties
        .filter((party) => partyFields.some((field) => party[field]?.trim()))
        .map((party) => ({
          role: party.role,
          ...Object.fromEntries(
            partyFields.map((field) => [field, nullable(party[field]?.trim())]),
          ),
        }));
      const claimFilled = ['insurer', 'claim_number', 'filed_at'].some((field) => claim[field]);
      const claimRow =
        claim.id || claimFilled
          ? {
              ...(claim.id ? { id: claim.id } : {}),
              insurer: nullable(claim.insurer),
              claim_number: nullable(claim.claim_number),
              filed_at: nullable(claim.filed_at),
              status: claim.status,
              deductible: nullable(claim.deductible),
              approved_amount: nullable(claim.approved_amount),
              paid_at: nullable(claim.paid_at),
              notes: nullable(claim.notes),
            }
          : null;
      // ARC-05: the incident, its parties and its claim in one transaction.
      const savedId = await fleetSave(
        'incident',
        id,
        id ? payload : { ...payload, org_id: profile.org_id, reported_by: profile.id },
        partyRows,
        claimRow,
      );

      // Each photo: the file, then its row; a row that fails takes its file away again.
      for (const file of newPhotos) {
        await withUploadedFile(
          () => uploadFleetFile(profile.org_id, 'incidents', file),
          (path) => client.storage.from(FILES_BUCKET).remove([path]),
          async (path) =>
            unwrap(
              await client.from('incident_photos').insert({
                org_id: profile.org_id,
                incident_id: savedId,
                storage_path: path,
                file_name: file.name,
                taken_at: file.lastModified ? new Date(file.lastModified).toISOString() : null,
              }),
            ),
        );
      }
      discardUnsavedChanges();
      navigate('/fleet/incidents');
    } finally {
      setSaving(false);
    }
  });

  const select = (key, group, values, labelKey) => (
    <TextField
      select
      label={t(labelKey)}
      value={incident[key] ?? ''}
      onChange={(event) => set({ [key]: event.target.value })}
    >
      {values.map((value) => (
        <MenuItem key={value} value={value}>
          {t(incidentKey(group, value))}
        </MenuItem>
      ))}
    </TextField>
  );

  const text = (key, labelKey, props = {}) => (
    <TextField
      label={t(labelKey)}
      value={incident[key] ?? ''}
      onChange={(event) => set({ [key]: event.target.value })}
      {...props}
    />
  );

  const claimField = (key, labelKey, props = {}, Field = TextField) => (
    <Field
      label={t(labelKey)}
      value={claim[key] ?? ''}
      onChange={(event) => setClaim({ ...claim, [key]: event.target.value })}
      {...props}
    />
  );

  const valid = incident && deviceId && devices[deviceId] && incident.occurred_at;
  const numberProps = { type: 'number', slotProps: { htmlInput: { dir: 'ltr', step: 'any' } } };

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetIncidentsPage']}
      title={incident?.number ? `${t('fleetIncident')} ${incident.number}` : t('fleetIncidentAdd')}
      footer={
        canWrite && (
          <SaveBar
            onCancel={() => leave(() => goBack(navigate))}
            onSave={handleSave}
            saving={saving}
            disabled={!valid}
          />
        )
      }
    >
      <FleetNotice permission="incidents.read" />
      {incident && (
        <>
          <FormSection title={t('fleetIncidentEvent')} icon={<CarCrashRoundedIcon />}>
            <div className={classes.grid}>
              <TextField
                select
                label={t('fleetEntityVehicle')}
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
              >
                {deviceOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name}
                  </MenuItem>
                ))}
              </TextField>
              <DateTimeField
                label={t('fleetIncidentOccurred')}
                value={incident.occurred_at}
                onChange={(event) => set({ occurred_at: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Button
                className={classes.full}
                variant="outlined"
                startIcon={<MyLocationRoundedIcon />}
                onClick={fillFromTracker}
                disabled={!deviceId || locating}
                sx={{ justifySelf: 'start' }}
              >
                {t('fleetIncidentFillFromTracker')}
              </Button>
              <TextField
                select
                label={t('sharedDriver')}
                value={driverId}
                onChange={(event) => setDriverId(event.target.value)}
              >
                <MenuItem value="">&nbsp;</MenuItem>
                {driverList.map((driver) => (
                  <MenuItem key={driver.id} value={String(driver.id)}>
                    {driver.name}
                  </MenuItem>
                ))}
              </TextField>
              {text('address', 'positionAddress')}
              {select('type', 'Type', INCIDENT_TYPES, 'sharedType')}
              {select('severity', 'Severity', INCIDENT_SEVERITIES, 'fleetIncidentSeverity')}
              {text('police_report_no', 'fleetIncidentPoliceReport', {
                slotProps: { htmlInput: { dir: 'ltr' } },
              })}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(incident.injuries)}
                    onChange={(event) => set({ injuries: event.target.checked })}
                  />
                }
                label={t('fleetIncidentInjuries')}
              />
              {text('description', 'fleetIncidentDescription', {
                className: classes.full,
                multiline: true,
                minRows: 3,
              })}
              {incident.latitude != null && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.full}
                  dir="ltr"
                >
                  {`${Number(incident.latitude).toFixed(5)}, ${Number(incident.longitude).toFixed(5)}`}
                </Typography>
              )}
            </div>
          </FormSection>

          <FormSection title={t('fleetIncidentHandling')} icon={<GavelRoundedIcon />}>
            <div className={classes.grid}>
              {select('fault', 'Fault', INCIDENT_FAULTS, 'fleetIncidentFault')}
              <TextField
                select
                label={t('fleetIncidentPreventable')}
                value={incident.preventable == null ? '' : String(incident.preventable)}
                onChange={(event) =>
                  set({
                    preventable: event.target.value === '' ? null : event.target.value === 'true',
                  })
                }
              >
                <MenuItem value="">{t('fleetIncidentFaultUnknown')}</MenuItem>
                <MenuItem value="true">{t('fleetIncidentPreventableYes')}</MenuItem>
                <MenuItem value="false">{t('fleetIncidentPreventableNo')}</MenuItem>
              </TextField>
              {select('status', 'Status', INCIDENT_STATUSES, 'deviceStatus')}
              {text('repair_cost', 'fleetIncidentRepairCost', numberProps)}
              {text('investigation_notes', 'fleetIncidentInvestigation', {
                className: classes.full,
                multiline: true,
                minRows: 2,
              })}
            </div>
          </FormSection>

          {incident.id && deviceId && (
            <Button
              variant="outlined"
              startIcon={<DescriptionRoundedIcon />}
              onClick={() => setInsuranceFile(true)}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('insuranceFileOpen')}
            </Button>
          )}
          <FormSection title={t('fleetIncidentPhotos')} icon={<PhotoCameraRoundedIcon />}>
            {photos.length > 0 && (
              <div className={classes.photos}>
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className={classes.photo}
                    onClick={() => openFleetFile(photo.storage_path)}
                    aria-label={photo.file_name || t('fleetOpenFile')}
                  >
                    <img src={photo.url} alt="" className={classes.photo} />
                  </button>
                ))}
              </div>
            )}
            {canWrite && (
              <Button
                component="label"
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('fleetIncidentAddPhotos')}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(event) =>
                    setNewPhotos((current) => [...current, ...event.target.files])
                  }
                />
              </Button>
            )}
            {newPhotos.length > 0 && (
              <Typography variant="body2" color="textSecondary">
                {t('fleetIncidentPhotosPending').replace('{0}', String(newPhotos.length))}
              </Typography>
            )}
          </FormSection>

          <FormSection title={t('fleetIncidentParties')} icon={<GroupsRoundedIcon />}>
            {parties.map((party) => (
              <div key={party.key} className={classes.party}>
                <TextField
                  select
                  size="small"
                  label={t('fleetIncidentPartyRole')}
                  value={party.role}
                  onChange={(event) =>
                    setParties((current) =>
                      current.map((it) =>
                        it.key === party.key ? { ...it, role: event.target.value } : it,
                      ),
                    )
                  }
                >
                  {PARTY_ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {t(incidentKey('Party', role))}
                    </MenuItem>
                  ))}
                </TextField>
                {partyFields.map((field) => (
                  <TextField
                    key={field}
                    size="small"
                    label={t(incidentKey('PartyField', field))}
                    value={party[field] || ''}
                    onChange={(event) =>
                      setParties((current) =>
                        current.map((it) =>
                          it.key === party.key ? { ...it, [field]: event.target.value } : it,
                        ),
                      )
                    }
                  />
                ))}
                <IconButton
                  aria-label={t('sharedRemove')}
                  onClick={() =>
                    setParties((current) => current.filter((it) => it.key !== party.key))
                  }
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            ))}
            <Button
              startIcon={<AddRoundedIcon />}
              onClick={() => setParties((current) => [...current, emptyParty()])}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('fleetIncidentAddParty')}
            </Button>
          </FormSection>

          <FormSection title={t('fleetIncidentClaim')} icon={<ShieldRoundedIcon />}>
            <div className={classes.grid}>
              {claimField('insurer', 'fleetIncidentInsurer')}
              {claimField('claim_number', 'fleetIncidentClaimNumber', {
                slotProps: { htmlInput: { dir: 'ltr' } },
              })}
              {claimField('filed_at', 'fleetIncidentClaimFiledOn', {}, DateField)}
              <TextField
                select
                label={t('deviceStatus')}
                value={claim.status}
                onChange={(event) => setClaim({ ...claim, status: event.target.value })}
              >
                {CLAIM_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {t(incidentKey('Claim', status))}
                  </MenuItem>
                ))}
              </TextField>
              {claimField('deductible', 'fleetIncidentDeductible', numberProps)}
              {claimField('approved_amount', 'fleetIncidentApproved', numberProps)}
              {claimField('paid_at', 'fleetIncidentPaid', {}, DateField)}
              {claimField('notes', 'fleetNotes', {
                className: classes.full,
                multiline: true,
                minRows: 2,
              })}
            </div>
          </FormSection>
        </>
      )}
      {insuranceFile && (
        <InsuranceFileDialog
          incident={{ ...incident, occurred_at: fromLocalInput(incident.occurred_at) }}
          deviceId={deviceId}
          driverName={driverList.find((item) => String(item.id) === driverId)?.name}
          photos={photos}
          onClose={() => setInsuranceFile(false)}
        />
      )}
    </FormPage>
  );
};

export default IncidentPage;
