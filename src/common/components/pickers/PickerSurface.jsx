import { Dialog, Popover, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  paper: {
    borderRadius: theme.shape.borderRadius * 1.5,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundImage: 'none',
    overflow: 'hidden',
  },
  dialogPaper: {
    margin: theme.spacing(2),
    width: `calc(100% - ${theme.spacing(4)})`,
    maxWidth: 420,
  },
}));

// Floating surface for every picker: an anchored popover on desktop, a centered dialog on phones
// (a popover anchored near the bottom of a small screen has no room for the calendar).
const PickerSurface = ({ anchorEl, open, onClose, children }) => {
  const theme = useTheme();
  const { classes, cx } = useStyles();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  // Popover origins are physical: line the picker up with the field's start edge.
  const start = theme.direction === 'rtl' ? 'right' : 'left';

  if (phone) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        slotProps={{ paper: { className: cx(classes.paper, classes.dialogPaper) } }}
      >
        {children}
      </Dialog>
    );
  }
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: start }}
      transformOrigin={{ vertical: 'top', horizontal: start }}
      slotProps={{ paper: { className: classes.paper, elevation: 8 } }}
      marginThreshold={12}
    >
      {children}
    </Popover>
  );
};

export default PickerSurface;
