import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  root: {
    alignItems: 'flex-start',
    marginInline: 0,
    '& .MuiCheckbox-root': {
      marginBlockStart: theme.spacing(-0.75),
      marginInlineStart: theme.spacing(-1),
    },
  },
  help: {
    display: 'block',
    marginBlockStart: theme.spacing(0.25),
    color: theme.palette.text.secondary,
  },
}));

// A checkbox with a short explanation under its label, so non-technical users
// understand what turning it on does.
const CheckboxField = ({ checked, onChange, label, helperText, disabled }) => {
  const { classes } = useStyles();
  return (
    <FormControlLabel
      className={classes.root}
      disabled={disabled}
      control={<Checkbox checked={Boolean(checked)} onChange={onChange} />}
      label={
        <span>
          {label}
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
