import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { makeStyles } from 'tss-react/mui';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useRestriction } from '../../common/util/permissions';
import { formatTime } from '../../common/util/formatter';
import { messagesActions } from '../../store';
import { isTimeType } from '../../common/fleet/maintenanceStatus';
import { markMaintenanceDone, useMaintenanceFormat } from '../maintenance';

const useStyles = makeStyles()((theme) => ({
  number: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  action: {
    width: '1%',
    whiteSpace: 'nowrap',
  },
  muted: {
    color: theme.palette.text.secondary,
  },
}));

const chipColor = { overdue: 'error', due: 'warning', ok: 'success', unknown: 'default' };

export const maintenanceLabelKey = {
  overdue: 'fleetMaintenanceOverdue',
  due: 'fleetMaintenanceDue',
  ok: 'fleetMaintenanceOk',
  unknown: 'fleetMaintenanceUnknown',
};

export const MaintenanceChip = ({ status }) => {
  const t = useTranslation();
  return (
    <Chip
      size="small"
      color={chipColor[status]}
      variant={status === 'unknown' ? 'outlined' : 'filled'}
      label={t(maintenanceLabelKey[status])}
    />
  );
};

// rows: output of useMaintenanceRows. shared: maintenance id -> number of linked vehicles.
// `bare` returns only the head and body, for use inside DataTable.
const MaintenanceStatusTable = ({ rows, shared = {}, showVehicle, onDone, bare }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const readonly = useRestriction('readonly');
  const format = useMaintenanceFormat();

  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);

  const remainingText = (row) => {
    const { remaining } = row.state;
    if (remaining == null) {
      return '';
    }
    const amount = format(row.maintenance.type, Math.abs(remaining));
    return t(remaining < 0 ? 'fleetMaintenanceOverdueBy' : 'fleetMaintenanceRemaining').replace(
      '{0}',
      amount,
    );
  };

  const nextText = (row) => {
    const { next } = row.state;
    if (next == null) {
      return '';
    }
    return isTimeType(row.maintenance.type)
      ? formatTime(next, 'date')
      : format(row.maintenance.type, next);
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await markMaintenanceDone(pending.maintenance, pending.state.current);
      setPending(null);
      onDone?.();
    } catch (error) {
      dispatch(messagesActions.push(error.message));
    } finally {
      setSaving(false);
    }
  };

  const sharedCount = pending ? shared[pending.maintenance.id] || 1 : 0;

  const content = (
    <>
      <TableHead>
        <TableRow>
          {showVehicle && <TableCell>{t('fleetEntityVehicle')}</TableCell>}
          <TableCell>{t('sharedName')}</TableCell>
          <TableCell>{t('deviceStatus')}</TableCell>
          <TableCell>{t('fleetMaintenanceLeft')}</TableCell>
          <TableCell>{t('fleetMaintenanceNext')}</TableCell>
          {!readonly && <TableCell className={classes.action} />}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key} hover>
            {showVehicle && (
              <TableCell>
                <Link component={RouterLink} to={`/settings/device/${row.deviceId}`}>
                  {row.device?.name || row.deviceId}
                </Link>
              </TableCell>
            )}
            <TableCell>{row.maintenance.name}</TableCell>
            <TableCell>
              <MaintenanceChip status={row.state.status} />
            </TableCell>
            <TableCell className={classes.number}>{remainingText(row)}</TableCell>
            <TableCell className={classes.number}>{nextText(row)}</TableCell>
            {!readonly && (
              <TableCell className={classes.action}>
                <Button
                  size="small"
                  startIcon={<TaskAltRoundedIcon />}
                  disabled={row.state.current == null}
                  onClick={() => setPending(row)}
                >
                  {t('fleetMaintenanceMarkDone')}
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </>
  );

  return (
    <>
      {bare ? content : <ResponsiveTable size="small">{content}</ResponsiveTable>}
      <Dialog open={Boolean(pending)} onClose={() => !saving && setPending(null)}>
        <DialogTitle>{t('fleetMaintenanceMarkDone')}</DialogTitle>
        <DialogContent>
          {pending && (
            <DialogContentText>
              {t('fleetMaintenanceMarkDoneConfirm')
                .replace('{0}', pending.maintenance.name)
                .replace('{1}', format(pending.maintenance.type, pending.maintenance.period))}
            </DialogContentText>
          )}
          {sharedCount > 1 && (
            <DialogContentText className={classes.muted} sx={{ mt: 1 }}>
              {t('fleetMaintenanceShared').replace('{0}', String(sharedCount))}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} disabled={saving}>
            {t('sharedCancel')}
          </Button>
          <Button variant="contained" onClick={confirm} disabled={saving}>
            {t('fleetMaintenanceMarkDone')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MaintenanceStatusTable;
