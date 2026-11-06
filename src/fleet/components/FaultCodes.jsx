import { Chip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { faultCodes } from '../../common/fleet/fleetFields';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
}));

// Fault (DTC) codes of the latest position as small chips; renders nothing when there are none.
const FaultCodes = ({ position }) => {
  const { classes } = useStyles();
  const codes = faultCodes(position);
  if (!codes.length) {
    return null;
  }
  return (
    <span className={classes.root} dir="ltr">
      {codes.map((code) => (
        <Chip key={code} size="small" color="error" variant="outlined" label={code} />
      ))}
    </span>
  );
};

export default FaultCodes;
