// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useEffect, useMemo, useRef } from 'react';
import { ButtonBase, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../LocalizationProvider';
import { minuteOptions, pad } from './pickerUtils';

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const ROW = 34;

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: 60,
  },
  label: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    paddingBottom: theme.spacing(0.5),
  },
  list: {
    height: ROW * 8,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 2,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.surface.sunken,
    border: `1px solid ${theme.palette.surface.border}`,
  },
  option: {
    flexShrink: 0,
    height: ROW,
    borderRadius: theme.shape.borderRadius * 0.75,
    ...theme.typography.body2,
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.primary,
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.secondary.main}` },
  },
  selected: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontWeight: 600,
    '&:hover': { backgroundColor: theme.palette.primary.dark },
  },
  offStep: {
    color: theme.palette.text.secondary,
  },
}));

const Column = ({ label, options, value, onSelect, classes, cx, step }) => {
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    const index = options.indexOf(value);
    if (list && index >= 0) {
      list.scrollTop = Math.max(0, index * (ROW + 2) - list.clientHeight / 2 + ROW / 2);
    }
  }, [value, options]);

  return (
    <div className={classes.column}>
      <Typography component="span" className={classes.label}>
        {label}
      </Typography>
      <div ref={listRef} className={classes.list} role="listbox" aria-label={label}>
        {options.map((option) => (
          <ButtonBase
            key={option}
            role="option"
            aria-selected={option === value}
            className={cx(
              classes.option,
              option === value && classes.selected,
              step && option % step !== 0 && classes.offStep,
            )}
            onClick={() => onSelect(option)}
          >
            {pad(option)}
          </ButtonBase>
        ))}
      </div>
    </div>
  );
};

// Hour and minute columns. Minutes come in `minuteStep` increments (5 by default); pass 1 where
// the exact minute matters. Times always read left to right, also in Hebrew.
const TimeColumns = ({ hour, minute, onChange, minuteStep = 5 }) => {
  const t = useTranslation();
  const { classes, cx } = useStyles();
  const minutes = useMemo(() => minuteOptions(minuteStep, minute), [minuteStep, minute]);

  return (
    <div className={classes.root} dir="ltr">
      <Column
        label={t('sharedHour')}
        options={HOURS}
        value={hour}
        onSelect={(value) => onChange(value, minute ?? 0)}
        classes={classes}
        cx={cx}
      />
      <Column
        label={t('sharedMinute')}
        options={minutes}
        value={minute}
        onSelect={(value) => onChange(hour ?? 0, value)}
        classes={classes}
        cx={cx}
        step={minuteStep}
      />
    </div>
  );
};

export default TimeColumns;
