import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button, Checkbox, InputAdornment, Popover, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { List } from 'react-window';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from '../LocalizationProvider';
import { formatPlate } from '../../util/israeliFields';
import { NO_GROUP, coveredDevices, pickerRows, toggleDevice, toggleGroup } from './pickerRows';

const useStyles = makeStyles()((theme) => ({
  field: {
    '& .MuiInputBase-input': {
      cursor: 'pointer',
      textOverflow: 'ellipsis',
    },
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 320,
    maxWidth: 'calc(100vw - 32px)',
  },
  search: {
    padding: theme.spacing(1.5, 1.5, 1),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    paddingInline: theme.spacing(1),
    cursor: 'pointer',
    boxSizing: 'border-box',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  active: {
    backgroundColor: theme.palette.action.selected,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  group: {
    backgroundColor: theme.palette.background.default,
    borderBlockStart: `1px solid ${theme.palette.divider}`,
  },
  single: {
    paddingInlineStart: theme.spacing(2),
  },
  text: {
    minWidth: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    // A Latin name or a plate takes its own direction (unicode-bidi: plaintext) but stays aligned
    // with the Hebrew rows: 'left' here is the page's start, the RTL plugin turns it into 'right'.
    '& > *': {
      textAlign: 'left',
    },
  },
  plate: {
    color: theme.palette.text.secondary,
    fontFeatureSettings: '"tnum"',
  },
  empty: {
    padding: theme.spacing(3, 2),
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderBlockStart: `1px solid ${theme.palette.divider}`,
  },
  summary: {
    flex: 1,
    color: theme.palette.text.secondary,
  },
}));

const GROUP_HEIGHT = 48;
const DEVICE_HEIGHT = 44;
const PLATE_HEIGHT = 56;
const LIST_HEIGHT = 360;
const ALL = { type: 'all', id: 'all' };

const vehicleCount = (t, count) =>
  count === 1 ? t('vehiclePickerOneVehicle') : t('exportVehiclesCount').replace('{0}', count);

const rowHeight = (row) => {
  if (row.type === 'device') return row.plate ? PLATE_HEIGHT : DEVICE_HEIGHT;
  return GROUP_HEIGHT;
};

const Row = ({ index, style, rows, state, multiple, activeIndex, listId, onPick, classes, t }) => {
  const row = rows[index];
  const selectable = multiple || row.type === 'device';
  const { checked, indeterminate } = state(row);
  const className = [
    classes.row,
    row.type !== 'device' && classes.group,
    !multiple && row.type === 'device' && classes.single,
    index === activeIndex && classes.active,
  ]
    .filter(Boolean)
    .join(' ');
  let title = row.name;
  let detail = null;
  if (row.type === 'all') {
    title = t('notificationAlways');
  } else if (row.type === 'group') {
    title = row.name ?? t('groupNoGroup');
    detail = multiple
      ? `${t('vehiclePickerWholeGroup')} · ${vehicleCount(t, row.deviceIds.length)}`
      : null;
  } else if (row.plate) {
    detail = (
      <span dir="ltr" className={classes.plate}>
        {formatPlate(row.plate)}
      </span>
    );
  }
  return (
    <div
      id={`${listId}-${index}`}
      style={style}
      className={className}
      role="option"
      aria-selected={selectable ? checked : undefined}
      aria-disabled={selectable ? undefined : true}
      // The focus stays in the search field (aria-activedescendant); a click must not take it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => selectable && onPick(row)}
    >
      {multiple && (
        <Checkbox
          size="small"
          tabIndex={-1}
          checked={checked}
          indeterminate={indeterminate}
          slotProps={{ input: { 'aria-hidden': true } }}
        />
      )}
      <div className={classes.text}>
        <Typography variant="body2" noWrap fontWeight={row.type === 'device' ? 400 : 600}>
          {title}
        </Typography>
        {detail && (
          <Typography variant="caption" noWrap component="span">
            {detail}
          </Typography>
        )}
      </div>
    </div>
  );
};

// REP-05: one picker for a fleet of any size. Groups are headings with "choose the whole group"
// and their vehicles under them, so "all of north except two" is a group ticked and two vehicles
// unticked. The search finds a vehicle by name, plate (digits only is enough), identifier or
// driver. The list is virtual, and the field shows a summary ("12 רכבים · 2 קבוצות") instead of
// a row of chips.
//
// value: { deviceIds, groupIds }; deviceIds may hold 'all'. Single mode: one vehicle, no groups.
const VehiclePicker = ({ label, multiple = false, value, onChange, fullWidth = true }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const listId = useId();
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items);
  const drivers = useSelector((state) => state.drivers.items);
  const positions = useSelector((state) => state.session.positions);
  const [anchor, setAnchor] = useState(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef(null);

  const deviceIds = useMemo(() => value?.deviceIds || [], [value]);
  const groupIds = useMemo(() => value?.groupIds || [], [value]);
  const all = deviceIds.includes('all');
  const covered = useMemo(
    () => coveredDevices(devices, { deviceIds, groupIds }),
    [devices, deviceIds, groupIds],
  );

  const rows = useMemo(() => {
    const result = pickerRows(devices, groups, query, { drivers, positions });
    return multiple && !query.trim() ? [ALL, ...result] : result;
  }, [devices, groups, drivers, positions, query, multiple]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const state = (row) => {
    if (row.type === 'all') return { checked: all, indeterminate: !all && covered.size > 0 };
    if (row.type === 'device') return { checked: covered.has(row.id), indeterminate: false };
    const chosen = row.deviceIds.filter((id) => covered.has(id)).length;
    const whole =
      row.id !== NO_GROUP && groupIds.includes(row.id)
        ? true
        : chosen > 0 && chosen === row.deviceIds.length;
    return { checked: all || whole, indeterminate: !all && !whole && chosen > 0 };
  };

  const emit = (selection) => {
    onChange({ deviceIds: selection.deviceIds, groupIds: selection.groupIds || [] });
  };

  const onPick = (row) => {
    if (!multiple) {
      onChange({ deviceIds: [row.id], groupIds: [] });
      setAnchor(null);
      return;
    }
    // "All vehicles" stays a single choice; ticking something else starts from it.
    const current = all
      ? { deviceIds: Object.keys(devices).map(Number), groupIds: [] }
      : { deviceIds, groupIds };
    if (row.type === 'all') {
      emit(all ? { deviceIds: [], groupIds: [] } : { deviceIds: ['all'], groupIds: [] });
    } else if (row.type === 'device') {
      emit(toggleDevice(devices, current, row.id));
    } else if (row.id === NO_GROUP) {
      // Vehicles without a group have no group to send: they are chosen one by one.
      const { checked } = state(row);
      const ids = new Set(current.deviceIds);
      row.deviceIds.forEach((id) => (checked ? ids.delete(id) : ids.add(id)));
      emit({ deviceIds: [...ids], groupIds: current.groupIds });
    } else {
      emit(toggleGroup(devices, current, row.id));
    }
  };

  const move = (step) => {
    if (!rows.length) return;
    let next = activeIndex;
    for (let i = 0; i < rows.length; i += 1) {
      next = (next + step + rows.length) % rows.length;
      if (multiple || rows[next].type === 'device') break;
    }
    setActiveIndex(next);
    listRef.current?.scrollToRow({ index: next, align: 'smart', behavior: 'auto' });
  };

  const onSearchKey = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      onPick(rows[activeIndex]);
    }
  };

  let summary = '';
  if (all) {
    summary = t('notificationAlways');
  } else if (!multiple || (covered.size === 1 && !groupIds.length)) {
    summary = devices[[...covered][0]]?.name || '';
  } else if (covered.size || groupIds.length) {
    summary = vehicleCount(t, covered.size);
    if (groupIds.length) {
      summary += ` · ${t(groupIds.length === 1 ? 'vehiclePickerOneGroup' : 'vehiclePickerGroups').replace('{0}', groupIds.length)}`;
    }
  }

  const open = (event) => {
    setQuery('');
    setAnchor(event.currentTarget);
  };
  const close = () => setAnchor(null);

  const listHeight = Math.min(
    LIST_HEIGHT,
    rows.reduce((total, row) => total + rowHeight(row), 0),
  );

  return (
    <>
      <TextField
        className={classes.field}
        label={label}
        value={summary}
        fullWidth={fullWidth}
        placeholder={t('vehiclePickerPlaceholder')}
        onClick={open}
        onKeyDown={(event) => {
          if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            open(event);
          }
        }}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <ArrowDropDownRoundedIcon />
              </InputAdornment>
            ),
          },
          htmlInput: {
            role: 'combobox',
            'aria-haspopup': 'dialog',
            'aria-expanded': Boolean(anchor),
          },
        }}
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            className: classes.paper,
            style: { width: anchor?.offsetWidth },
            role: 'dialog',
            'aria-label': label,
          },
        }}
      >
        <div className={classes.search}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKey}
            placeholder={t('vehiclePickerSearch')}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: {
                role: 'combobox',
                'aria-label': t('vehiclePickerSearch'),
                'aria-controls': listId,
                'aria-expanded': true,
                'aria-autocomplete': 'list',
                'aria-activedescendant': activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined,
              },
            }}
          />
        </div>
        {rows.length ? (
          <List
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            listRef={listRef}
            style={{ height: listHeight }}
            rowComponent={Row}
            rowCount={rows.length}
            rowHeight={(index) => rowHeight(rows[index])}
            rowProps={{ rows, state, multiple, activeIndex, listId, onPick, classes, t }}
            overscanCount={8}
          />
        ) : (
          <Typography variant="body2" className={classes.empty} role="status">
            {t('sharedNoData')}
          </Typography>
        )}
        {multiple && (
          <div className={classes.footer}>
            <Typography variant="caption" className={classes.summary} role="status">
              {summary || t('vehiclePickerNone')}
            </Typography>
            <Button
              size="small"
              disabled={!deviceIds.length && !groupIds.length}
              onClick={() => emit({ deviceIds: [], groupIds: [] })}
            >
              {t('vehiclePickerClear')}
            </Button>
            <Button size="small" onClick={close}>
              {t('vehiclePickerDone')}
            </Button>
          </div>
        )}
      </Popover>
    </>
  );
};

export default VehiclePicker;
