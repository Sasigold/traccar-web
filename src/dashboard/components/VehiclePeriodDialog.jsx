import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { devicesActions } from '../../store';
import { replayLink, tripsLink } from '../../reports/components/reportLinks';

// REP-07: a vehicle picked in a chart of a past period: its trips in that period, the replay of
// that period, or where it is now (which used to be the only choice).
const VehiclePeriodDialog = ({ vehicle, onClose }) => {
  const t = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  if (!vehicle) {
    return null;
  }
  const { deviceId, name, from, to } = vehicle;
  const go = (path) => {
    onClose();
    navigate(path);
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{name}</DialogTitle>
      <List>
        <ListItemButton onClick={() => go(tripsLink(deviceId, from, to))}>
          <ListItemIcon>
            <RouteRoundedIcon />
          </ListItemIcon>
          <ListItemText primary={t('dashboardVehicleTrips')} />
        </ListItemButton>
        <ListItemButton onClick={() => go(replayLink(deviceId, from, to))}>
          <ListItemIcon>
            <ReplayRoundedIcon />
          </ListItemIcon>
          <ListItemText primary={t('dashboardVehicleReplay')} />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            dispatch(devicesActions.selectId(deviceId));
            go('/');
          }}
        >
          <ListItemIcon>
            <MapRoundedIcon />
          </ListItemIcon>
          <ListItemText primary={t('dashboardVehicleNow')} />
        </ListItemButton>
      </List>
    </Dialog>
  );
};

export default VehiclePeriodDialog;
