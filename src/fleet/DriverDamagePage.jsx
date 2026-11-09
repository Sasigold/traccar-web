import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import NoCrashRoundedIcon from '@mui/icons-material/NoCrashRounded';
import BrokenImageRoundedIcon from '@mui/icons-material/BrokenImageRounded';
import WindowRoundedIcon from '@mui/icons-material/WindowRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import { DateTimeField } from '../common/components/pickers';
import { useCatch } from '../reactHelper';
import { useFleetProfile } from '../common/fleet/useFleet';
import { fromLocalInput, toLocalInput } from '../common/fleet/incidents';
import FleetNotice from './components/FleetNotice';
import DriverDoneCard from './components/DriverDoneCard';
import useDriverContext from './useDriverContext';
import { incidentKey } from './IncidentsPage';
import { enqueue, newId, sendItem, shrinkImage } from '../common/fleet/outbox';
import './driverOutbox';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 2, 4),
    maxWidth: 560,
    width: '100%',
    marginInline: 'auto',
  },
  card: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  big: {
    minHeight: 56,
  },
  camera: {
    minHeight: 72,
    fontSize: '1rem',
  },
  photos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1),
  },
  photo: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: theme.tokens.radius.md,
    overflow: 'hidden',
    '& img': {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
  },
  remove: {
    position: 'absolute',
    insetBlockStart: 4,
    insetInlineEnd: 4,
    minWidth: 0,
    padding: 4,
    backgroundColor: theme.palette.background.paper,
    '&:hover': {
      backgroundColor: theme.palette.background.paper,
    },
  },
  types: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    '& .MuiToggleButton-root': {
      minHeight: 80,
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      borderRadius: `${theme.tokens.radius.lg}px !important`,
      border: `1px solid ${theme.palette.divider} !important`,
      margin: '0 !important',
    },
  },
  yesNo: {
    '& .MuiToggleButton-root': {
      minHeight: 56,
      minWidth: 96,
    },
  },
  nav: {
    display: 'flex',
    gap: theme.spacing(1),
    '& > *': {
      flex: 1,
      minHeight: 56,
    },
  },
}));

const TYPES = [
  { value: 'accident', icon: CarCrashRoundedIcon },
  { value: 'damage', icon: BuildRoundedIcon },
  { value: 'glass', icon: WindowRoundedIcon },
  { value: 'vandalism', icon: BrokenImageRoundedIcon },
  { value: 'theft', icon: NoCrashRoundedIcon },
  { value: 'other', icon: MoreHorizRoundedIcon },
];
const STEPS = ['driverDamageStepPhotos', 'driverDamageStepWhat', 'driverDamageStepParty'];

// A camera button: opens the camera on a phone, the file picker elsewhere.
const CameraButton = ({ label, onFiles, multiple = false, main = false, className }) => (
  <Button
    component="label"
    variant={main ? 'contained' : 'outlined'}
    startIcon={<PhotoCameraRoundedIcon />}
    className={className}
  >
    {label}
    <input
      hidden
      type="file"
      accept="image/*"
      capture="environment"
      multiple={multiple}
      onChange={(event) => {
        onFiles([...event.target.files]);
        event.target.value = '';
      }}
    />
  </Button>
);

// Thumbnails of picked photos, with object URLs released when they go.
const Thumbnails = ({ files, onRemove }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  if (!files.length) {
    return null;
  }
  return (
    <div className={classes.photos}>
      {files.map((file, index) => (
        <div key={urls[index]} className={classes.photo}>
          <img src={urls[index]} alt={`${t('driverDamagePhoto')} ${index + 1}`} />
          <Button
            size="small"
            className={classes.remove}
            aria-label={`${t('sharedRemove')} ${index + 1}`}
            onClick={() => onRemove(index)}
          >
            <DeleteOutlineRoundedIcon fontSize="small" />
          </Button>
        </div>
      ))}
    </div>
  );
};

// /driver/damage (ADM-09): a damage report in three steps that starts with the camera. The
// driver and the vehicle come from the assignment and are not asked; time and place are filled in.
const DriverDamagePage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const profile = useFleetProfile();
  const context = useDriverContext();
  const assignment = context?.assignment;
  const position = useSelector((state) =>
    assignment ? state.session.positions[assignment.traccar_device_id] : null,
  );

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [report, setReport] = useState(() => ({
    type: '',
    injuries: null,
    occurred_at: toLocalInput(),
    address: '',
    description: '',
  }));
  const [partyInvolved, setPartyInvolved] = useState(null);
  const [party, setParty] = useState({
    name: '',
    phone: '',
    plate_number: '',
    insurer: '',
    policy_number: '',
  });
  const [licensePhoto, setLicensePhoto] = useState([]);
  const [insurancePhoto, setInsurancePhoto] = useState([]);
  const [saving, setSaving] = useState(false);
  // ADM-10: the report waits in the phone (the outbox) until it is through.
  const [pending, setPending] = useState(null);
  const [filesLeft, setFilesLeft] = useState(0);
  const [done, setDone] = useState(null);

  const set = (changes) => setReport((current) => ({ ...current, ...changes }));
  const setPartyField = (key) => (event) => setParty({ ...party, [key]: event.target.value });
  const place = report.address || position?.address || '';

  const submit = useCatch(async () => {
    setSaving(true);
    try {
      // The report is put in the outbox once; pressing again only retries what is left.
      let item = pending;
      if (!item) {
        const incidentId = newId();
        const files = await Promise.all(
          [
            ...photos.map((file) => [file, file.name]),
            ...licensePhoto.map((file) => [file, `party-license-${file.name}`]),
            ...insurancePhoto.map((file) => [file, `party-insurance-${file.name}`]),
          ].map(async ([file, label]) => {
            const small = await shrinkImage(file);
            return {
              blob: small,
              name: small.name,
              type: small.type,
              label,
              lastModified: file.lastModified,
            };
          }),
        );
        const party = partyInvolved
          ? {
              id: newId(),
              org_id: profile.org_id,
              incident_id: incidentId,
              role: 'third_party',
              ...Object.fromEntries(
                Object.entries(party).map(([key, value]) => [key, value.trim() || null]),
              ),
            }
          : null;
        item = await enqueue(
          'damage',
          {
            incident: {
              id: incidentId,
              org_id: profile.org_id,
              vehicle_id: assignment.vehicle_id,
              driver_id: context.driver.id,
              occurred_at: fromLocalInput(report.occurred_at),
              type: report.type,
              injuries: Boolean(report.injuries),
              description: report.description.trim() || null,
              latitude: position?.latitude ?? null,
              longitude: position?.longitude ?? null,
              address: place.trim() || null,
              reported_by: profile.id,
            },
            party,
          },
          files,
        );
        setPending(item);
      }
      const result = await sendItem(item);
      if (result.sent) {
        setDone({ time: new Date(), queued: false });
      } else if (!result.item?.saved) {
        // No line: the report stays in the phone and goes when there is one.
        setDone({ time: new Date(), queued: true });
      } else {
        setFilesLeft(result.filesLeft);
      }
    } finally {
      setSaving(false);
    }
  });

  const content = () => {
    if (context === undefined) {
      return null;
    }
    if (!context.driver || !assignment) {
      return (
        <Alert severity="info">
          {t(context.driver ? 'driverNoVehicle' : 'fleetDriverPortalNotLinked')}
        </Alert>
      );
    }
    if (done) {
      return done.queued ? (
        <DriverDoneCard titleKey="driverDamageQueued" time={done.time} pending>
          <Typography color="textSecondary">{t('driverDamageQueuedText')}</Typography>
        </DriverDoneCard>
      ) : (
        <DriverDoneCard titleKey="driverDamageSent" time={done.time} />
      );
    }

    const stepValid = [
      true,
      Boolean(report.type) && report.injuries != null,
      partyInvolved != null,
    ][step];

    return (
      <>
        <Typography variant="body1">
          {t('driverDamageVehicle')
            .replace('{0}', assignment.plate_number || '')
            .replace('{1}', context.driver.full_name || '')}
        </Typography>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Paper elevation={0} className={classes.card}>
          {step === 0 && (
            <>
              <Typography variant="body2">{t('driverDamagePhotosHelp')}</Typography>
              <CameraButton
                label={t(photos.length ? 'driverDamageMorePhotos' : 'driverDamageTakePhotos')}
                main={!photos.length}
                multiple
                className={classes.camera}
                onFiles={(files) => setPhotos([...photos, ...files])}
              />
              <Thumbnails
                files={photos}
                onRemove={(index) => setPhotos(photos.filter((_, i) => i !== index))}
              />
            </>
          )}

          {step === 1 && (
            <>
              <Typography variant="subtitle2" component="h2" id="damage-type">
                {t('driverDamageWhat')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={report.type}
                onChange={(_, value) => value && set({ type: value })}
                className={classes.types}
                aria-labelledby="damage-type"
              >
                {TYPES.map(({ value, icon: Icon }) => (
                  <ToggleButton key={value} value={value}>
                    <Icon />
                    {t(incidentKey('Type', value))}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="subtitle2" component="h2" id="damage-injuries">
                {t('driverDamageInjuries')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={report.injuries}
                onChange={(_, value) => value != null && set({ injuries: value })}
                className={classes.yesNo}
                aria-labelledby="damage-injuries"
              >
                <ToggleButton value>{t('sharedYes')}</ToggleButton>
                <ToggleButton value={false}>{t('sharedNo')}</ToggleButton>
              </ToggleButtonGroup>
              {report.injuries && <Alert severity="error">{t('driverDamageCallHelp')}</Alert>}
              <DateTimeField
                label={t('fleetIncidentOccurred')}
                value={report.occurred_at}
                minuteStep={1}
                onChange={(event) => set({ occurred_at: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={t('positionAddress')}
                value={place}
                helperText={position ? t('driverDamagePlaceHelp') : undefined}
                onChange={(event) => set({ address: event.target.value })}
              />
              <TextField
                label={t('driverDamageDescription')}
                value={report.description}
                onChange={(event) => set({ description: event.target.value })}
                multiline
                minRows={3}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Typography variant="subtitle2" component="h2" id="damage-party">
                {t('driverDamagePartyQuestion')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={partyInvolved}
                onChange={(_, value) => value != null && setPartyInvolved(value)}
                className={classes.yesNo}
                aria-labelledby="damage-party"
              >
                <ToggleButton value>{t('sharedYes')}</ToggleButton>
                <ToggleButton value={false}>{t('sharedNo')}</ToggleButton>
              </ToggleButtonGroup>
              {partyInvolved && (
                <>
                  <CameraButton
                    label={t('driverDamageLicensePhoto')}
                    className={classes.big}
                    onFiles={setLicensePhoto}
                  />
                  <Thumbnails files={licensePhoto} onRemove={() => setLicensePhoto([])} />
                  <CameraButton
                    label={t('driverDamageInsurancePhoto')}
                    className={classes.big}
                    onFiles={setInsurancePhoto}
                  />
                  <Thumbnails files={insurancePhoto} onRemove={() => setInsurancePhoto([])} />
                  <TextField
                    label={t(incidentKey('PartyField', 'name'))}
                    value={party.name}
                    onChange={setPartyField('name')}
                  />
                  <TextField
                    label={t(incidentKey('PartyField', 'phone'))}
                    type="tel"
                    value={party.phone}
                    onChange={setPartyField('phone')}
                  />
                  <TextField
                    label={t(incidentKey('PartyField', 'plate_number'))}
                    value={party.plate_number}
                    onChange={setPartyField('plate_number')}
                    slotProps={{ htmlInput: { dir: 'ltr' } }}
                  />
                  <TextField
                    label={t(incidentKey('PartyField', 'insurer'))}
                    value={party.insurer}
                    onChange={setPartyField('insurer')}
                  />
                  <TextField
                    label={t(incidentKey('PartyField', 'policy_number'))}
                    value={party.policy_number}
                    onChange={setPartyField('policy_number')}
                    slotProps={{ htmlInput: { dir: 'ltr' } }}
                  />
                </>
              )}
              {filesLeft > 0 && (
                <Alert severity="warning" role="alert">
                  {t('driverDamagePartialCount').replace('{0}', filesLeft)}
                </Alert>
              )}
            </>
          )}
        </Paper>

        <div className={classes.nav}>
          <Button
            variant="outlined"
            onClick={() => (step === 0 ? navigate('/driver') : setStep(step - 1))}
            disabled={saving}
          >
            {t(step === 0 ? 'sharedCancel' : 'a11yBack')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              variant={step === 0 && !photos.length ? 'outlined' : 'contained'}
              onClick={() => setStep(step + 1)}
              disabled={!stepValid}
            >
              {t('setupContinue')}
            </Button>
          ) : (
            <Button variant="contained" onClick={submit} disabled={!stepValid || saving}>
              {t(filesLeft > 0 ? 'driverDamageRetry' : 'driverDamageSend')}
            </Button>
          )}
        </div>
      </>
    );
  };

  return (
    <PageLayout breadcrumbs={['fleetDriverPortal']} title={t('fleetIncidentAdd')}>
      <FleetNotice permission="incidents.write" />
      <div className={classes.root}>{content()}</div>
    </PageLayout>
  );
};

export default DriverDamagePage;
