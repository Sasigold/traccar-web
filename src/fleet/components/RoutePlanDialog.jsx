import { useMemo, useState } from 'react';
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
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { isOpenJob } from '../../common/fleet/dispatch';
import { planRoute } from '../../common/fleet/routing';
import { formatTime } from '../../common/util/formatter';
import { wazeUrl } from '../../common/util/waze';
import { keepOnBackdrop } from '../../common/util/formDialog';

const useStyles = makeStyles()((theme) => ({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
  },
}));

const located = (job) => Number.isFinite(job.latitude) && Number.isFinite(job.longitude);

// OPS-03: one vehicle's open stops in a good order, from where the vehicle is now: the order,
// the arrival times, the km and what would be late. "Apply" saves the order, and the driver's
// list follows it, each stop with its Waze button.
const RoutePlanDialog = ({ jobs, positions, onClose, onApplied }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const byVehicle = useMemo(() => {
    const map = new Map();
    jobs
      .filter((job) => isOpenJob(job.status) && job.vehicle_id && located(job))
      .forEach((job) => {
        const list = map.get(job.vehicle_id) || [];
        list.push(job);
        map.set(job.vehicle_id, list);
      });
    return map;
  }, [jobs]);
  const vehicles = [...byVehicle.entries()].filter(([, list]) => list.length > 1);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.[0] || '');

  const stops = useMemo(() => byVehicle.get(vehicleId) || [], [byVehicle, vehicleId]);
  const deviceId = stops[0]?.vehicles?.traccar_device_id;
  const position = positions[deviceId];
  const route = useMemo(() => {
    if (!stops.length) return null;
    const start = position || stops[0];
    return planRoute(
      start,
      stops.map((job) => ({
        ...job,
        windowEnd: job.window_end ? Date.parse(job.window_end) : null,
      })),
      { startTime: Date.now() },
    );
  }, [stops, position]);

  const apply = useCatch(async () => {
    const client = getFleetClient();
    for (const [index, leg] of route.legs.entries()) {
      unwrap(
        await client
          .from('dispatch_jobs')
          .update({ route_order: index + 1 })
          .eq('id', leg.stop.id),
      );
    }
    onApplied();
  });

  const plate = (id) => byVehicle.get(id)?.[0]?.vehicles?.plate_number || id;

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="sm">
      <DialogTitle>{t('fleetRoutePlan')}</DialogTitle>
      <DialogContent>
        <div className={classes.body}>
          {!vehicles.length ? (
            <Alert severity="info">{t('fleetRoutePlanNone')}</Alert>
          ) : (
            <>
              <TextField
                select
                label={t('fleetEntityVehicle')}
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
              >
                {vehicles.map(([id, list]) => (
                  <MenuItem key={id} value={id}>
                    <span dir="ltr">{plate(id)}</span>
                    {` · ${t('fleetRoutePlanStops').replace('{0}', String(list.length))}`}
                  </MenuItem>
                ))}
              </TextField>
              {route && (
                <>
                  <Typography variant="body2" color="textSecondary">
                    {t(position ? 'fleetRoutePlanFromVehicle' : 'fleetRoutePlanFromFirst')}
                    {' · '}
                    {t('fleetRoutePlanKm').replace('{0}', String(route.km))}
                  </Typography>
                  {route.lateMinutes > 0 && (
                    <Alert severity="warning">
                      {t('fleetRoutePlanLate').replace('{0}', String(route.lateMinutes))}
                    </Alert>
                  )}
                  <List dense aria-label={t('fleetRoutePlan')}>
                    {route.legs.map((leg, index) => (
                      <ListItem
                        key={leg.stop.id}
                        secondaryAction={
                          <Button
                            size="small"
                            href={wazeUrl(leg.stop)}
                            target="_blank"
                            rel="noopener"
                          >
                            Waze
                          </Button>
                        }
                      >
                        <ListItemText
                          primary={`${index + 1}. ${leg.stop.title}`}
                          secondary={[
                            formatTime(new Date(leg.arrival).toISOString(), 'minutes'),
                            leg.stop.customer_name || leg.stop.address,
                            leg.lateMinutes > 0
                              ? t('fleetRoutePlanStopLate').replace(
                                  '{0}',
                                  String(Math.round(leg.lateMinutes)),
                                )
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          slotProps={{ secondary: { className: classes.number } }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Typography variant="caption" color="textSecondary">
                    {t('fleetRoutePlanHint')}
                  </Typography>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={apply} disabled={!route}>
          {t('fleetRoutePlanApply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoutePlanDialog;
