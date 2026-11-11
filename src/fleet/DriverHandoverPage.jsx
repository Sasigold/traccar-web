import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import { useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetProfile } from '../common/fleet/useFleet';
import { odometerKm } from '../common/fleet/workOrders';
import { useLivePositions } from '../common/fleet/usePrivacy';
import useDriverContext from './useDriverContext';
import SignaturePad from './components/SignaturePad';
import DriverDoneCard from './components/DriverDoneCard';
import { uploadFleetFile } from './fleetData';

const useStyles = makeStyles()((theme) => ({
  root: {
    maxWidth: 520,
    margin: theme.spacing(2, 'auto'),
    padding: theme.spacing(0, 2),
  },
  card: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  photos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
  },
  photo: {
    minHeight: 56,
    justifyContent: 'flex-start',
    gap: theme.spacing(1),
  },
}));

export const HANDOVER_SIDES = ['front', 'back', 'left', 'right'];
const FUEL_LEVELS = [0, 25, 50, 75, 100];
const asFile = (blob, name) => new File([blob], name, { type: 'image/png' });

// ISR-11: handing the vehicle over or taking it back, in the driver area instead of on paper: the
// km, the fuel, a photo of each side, the damage already there, and signatures.
const DriverHandoverPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const context = useDriverContext();
  const positions = useLivePositions();
  const vehicle = context?.assignment;
  const suggestedKm = odometerKm(positions[vehicle?.traccar_device_id]);

  const [kind, setKind] = useState('handover');
  // The odometer is suggested once, when the position arrives; after that the field is the
  // driver's (clearing it does not bring the suggestion back under their typing).
  const [km, setKm] = useState('');
  const [kmTouched, setKmTouched] = useState(false);
  const shownKm = kmTouched ? km : km || (suggestedKm ?? '');
  const [fuel, setFuel] = useState(null);
  const [photos, setPhotos] = useState({});
  const [damages, setDamages] = useState('');
  const [signature, setSignature] = useState(null);
  const [giverName, setGiverName] = useState('');
  const [giverSignature, setGiverSignature] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const devices = useSelector((state) => state.devices.items);

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const upload = (file) => uploadFleetFile(profile.org_id, 'inspections', file);
      const photoPaths = [];
      for (const side of HANDOVER_SIDES) {
        if (photos[side]) photoPaths.push(await upload(photos[side]));
      }
      unwrap(
        await getFleetClient()
          .from('vehicle_handovers')
          .insert({
            org_id: profile.org_id,
            vehicle_id: vehicle.vehicle_id,
            driver_id: context.driver.id,
            kind,
            odometer_km: Number(shownKm) || null,
            fuel_percent: fuel,
            photo_paths: photoPaths,
            damages: damages.trim() || null,
            driver_signature_path: await upload(asFile(signature, 'driver-signature.png')),
            giver_name: giverName.trim() || null,
            giver_signature_path: giverSignature
              ? await upload(asFile(giverSignature, 'giver-signature.png'))
              : null,
          }),
      );
      setDone(new Date());
    } finally {
      setSaving(false);
    }
  });

  const vehicleName = devices[vehicle?.traccar_device_id]?.name || vehicle?.plate_number || '';
  const ready = vehicle && signature && fuel != null && shownKm !== '';

  return (
    <PageLayout breadcrumbs={['fleetDriverPortal']} title={t('driverHandover')}>
      <div className={classes.root}>
        {done ? (
          <DriverDoneCard
            titleKey={kind === 'handover' ? 'driverHandoverDone' : 'driverReturnDone'}
            time={done}
          />
        ) : context && !vehicle ? (
          <Alert severity="info">{t('driverNoVehicle')}</Alert>
        ) : (
          <Paper elevation={0} className={classes.card}>
            <Typography variant="subtitle1" component="h2">
              <span dir="auto">{vehicleName}</span>
            </Typography>
            <ToggleButtonGroup
              exclusive
              color="primary"
              value={kind}
              onChange={(_, value) => value && setKind(value)}
              aria-label={t('driverHandover')}
            >
              <ToggleButton value="handover">{t('driverHandoverTake')}</ToggleButton>
              <ToggleButton value="return">{t('driverHandoverReturn')}</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              type="number"
              label={t('driverHandoverKm')}
              value={shownKm}
              onChange={(event) => {
                setKmTouched(true);
                setKm(event.target.value);
              }}
              slotProps={{ htmlInput: { min: 0, dir: 'ltr', inputMode: 'numeric' } }}
            />
            <div>
              <Typography variant="body2" gutterBottom id="fuel-label">
                {t('driverHandoverFuel')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={fuel}
                onChange={(_, value) => value != null && setFuel(value)}
                aria-labelledby="fuel-label"
              >
                {FUEL_LEVELS.map((level) => (
                  <ToggleButton key={level} value={level}>
                    <span dir="ltr">{`${level}%`}</span>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </div>
            <div>
              <Typography variant="body2" gutterBottom>
                {t('driverHandoverPhotos')}
              </Typography>
              <div className={classes.photos}>
                {HANDOVER_SIDES.map((side) => (
                  <Button
                    key={side}
                    variant={photos[side] ? 'contained' : 'outlined'}
                    color={photos[side] ? 'success' : 'primary'}
                    component="label"
                    className={classes.photo}
                  >
                    <PhotoCameraRoundedIcon />
                    {t(`driverHandoverSide${side[0].toUpperCase()}${side.slice(1)}`)}
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      capture="environment"
                      aria-label={t(`driverHandoverSide${side[0].toUpperCase()}${side.slice(1)}`)}
                      onChange={(event) =>
                        setPhotos({ ...photos, [side]: event.target.files?.[0] || null })
                      }
                    />
                  </Button>
                ))}
              </div>
            </div>
            <TextField
              label={t('driverHandoverDamages')}
              helperText={t('driverHandoverDamagesHelp')}
              value={damages}
              onChange={(event) => setDamages(event.target.value)}
              multiline
              minRows={2}
            />
            <SignaturePad label={t('driverHandoverSignature')} onChange={setSignature} />
            <TextField
              label={t('driverHandoverGiver')}
              value={giverName}
              onChange={(event) => setGiverName(event.target.value)}
            />
            {giverName.trim() && (
              <SignaturePad
                label={t('driverHandoverGiverSignature')}
                onChange={setGiverSignature}
              />
            )}
            <Button variant="contained" size="large" onClick={save} disabled={!ready || saving}>
              {t('driverHandoverSave')}
            </Button>
          </Paper>
        )}
      </div>
    </PageLayout>
  );
};

export default DriverHandoverPage;
