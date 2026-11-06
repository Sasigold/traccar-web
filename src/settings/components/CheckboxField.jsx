import { FormControlLabel, Switch, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  // Direction A setting row: label and explanation on one side, switch on the other.
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginInline: 0,
    paddingBlock: theme.spacing(0.5),
    '& .MuiFormControlLabel-label': {
      flex: 1,
      minWidth: 0,
    },
    '& + &': {
      borderTop: `1px solid ${theme.palette.surface.border}`,
      paddingTop: theme.spacing(1.5),
    },
  },
  label: {
    display: 'block',
    fontWeight: 500,
    fontSize: '0.9375rem',
  },
  help: {
    display: 'block',
    marginBlockStart: theme.spacing(0.25),
    color: theme.palette.text.secondary,
  },
  switch: {
    flexShrink: 0,
    marginInlineEnd: theme.spacing(-1),
  },
}));

// A switch with a short explanation under its label, so non-technical users
// understand what turning it on does.
const CheckboxField = ({ checked, onChange, label, helperText, disabled }) => {
  const { classes } = useStyles();
  return (
    <FormControlLabel
      className={classes.root}
      disabled={disabled}
      labelPlacement="start"
      control={<Switch className={classes.switch} checked={Boolean(checked)} onChange={onChange} />}
      label={
        <span>
          <span className={classes.label}>{label}</span>
          {helperText && (
            <Typography component="span" variant="caption" className={classes.help}>
              {helperText}
            </Typography>
          )}
        </span>
      }
    />
  );
};

export default CheckboxField;
