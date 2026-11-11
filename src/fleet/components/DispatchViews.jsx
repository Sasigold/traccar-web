import { useMemo } from 'react';
import { ButtonBase, Paper, Stack, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import MapView from '../../map/core/MapView';
import MapMarkers from '../../map/MapMarkers';
import MapCamera from '../../map/MapCamera';
import MapScale from '../../map/MapScale';
import { formatTime } from '../../common/util/formatter';
import { isLateJob, jobMarkerColor, scheduleByDriver } from '../../common/fleet/dispatch';

const useStyles = makeStyles()((theme) => ({
  map: {
    position: 'relative',
    height: 'min(60vh, 560px)',
    margin: theme.spacing(0, 3, 3),
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.surface.border}`,
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 0, 2),
      borderRadius: 0,
      borderInline: 'none',
    },
  },
  schedule: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(2),
    margin: theme.spacing(0, 3, 3),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 2, 2),
    },
  },
  column: {
    padding: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  job: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1, 1.25),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    textAlign: 'start',
    width: '100%',
  },
  late: {
    borderInlineStart: `3px solid ${theme.palette.error.main}`,
  },
}));

// ADM-20: the jobs shown, on a map: each job a point in its status color, and the vehicles that
// have a job, where they are now. A job opens on a click.
export const DispatchMap = ({ jobs, positions, onOpen }) => {
  const { classes } = useStyles();
  const markers = useMemo(
    () =>
      jobs
        .filter((job) => job.latitude != null && job.longitude != null)
        .map((job) => ({
          id: job.id,
          latitude: job.latitude,
          longitude: job.longitude,
          image: `default-${jobMarkerColor(job)}`,
          title: `${job.number ? `#${job.number} ` : ''}${job.title || ''}`,
        })),
    [jobs],
  );
  const vehicles = useMemo(() => {
    const seen = new Set();
    return jobs
      .map((job) => job.vehicles?.traccar_device_id)
      .filter((deviceId) => deviceId && !seen.has(deviceId) && seen.add(deviceId))
      .map((deviceId) => positions[deviceId])
      .filter(Boolean)
      .map((position) => ({
        latitude: position.latitude,
        longitude: position.longitude,
        image: 'car-info',
        rotation: position.course,
      }));
  }, [jobs, positions]);
  return (
    <div className={classes.map}>
      <MapView>
        <MapMarkers markers={vehicles} />
        <MapMarkers
          markers={markers}
          showTitles
          onClick={onOpen && ((properties) => onOpen(jobs.find((job) => job.id === properties.id)))}
        />
        {markers.length > 0 && <MapCamera positions={markers} />}
      </MapView>
      <MapScale />
    </div>
  );
};

// ADM-20: each driver's day: their jobs in time order, late ones marked; jobs with no driver last.
export const DispatchSchedule = ({ jobs, onOpen, StatusChip }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const groups = useMemo(() => scheduleByDriver(jobs), [jobs]);
  return (
    <div className={classes.schedule}>
      {groups.map((group) => (
        <Paper
          key={group.driverId || 'none'}
          variant="outlined"
          className={classes.column}
          component="section"
          aria-label={group.name || t('fleetJobNoDriver')}
        >
          <Typography variant="subtitle2" component="h2">
            {group.name || t('fleetJobNoDriver')}
            {` · ${group.jobs.length}`}
          </Typography>
          {group.jobs.map((job) => (
            <ButtonBase
              key={job.id}
              className={cx(classes.job, isLateJob(job) && classes.late)}
              disabled={!onOpen}
              onClick={() => onOpen?.(job)}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={600} dir="ltr">
                  {job.scheduled_at ? formatTime(job.scheduled_at, 'clock') : '—'}
                </Typography>
                <StatusChip status={job.status} late={isLateJob(job)} />
              </Stack>
              <Typography variant="body2">{job.title}</Typography>
              {(job.customer_name || job.pois?.name) && (
                <Typography variant="caption" color="textSecondary">
                  {job.customer_name || job.pois?.name}
                </Typography>
              )}
            </ButtonBase>
          ))}
        </Paper>
      ))}
    </div>
  );
};
