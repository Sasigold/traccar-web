import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { plateOf, vehicleName } from '../common/vehicle';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.3,
  },
  plate: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    alignSelf: 'flex-start',
  },
}));

// REP-12: the vehicle in a report row: the name, and the plate under it.
const VehicleCell = ({ deviceId }) => {
  const { classes } = useStyles();
  const device = useSelector((state) => state.devices.items[deviceId]);
  const plate = plateOf(device);
  return (
    <span className={classes.root}>
      <span>{vehicleName({ [deviceId]: device }, deviceId)}</span>
      {plate && (
        <span className={classes.plate} dir="ltr">
          {plate}
        </span>
      )}
    </span>
  );
};

export default VehicleCell;
