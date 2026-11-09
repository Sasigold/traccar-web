import { useState } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { NextPeriodIcon, PreviousPeriodIcon } from '../../common/components/PeriodArrowIcons';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useFeatures from '../../common/util/useFeatures';
import { PERIODS, periodRange, shiftRange } from '../data/periods';
import { REFRESH_OPTIONS } from '../model/schema';
import { useDashboardData, useLastSynced } from '../data/DashboardDataContext';
import { PERIOD_KEYS, periodLabel } from './periodLabel';
import { DateRangeField } from '../../common/components/pickers';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  select: {
    minWidth: 150,
    backgroundColor: theme.palette.background.paper,
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      paddingBlock: theme.spacing(0.875),
    },
  },
  arrows: {
    display: 'flex',
  },
  chips: {
    display: 'flex',
    gap: 4,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  spacer: {
    flex: 1,
  },
  synced: {
    ...theme.typography.overline,
    // Overline capitals and spacing are for the Latin label; Hebrew reads plain.
    letterSpacing: theme.direction === 'rtl' ? 0 : '0.08em',
    textTransform: theme.direction === 'rtl' ? 'none' : 'uppercase',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: theme.palette.success.main,
  },
  dotOff: {
    backgroundColor: theme.palette.warning.main,
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

const toInput = (value) => dayjs(value).format('YYYY-MM-DDTHH:mm');

// One filter row above every widget: the period, the vehicle groups, auto refresh,
// and when the data on screen was last synced.
const DashboardFilterBar = ({ filters, refresh, onFilters, onRefresh }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const features = useFeatures();
  const groups = useSelector((state) => state.groups.items);
  const socket = useSelector((state) => state.session.socket);
  const { range, refreshNow } = useDashboardData();
  const synced = useLastSynced();
  const [custom, setCustom] = useState(null);

  const groupList = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  const shiftable = filters.period !== 'custom' || Boolean(filters.from);

  const shift = (step) => {
    const next = shiftRange(filters.period, range, step);
    onFilters({
      ...filters,
      period: 'custom',
      from: next.from.toISOString(),
      to: next.to.toISOString(),
    });
  };

  return (
    <div className={classes.root}>
      <Select
        size="small"
        className={classes.select}
        value={filters.period}
        inputProps={{ 'aria-label': t('reportPeriod') }}
        renderValue={() => (
          <>
            <CalendarMonthRoundedIcon fontSize="small" color="action" />
            {periodLabel(filters, range, t)}
          </>
        )}
        onChange={(event) => {
          if (event.target.value === 'custom') {
            const current = periodRange(filters.period, dayjs(), filters);
            setCustom({ from: toInput(current.from), to: toInput(current.to) });
          } else {
            onFilters({ ...filters, period: event.target.value, from: undefined, to: undefined });
          }
        }}
      >
        {PERIODS.map((period) => (
          <MenuItem key={period} value={period}>
            {t(PERIOD_KEYS[period])}
          </MenuItem>
        ))}
      </Select>
      {shiftable && (
        <div className={classes.arrows}>
          <Tooltip title={t('dashboardPreviousPeriod')}>
            <IconButton
              size="small"
              aria-label={t('dashboardPreviousPeriod')}
              onClick={() => shift(-1)}
            >
              <PreviousPeriodIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('dashboardNextPeriod')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('dashboardNextPeriod')}
                disabled={range.to.isAfter(dayjs())}
                onClick={() => shift(1)}
              >
                <NextPeriodIcon />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      )}
      {!features.disableGroups && groupList.length > 0 && (
        <Select
          size="small"
          multiple
          displayEmpty
          className={classes.select}
          value={filters.groupIds}
          input={<OutlinedInput />}
          inputProps={{ 'aria-label': t('settingsGroups') }}
          onChange={(event) => onFilters({ ...filters, groupIds: event.target.value })}
          renderValue={(selected) =>
            selected.length ? (
              <span className={classes.chips}>
                {selected.map((id) => (
                  <Chip key={id} size="small" label={groups[id]?.name ?? id} />
                ))}
              </span>
            ) : (
              t('dashboardAllVehicles')
            )
          }
        >
          {groupList.map((group) => (
            <MenuItem key={group.id} value={group.id}>
              <ListItemText>{group.name}</ListItemText>
            </MenuItem>
          ))}
        </Select>
      )}
      <Select
        size="small"
        className={classes.select}
        value={refresh}
        inputProps={{ 'aria-label': t('dashboardAutoRefresh') }}
        onChange={(event) => onRefresh(event.target.value)}
        renderValue={(value) => (
          <>
            <RefreshRoundedIcon fontSize="small" color="action" />
            {value
              ? t('dashboardEveryMinutes').replace('{0}', value / 60)
              : t('dashboardRefreshOff')}
          </>
        )}
      >
        {REFRESH_OPTIONS.map((value) => (
          <MenuItem key={value} value={value}>
            {value
              ? t('dashboardEveryMinutes').replace('{0}', value / 60)
              : t('dashboardRefreshOff')}
          </MenuItem>
        ))}
      </Select>
      <Tooltip title={t('dashboardRefreshNow')}>
        <IconButton size="small" aria-label={t('dashboardRefreshNow')} onClick={refreshNow}>
          <RefreshRoundedIcon />
        </IconButton>
      </Tooltip>
      <span className={classes.spacer} />
      <span className={classes.synced} dir="ltr" aria-live="off">
        <span className={cx(classes.dot, !socket && classes.dotOff)} />
        {socket
          ? t('loginSynced').replace('{0}', synced ? dayjs(synced).format('HH:mm') : '--:--')
          : t('mapReconnecting')}
      </span>
      <Dialog open={Boolean(custom)} onClose={() => setCustom(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('reportCustom')}</DialogTitle>
        <DialogContent>
          <div className={classes.fields}>
            <DateRangeField
              withTime
              label={t('reportPeriod')}
              from={custom?.from ?? ''}
              to={custom?.to ?? ''}
              onChange={(from, to) => setCustom({ from, to })}
              fullWidth
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustom(null)}>{t('sharedCancel')}</Button>
          <Button
            variant="contained"
            disabled={
              !custom?.from || !custom?.to || !dayjs(custom.from).isBefore(dayjs(custom.to))
            }
            onClick={() => {
              onFilters({
                ...filters,
                period: 'custom',
                from: dayjs(custom.from).toISOString(),
                to: dayjs(custom.to).endOf('minute').toISOString(),
              });
              setCustom(null);
            }}
          >
            {t('reportShow')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default DashboardFilterBar;
