import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import BrandLogo from '../../common/components/brand/BrandLogo';
import BrandLoader from '../../common/components/brand/BrandLoader';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { formatTime } from '../../common/util/formatter';
import { accidentWindow } from '../../common/fleet/accident';
import { plateOf } from '../../reports/common/vehicle';

const useStyles = makeStyles()((theme) => ({
  paper: {
    // Printing shows only this file (public/styles.css hides the app behind it).
    '@media print': {
      position: 'static',
      boxShadow: 'none',
      margin: 0,
      maxHeight: 'none',
    },
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    borderBottom: `2px solid ${theme.palette.text.primary}`,
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    gap: theme.spacing(0.5, 3),
    marginBottom: theme.spacing(2),
  },
  photos: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    '& img': {
      width: 180,
      height: 135,
      objectFit: 'cover',
      borderRadius: theme.tokens.radius.md,
    },
  },
  scroll: {
    overflowX: 'auto',
  },
  impact: {
    fontWeight: 700,
    backgroundColor: theme.palette.surface.tint,
  },
  actions: {
    '@media print': {
      display: 'none',
    },
  },
}));

// SAF-04: one file for the insurer: what happened, where and when, who drove, the minute before
// and after from the tracker, and the photos. Printed (or saved as PDF) from the browser.
const InsuranceFileDialog = ({ incident, deviceId, driverName, photos, onClose }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const device = useSelector((state) => state.devices.items[deviceId]);
  const [track, setTrack] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      const at = Date.parse(incident.occurred_at);
      const query = new URLSearchParams({
        deviceId,
        from: new Date(at - 90000).toISOString(),
        to: new Date(at + 90000).toISOString(),
      });
      const response = await fetchOrThrow(`api/positions?${query}`, { signal });
      setTrack(accidentWindow(await response.json(), incident.occurred_at));
    },
    [deviceId, incident.occurred_at],
  );

  const fact = (labelKey, value) =>
    value
      ? [
          <Typography key={`${labelKey}-l`} color="textSecondary">
            {t(labelKey)}
          </Typography>,
          <Typography key={labelKey}>{value}</Typography>,
        ]
      : null;

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      className="vf-insurance-file"
      slotProps={{ paper: { className: classes.paper } }}
    >
      <DialogTitle component="div" className={classes.header}>
        <div>
          <Typography variant="h5" component="h2">
            {t('insuranceFileTitle')}
          </Typography>
          <Typography color="textSecondary">
            {`${t('fleetIncident')} ${incident.number || ''} · ${formatTime(incident.occurred_at, 'minutes')}`}
          </Typography>
        </div>
        <BrandLogo variant={theme.palette.mode === 'dark' ? 'reverse' : 'ink'} height={32} />
      </DialogTitle>
      <DialogContent>
        <div className={classes.facts}>
          {fact('sharedDevice', [device?.name, plateOf(device)].filter(Boolean).join(' · '))}
          {fact('sharedDriver', driverName)}
          {fact('positionAddress', incident.address)}
          {fact('fleetIncidentDescription', incident.description)}
          {track?.impact &&
            fact(
              'insuranceFileSpeedBefore',
              t('insuranceFileKmh').replace('{0}', track.maxSpeedBefore),
            )}
          {track?.impact &&
            fact(
              'insuranceFileBraking',
              t('insuranceFileKmhPerSecond').replace('{0}', track.maxDeceleration),
            )}
        </div>
        <Typography variant="subtitle1" gutterBottom>
          {t('insuranceFileTrack')}
        </Typography>
        {!track && <BrandLoader size={48} label={t('sharedLoading')} />}
        {track && !track.rows.length && (
          <Typography color="textSecondary">{t('insuranceFileNoTrack')}</Typography>
        )}
        {track && track.rows.length > 0 && (
          <div className={classes.scroll}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('insuranceFileSeconds')}</TableCell>
                  <TableCell>{t('positionSpeed')}</TableCell>
                  <TableCell>{t('positionCourse')}</TableCell>
                  <TableCell>{t('positionLatitude')}</TableCell>
                  <TableCell>{t('positionLongitude')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {track.rows.map((row) => (
                  <TableRow
                    key={row.offset}
                    className={row === track.impact ? classes.impact : undefined}
                  >
                    <TableCell dir="ltr">
                      {row.offset > 0 ? `+${row.offset}` : row.offset}
                    </TableCell>
                    <TableCell>{t('insuranceFileKmh').replace('{0}', row.speedKmh)}</TableCell>
                    <TableCell>{`${row.course}°`}</TableCell>
                    <TableCell dir="ltr">{row.latitude?.toFixed(5)}</TableCell>
                    <TableCell dir="ltr">{row.longitude?.toFixed(5)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {photos.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 2 }} gutterBottom>
              {t('insuranceFilePhotos')}
            </Typography>
            <div className={classes.photos}>
              {photos.map((photo) => (
                <img key={photo.id || photo.url} src={photo.url} alt={photo.caption || ''} />
              ))}
            </div>
          </>
        )}
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button onClick={onClose}>{t('sharedClose')}</Button>
        <Button variant="contained" onClick={() => window.print()} disabled={!track}>
          {t('insuranceFilePrint')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InsuranceFileDialog;
