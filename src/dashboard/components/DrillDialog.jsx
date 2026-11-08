import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { formatStatus } from '../../common/util/formatter';
import { statusColor } from '../../common/theme/surfaces';
import DeviceTile from '../../common/components/brand/DeviceTile';
import { devicesActions } from '../../store';
import { DIMENSIONS } from '../data/datasets';
import { OTHER } from '../data/aggregate';
import { useDashboardData } from '../data/DashboardDataContext';
import { useLabels } from '../widgets/useLabels';

const useStyles = makeStyles()((theme) => ({
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  titleText: {
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  item: {
    gap: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.md,
  },
}));

// The vehicles behind one part of a live chart; opening one shows it on the map.
const DrillDialog = ({ drill, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { liveRows } = useDashboardData();
  const { label } = useLabels();
  const devices = useSelector((state) => state.devices.items);

  const rows = useMemo(() => {
    if (!drill) {
      return [];
    }
    const dimension = DIMENSIONS[drill.query.d];
    const keys = drill.item.key === OTHER ? new Set(drill.item.keys) : new Set([drill.item.key]);
    const groupOf = (row) => row.groupId ?? devices[row.deviceId]?.groupId ?? 0;
    return liveRows
      .filter((row) => keys.has(dimension.key(row, { groupOf, timeOf: () => null })))
      .map((row) => devices[row.deviceId])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drill, liveRows, devices]);

  const open = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/');
  };

  return (
    <Dialog open={Boolean(drill)} onClose={onClose} maxWidth="xs" fullWidth>
      {drill && (
        <>
          <DialogTitle className={classes.title}>
            <span className={classes.dot} style={{ backgroundColor: drill.item.color }} />
            <span className={classes.titleText}>
              {drill.item.label ?? label(drill.query.d, drill.item.key)} · {rows.length}
            </span>
            <IconButton aria-label={t('sharedHide')} onClick={onClose}>
              <CloseRoundedIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 1.5 }}>
            <List dense>
              {rows.map((device) => (
                <ListItemButton
                  key={device.id}
                  className={classes.item}
                  onClick={() => open(device.id)}
                >
                  <DeviceTile category={device.category} status={device.status} size={32} />
                  <ListItemText
                    primary={device.name}
                    secondary={formatStatus(device.status, t)}
                    slotProps={{
                      secondary: { style: { color: statusColor(theme, device.status) } },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </DialogContent>
        </>
      )}
    </Dialog>
  );
};

export default DrillDialog;
