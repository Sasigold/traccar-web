import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import { devicesActions, messagesActions } from '../store';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { formatTime } from '../common/util/formatter';
import { useRestriction } from '../common/util/permissions';
import { capitalize } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  bar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    margin: theme.spacing(0, 1, 1),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.tint,
  },
  count: {
    flex: '1 0 auto',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
}));

// LIV-25: what to do with the vehicles picked in the list: export them, put them in a group,
// pick all shown or none.
const PickedBar = ({ shown }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const deviceReadonly = useRestriction('deviceReadonly');
  const picked = useSelector((state) => state.devices.picked);
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const groups = useSelector((state) => state.groups.items);
  const [grouping, setGrouping] = useState(false);
  const [groupId, setGroupId] = useState('');

  const chosen = (picked || []).map((id) => devices[id]).filter(Boolean);

  const handleExport = async () => {
    const rows = chosen.map((device) => ({
      [t('sharedName')]: device.name,
      [t('fleetPlateNumber')]: device.attributes?.plateNumber || '',
      [t('deviceStatus')]: t(`deviceStatus${capitalize(device.status || 'unknown')}`),
      [t('deviceLastUpdate')]: device.lastUpdate ? formatTime(device.lastUpdate, 'minutes') : '',
      [t('positionLatitude')]: positions[device.id]?.latitude ?? '',
      [t('positionLongitude')]: positions[device.id]?.longitude ?? '',
    }));
    const sheets = new Map([[t('deviceTitle'), rows]]);
    await exportExcel(t('deviceTitle'), 'vehicles.xlsx', sheets, theme);
  };

  const moveToGroup = useCatch(async () => {
    for (const device of chosen) {
      const latest = await (await fetchOrThrow(`api/devices/${device.id}`)).json();
      await fetchOrThrow(`api/devices/${device.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latest, groupId: Number(groupId) || 0 }),
      });
    }
    setGrouping(false);
    dispatch(
      messagesActions.push({
        message: t('pickedMoved').replace('{0}', String(chosen.length)),
        severity: 'success',
      }),
    );
    dispatch(devicesActions.stopPicking());
  });

  if (!picked) return null;
  const allPicked = shown.length > 0 && shown.every((device) => picked.includes(device.id));

  return (
    <Paper elevation={0} className={classes.bar} role="toolbar" aria-label={t('pickedTitle')}>
      <Typography variant="body2" className={classes.count} role="status">
        {t('pickedCount').replace('{0}', String(chosen.length))}
      </Typography>
      <Button
        size="small"
        onClick={() =>
          dispatch(devicesActions.setPicked(allPicked ? [] : shown.map((device) => device.id)))
        }
      >
        {t(allPicked ? 'pickedNone' : 'pickedAll')}
      </Button>
      <Button size="small" variant="outlined" onClick={handleExport} disabled={!chosen.length}>
        {t('reportExport')}
      </Button>
      {!deviceReadonly && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => setGrouping(true)}
          disabled={!chosen.length}
        >
          {t('pickedToGroup')}
        </Button>
      )}
      {/* LIV-28: follow up to four of them side by side. */}
      <Button
        size="small"
        variant="outlined"
        disabled={!chosen.length}
        onClick={() =>
          navigate(
            `/follow?ids=${chosen
              .slice(0, 4)
              .map((device) => device.id)
              .join(',')}`,
          )
        }
      >
        {t('followPicked')}
      </Button>
      <Button size="small" onClick={() => dispatch(devicesActions.stopPicking())}>
        {t('pickedDone')}
      </Button>
      {grouping && (
        <Dialog open onClose={() => setGrouping(false)} fullWidth maxWidth="xs">
          <DialogTitle>{t('pickedToGroup')}</DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              label={t('groupParent')}
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              sx={{ mt: 1 }}
            >
              <MenuItem value="0">{t('pickedNoGroup')}</MenuItem>
              {Object.values(groups).map((group) => (
                <MenuItem key={group.id} value={String(group.id)}>
                  {group.name}
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGrouping(false)}>{t('sharedCancel')}</Button>
            <Button variant="contained" onClick={moveToGroup} disabled={groupId === ''}>
              {t('pickedMove').replace('{0}', String(chosen.length))}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
};

export default PickedBar;
