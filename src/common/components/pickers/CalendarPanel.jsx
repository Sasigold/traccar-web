import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ButtonBase, IconButton, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import { useTranslation } from '../LocalizationProvider';
import { isOutside, monthGrid, sameDay, weekdayLabels } from './pickerUtils';

const CELL = 38;
const YEAR_PAGE = 20;

const useStyles = makeStyles()((theme) => ({
  root: {
    width: CELL * 7 + 16,
    padding: theme.spacing(1),
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.5),
    minHeight: 40,
  },
  title: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    ...theme.typography.subtitle1,
    color: theme.palette.text.primary,
    '&:hover': { backgroundColor: theme.palette.action.hover },
  },
  staticTitle: {
    ...theme.typography.subtitle1,
    color: theme.palette.text.primary,
    padding: theme.spacing(0.5, 1),
  },
  weekdays: {
    display: 'grid',
    gridTemplateColumns: `repeat(7, ${CELL}px)`,
    justifyContent: 'center',
  },
  weekday: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    lineHeight: `${CELL - 8}px`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(7, ${CELL}px)`,
    gridAutoRows: CELL,
    justifyContent: 'center',
  },
  cell: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inRange: {
    backgroundColor: theme.palette.surface.tint,
  },
  rangeStart: {
    backgroundColor: theme.palette.surface.tint,
    borderStartStartRadius: CELL / 2,
    borderEndStartRadius: CELL / 2,
  },
  rangeEnd: {
    backgroundColor: theme.palette.surface.tint,
    borderStartEndRadius: CELL / 2,
    borderEndEndRadius: CELL / 2,
  },
  day: {
    width: CELL - 4,
    height: CELL - 4,
    borderRadius: '50%',
    ...theme.typography.body2,
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.primary,
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shortest,
    }),
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.secondary.main}`,
      outlineOffset: 1,
    },
  },
  outsideMonth: {
    color: theme.palette.text.disabled,
  },
  today: {
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
    fontWeight: 600,
  },
  selected: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontWeight: 600,
    '&:hover': { backgroundColor: theme.palette.primary.dark },
  },
  disabled: {
    color: theme.palette.text.disabled,
    opacity: 0.5,
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 0.5),
  },
  tile: {
    height: 44,
    borderRadius: theme.shape.borderRadius,
    ...theme.typography.body2,
    color: theme.palette.text.primary,
    '&:hover': { backgroundColor: theme.palette.action.hover },
    '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.secondary.main}` },
  },
}));

// One month of days, plus month and year grids for long jumps (birth dates, licence expiry).
// Range props are optional: pass rangeStart/rangeEnd to shade a period.
const CalendarPanel = ({
  month,
  onMonthChange,
  selected,
  rangeStart,
  rangeEnd,
  hoverDay,
  onHoverDay,
  onSelect,
  min,
  max,
  hidePrev = false,
  hideNext = false,
  allowViews = true,
}) => {
  const t = useTranslation();
  const theme = useTheme();
  const { classes, cx } = useStyles();
  const [view, setView] = useState('days');
  const rtl = theme.direction === 'rtl';
  const PrevIcon = rtl ? ChevronRightRoundedIcon : ChevronLeftRoundedIcon;
  const NextIcon = rtl ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;
  const today = dayjs();

  const days = useMemo(() => monthGrid(month), [month]);
  const weekdays = useMemo(() => weekdayLabels(), []);

  const rangeEndShown =
    rangeEnd || (rangeStart && hoverDay?.isAfter(rangeStart, 'day') ? hoverDay : null);
  const ranged = Boolean(rangeStart && rangeEndShown && !sameDay(rangeStart, rangeEndShown));

  const step = (amount) => {
    if (view === 'days') onMonthChange(month.add(amount, 'month'));
    else if (view === 'months') onMonthChange(month.add(amount, 'year'));
    else onMonthChange(month.add(amount * YEAR_PAGE, 'year'));
  };

  const firstYear = month.year() - (month.year() % YEAR_PAGE);

  let title;
  if (view === 'days') title = month.format('MMMM YYYY');
  else if (view === 'months') title = month.format('YYYY');
  else title = `${firstYear} – ${firstYear + YEAR_PAGE - 1}`;

  const nextView = { days: 'months', months: 'years', years: 'days' };
  const prevLabel = view === 'days' ? t('pickerPreviousMonth') : t('pickerPrevious');
  const nextLabel = view === 'days' ? t('pickerNextMonth') : t('pickerNext');

  const renderDay = (day) => {
    const inMonth = day.month() === month.month();
    const disabled = isOutside(day, min, max);
    const isSelected = sameDay(day, selected) || sameDay(day, rangeStart) || sameDay(day, rangeEnd);
    let band = null;
    if (ranged && inMonth) {
      if (sameDay(day, rangeStart)) band = classes.rangeStart;
      else if (sameDay(day, rangeEndShown)) band = classes.rangeEnd;
      else if (day.isAfter(rangeStart, 'day') && day.isBefore(rangeEndShown, 'day'))
        band = classes.inRange;
    }
    return (
      <div key={day.valueOf()} className={cx(classes.cell, band)}>
        <ButtonBase
          className={cx(
            classes.day,
            !inMonth && classes.outsideMonth,
            sameDay(day, today) && classes.today,
            isSelected && inMonth && classes.selected,
            disabled && classes.disabled,
          )}
          disabled={disabled}
          onClick={() => onSelect(day)}
          onMouseEnter={onHoverDay ? () => onHoverDay(day) : undefined}
          aria-label={day.format('LL')}
          aria-pressed={isSelected}
          tabIndex={isSelected || (!selected && !rangeStart && sameDay(day, today)) ? 0 : -1}
        >
          {day.date()}
        </ButtonBase>
      </div>
    );
  };

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        {hidePrev && view === 'days' ? (
          <span style={{ width: 34 }} />
        ) : (
          <Tooltip title={prevLabel}>
            <IconButton size="small" onClick={() => step(-1)} aria-label={prevLabel}>
              <PrevIcon />
            </IconButton>
          </Tooltip>
        )}
        {allowViews ? (
          <ButtonBase className={classes.title} onClick={() => setView(nextView[view])}>
            {title}
            <ArrowDropDownRoundedIcon fontSize="small" />
          </ButtonBase>
        ) : (
          <span className={classes.staticTitle}>{title}</span>
        )}
        {hideNext && view === 'days' ? (
          <span style={{ width: 34 }} />
        ) : (
          <Tooltip title={nextLabel}>
            <IconButton size="small" onClick={() => step(1)} aria-label={nextLabel}>
              <NextIcon />
            </IconButton>
          </Tooltip>
        )}
      </div>
      {view === 'days' && (
        <>
          <div className={classes.weekdays}>
            {weekdays.map((label) => (
              <Typography key={label} component="span" className={classes.weekday}>
                {label}
              </Typography>
            ))}
          </div>
          <div
            className={classes.grid}
            onMouseLeave={onHoverDay ? () => onHoverDay(null) : undefined}
          >
            {days.map(renderDay)}
          </div>
        </>
      )}
      {view === 'months' && (
        <div className={classes.tiles}>
          {Array.from({ length: 12 }, (_, index) => {
            const option = month.month(index);
            const current = selected || rangeStart;
            const active = current && current.year() === option.year() && current.month() === index;
            return (
              <ButtonBase
                key={index}
                className={cx(classes.tile, active && classes.selected)}
                disabled={isOutside(option, min, max, 'month')}
                onClick={() => {
                  onMonthChange(option);
                  setView('days');
                }}
              >
                {option.format('MMM')}
              </ButtonBase>
            );
          })}
        </div>
      )}
      {view === 'years' && (
        <div className={classes.tiles}>
          {Array.from({ length: YEAR_PAGE }, (_, index) => {
            const year = firstYear + index;
            const option = month.year(year);
            const current = selected || rangeStart;
            return (
              <ButtonBase
                key={year}
                className={cx(classes.tile, current?.year() === year && classes.selected)}
                disabled={isOutside(option, min, max, 'year')}
                onClick={() => {
                  onMonthChange(option);
                  setView('months');
                }}
              >
                {year}
              </ButtonBase>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalendarPanel;
