// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { Button } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.palette.surface.border}`,
  },
  spacer: { flex: 1 },
}));

// Bottom row of a picker: secondary text actions at the start, one main action at the end.
const PickerFooter = ({ actions = [], primary }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.root}>
      {actions.filter(Boolean).map(({ label, onClick, disabled }) => (
        <Button key={label} size="small" variant="text" onClick={onClick} disabled={disabled}>
          {label}
        </Button>
      ))}
      <span className={classes.spacer} />
      {primary && (
        <Button
          size="small"
          variant="contained"
          onClick={primary.onClick}
          disabled={primary.disabled}
        >
          {primary.label}
        </Button>
      )}
    </div>
  );
};

export default PickerFooter;
