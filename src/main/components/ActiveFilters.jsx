import { useSelector } from 'react-redux';
import { Button, Chip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 2),
  },
  count: {
    color: theme.palette.text.secondary,
    marginInlineEnd: 'auto',
  },
}));

const EMPTY = { activities: [], statuses: [], groups: [], geofences: [] };
const ACTIVITY_LABELS = {
  moving: 'fleetStatsMoving',
  stopped: 'fleetStatsStopped',
  offline: 'fleetStatsNotReporting',
};
const STATUS_LABELS = {
  online: 'deviceStatusOnline',
  offline: 'deviceStatusOffline',
  unknown: 'deviceStatusUnknown',
};

export const filterActive = (filter, keyword) =>
  Boolean(keyword?.trim()) || Object.values(filter).some((values) => values?.length);

// LIV-11: the filters in force, always visible, each with its ✕, and "12 of 248": a list filtered
// a week ago is never mistaken for the whole fleet.
const ActiveFilters = ({ filter, setFilter, keyword, setKeyword, shown, total }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const groups = useSelector((state) => state.groups.items);
  const geofences = useSelector((state) => state.geofences.items);
  if (!filterActive(filter, keyword)) return null;

  const remove = (key, value) =>
    setFilter({ ...filter, [key]: (filter[key] || []).filter((item) => item !== value) });

  const chips = [
    ...(filter.activities || []).map((value) => ['activities', value, t(ACTIVITY_LABELS[value])]),
    ...filter.statuses.map((value) => ['statuses', value, t(STATUS_LABELS[value]) || value]),
    ...filter.groups.map((value) => ['groups', value, groups[value]?.name || value]),
    ...filter.geofences.map((value) => ['geofences', value, geofences[value]?.name || value]),
  ];

  return (
    <div className={classes.root} role="region" aria-label={t('deviceFiltersActive')}>
      <Typography variant="caption" className={classes.count} role="status">
        {t('deviceFilterCount').replace('{0}', shown).replace('{1}', total)}
      </Typography>
      {keyword?.trim() && (
        <Chip size="small" label={`"${keyword.trim()}"`} onDelete={() => setKeyword('')} />
      )}
      {chips.map(([key, value, label]) => (
        <Chip
          key={`${key}-${value}`}
          size="small"
          label={label}
          onDelete={() => remove(key, value)}
        />
      ))}
      <Button
        size="small"
        onClick={() => {
          setFilter(EMPTY);
          setKeyword('');
        }}
      >
        {t('deviceFilterClear')}
      </Button>
    </div>
  );
};

export default ActiveFilters;
