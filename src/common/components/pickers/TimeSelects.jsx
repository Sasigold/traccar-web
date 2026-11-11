// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../LocalizationProvider';
import { minuteOptions, pad } from './pickerUtils';

const HOURS = Array.from({ length: 24 }, (_, index) => index);

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  label: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    minWidth: 64,
  },
  selects: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  select: {
    width: 72,
    '& .MuiSelect-select': { fontVariantNumeric: 'tabular-nums' },
  },
}));

const menuProps = { slotProps: { paper: { sx: { maxHeight: 280 } } } };

// Compact hour : minute selects, for the start and end times of a range.
const TimeSelects = ({ label, hour, minute, onChange, minuteStep = 5, disabled }) => {
  const t = useTranslation();
  const { classes } = useStyles();
  const minutes = minuteOptions(minuteStep, minute);

  return (
    <div className={classes.root}>
      <Typography component="span" className={classes.label}>
        {label}
      </Typography>
      <div className={classes.selects} dir="ltr">
        <TextField
          select
          size="small"
          className={classes.select}
          value={hour}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value), minute)}
          slotProps={{
            select: { MenuProps: menuProps },
            htmlInput: { 'aria-label': t('sharedHour') },
          }}
        >
          {HOURS.map((option) => (
            <MenuItem key={option} value={option}>
              {pad(option)}
            </MenuItem>
          ))}
        </TextField>
        <span>:</span>
        <TextField
          select
          size="small"
          className={classes.select}
          value={minute}
          disabled={disabled}
          onChange={(event) => onChange(hour, Number(event.target.value))}
          slotProps={{
            select: { MenuProps: menuProps },
            htmlInput: { 'aria-label': t('sharedMinute') },
          }}
        >
          {minutes.map((option) => (
            <MenuItem key={option} value={option}>
              {pad(option)}
            </MenuItem>
          ))}
        </TextField>
      </div>
    </div>
  );
};

export default TimeSelects;
