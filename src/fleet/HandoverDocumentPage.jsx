import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import DocumentPrintHeader from '../common/components/print/DocumentPrintHeader';
import { useAsyncTask } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import FleetNotice from './components/FleetNotice';
import { fleetFileUrl } from './fleetData';

const useStyles = makeStyles()((theme) => ({
  root: {
    maxWidth: 820,
    margin: theme.spacing(0, 3, 3),
    padding: theme.spacing(3),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 0, 2),
      borderRadius: 0,
    },
    '@media print': {
      margin: 0,
      padding: 0,
      border: 'none',
    },
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    gap: theme.spacing(1, 3),
    margin: 0,
    '& dt': {
      color: theme.palette.text.secondary,
    },
    '& dd': {
      margin: 0,
    },
  },
  photos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: theme.spacing(1),
    '& img': {
      width: '100%',
      aspectRatio: '4 / 3',
      objectFit: 'cover',
      borderRadius: theme.tokens.radius.md,
      border: `1px solid ${theme.palette.surface.border}`,
    },
  },
  signatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(3),
    '& img': {
      height: 90,
      maxWidth: '100%',
      objectFit: 'contain',
      borderBottom: `1px solid ${theme.palette.brand.ink}`,
      display: 'block',
    },
  },
  noPrint: {
    '@media print': {
      display: 'none',
    },
  },
}));

// ISR-11: a handover or return as a document for the vehicle's file: who, when, the odometer and
// fuel, the damages already there, the photos and both signatures. Prints on A4 portrait.
const HandoverDocumentPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { id } = useParams();
  const [doc, setDoc] = useState(null);

  useAsyncTask(async () => {
    const row = unwrap(
      await getFleetClient()
        .from('vehicle_handovers')
        .select('*, vehicles(plate_number), drivers(full_name)')
        .eq('id', id)
        .maybeSingle(),
    );
    if (!row) {
      setDoc({ missing: true });
      return;
    }
    const url = (path) => (path ? fleetFileUrl(path).catch(() => null) : null);
    const [photos, driverSignature, giverSignature] = await Promise.all([
      Promise.all((row.photo_paths || []).map(url)),
      url(row.driver_signature_path),
      url(row.giver_signature_path),
    ]);
    setDoc({ row, photos: photos.filter(Boolean), driverSignature, giverSignature });
  }, [id]);

  const row = doc?.row;
  const title = row
    ? `${t(row.kind === 'return' ? 'driverHandoverReturn' : 'driverHandoverTake')} · ${row.vehicles?.plate_number || ''}`
    : t('driverHandover');

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'driverHandover']}
      title={title}
    >
      <FleetNotice permission="vehicles.read" />
      {doc?.missing && (
        <Typography sx={{ mx: 3 }} color="textSecondary">
          {t('sharedNoData')}
        </Typography>
      )}
      {row && (
        <Paper elevation={0} variant="outlined" className={classes.root}>
          <DocumentPrintHeader
            kind="HANDOVER"
            portrait
            title={title}
            lines={[
              `${t('sharedDriver')}: ${row.drivers?.full_name || '—'}`,
              formatTime(row.created_at, 'minutes'),
            ]}
          />
          <Stack direction="row" className={classes.noPrint} sx={{ justifyContent: 'flex-end' }}>
            <Button startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
              {t('dashboardPrint')}
            </Button>
          </Stack>
          <dl className={classes.facts}>
            <dt>{t('sharedDevice')}</dt>
            <dd dir="ltr" style={{ textAlign: 'start' }}>
              {row.vehicles?.plate_number || '—'}
            </dd>
            <dt>{t('sharedDriver')}</dt>
            <dd>{row.drivers?.full_name || '—'}</dd>
            <dt>{t('fleetExpenseDate')}</dt>
            <dd>{formatTime(row.created_at, 'minutes')}</dd>
            <dt>{t('driverHandoverKm')}</dt>
            <dd>{row.odometer_km ?? '—'}</dd>
            <dt>{t('driverHandoverFuel')}</dt>
            <dd>{row.fuel_percent == null ? '—' : `${row.fuel_percent}%`}</dd>
            <dt>{t('driverHandoverDamages')}</dt>
            <dd>{row.damages || '—'}</dd>
          </dl>
          {doc.photos.length > 0 && (
            <>
              <Typography variant="subtitle2" component="h2">
                {t('driverHandoverPhotos')}
              </Typography>
              <div className={classes.photos}>
                {doc.photos.map((src, index) => (
                  <img key={src} src={src} alt={`${t('driverHandoverPhotos')} ${index + 1}`} />
                ))}
              </div>
            </>
          )}
          <div className={classes.signatures}>
            <div>
              {doc.driverSignature && (
                <img src={doc.driverSignature} alt={t('driverHandoverSignature')} />
              )}
              <Typography variant="body2">
                {`${t('driverHandoverSignature')}: ${row.drivers?.full_name || ''}`}
              </Typography>
            </div>
            <div>
              {doc.giverSignature && (
                <img src={doc.giverSignature} alt={t('driverHandoverGiverSignature')} />
              )}
              <Typography variant="body2">
                {`${t('driverHandoverGiverSignature')}${row.giver_name ? `: ${row.giver_name}` : ''}`}
              </Typography>
            </div>
          </div>
        </Paper>
      )}
    </PageLayout>
  );
};

export default HandoverDocumentPage;
