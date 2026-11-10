import { useState } from 'react';
import { Chip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { faultCodes } from '../../common/fleet/fleetFields';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FaultCodeDialog from './FaultCodeDialog';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
}));

// Fault (DTC) codes of the latest position as small chips; renders nothing when there are none.
// AI-03: a chip opens what the code means and what to do about it.
const FaultCodes = ({ position, deviceId, driverPhone }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const codes = faultCodes(position);
  if (!codes.length) {
    return null;
  }
  return (
    <>
      <span className={classes.root} dir="ltr">
        {codes.map((code) => (
          <Chip
            key={code}
            size="small"
            color="error"
            variant="outlined"
            label={code}
            onClick={() => setOpen(true)}
            aria-label={t('aiFaultOpen').replace('{0}', code)}
          />
        ))}
      </span>
      {open && (
        <FaultCodeDialog
          codes={codes}
          deviceId={deviceId}
          driverPhone={driverPhone}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default FaultCodes;
