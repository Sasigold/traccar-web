import { useMemo, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  OutlinedInput,
  InputAdornment,
  Popover,
  Popper,
  Paper,
  ClickAwayListener,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Badge,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme, alpha } from '@mui/material/styles';
import MapOutlinedIcon from '@mui/icons-material/MapRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { glass, ctaFill } from '../common/theme/surfaces';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useDeviceReadonly } from '../common/util/permissions';
import DeviceRow from './DeviceRow';
import { tokenizeSearch } from '../common/util/deviceSearch';
import SavedViews from './components/SavedViews';
import { devicesActions } from '../store';

const useStyles = makeStyles()((theme) => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1.25, 1.5),
    },
  },
  tonal: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.lg,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    backgroundColor: theme.palette.surface.sunken,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
      borderColor: alpha(theme.palette.primary.main, 0.35),
      color: theme.palette.primary.main,
    },
  },
  // Adding a vehicle is a secondary action here (the vehicle card holds the screen's aqua
  // action), so it is outlined, except on an empty fleet, where it is the next step.
  primary: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.background.paper,
    transition: 'background-color 160ms ease',
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-disabled': {
      borderColor: theme.palette.surface.border,
      color: theme.palette.action.disabled,
    },
  },
  primaryCta: {
    ...ctaFill(theme),
    border: 'none',
  },
  search: {
    height: 40,
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.surface.borderStrong,
    },
    '&.Mui-focused': {
      backgroundColor: theme.palette.background.paper,
    },
  },
  searchIcon: {
    color: theme.palette.text.secondary,
  },
  popover: {
    ...glass(theme, 0.94),
    borderRadius: theme.tokens.radius.xl,
  },
  filterPanel: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
    width: theme.dimensions.drawerWidthTablet,
    maxWidth: 'calc(100vw - 32px)',
  },
  filterTitle: {
    fontWeight: 700,
  },
  quickResults: {
    zIndex: theme.zIndex.modal,
  },
  more: {
    justifyContent: 'center',
    borderRadius: theme.tokens.radius.md,
    margin: theme.spacing(0.5, 1, 1),
  },
}));

const MainToolbar = ({
  filteredDevices,
  devicesOpen,
  setDevicesOpen,
  keyword,
  setKeyword,
  filter,
  setFilter,
  filterSort,
  setFilterSort,
  filterMap,
  setFilterMap,
}) => {
  'use memo'; // PRF-04
  const dispatch = useDispatch();
  const picking = useSelector((state) => state.devices.picked != null);
  const { classes, cx } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();

  const deviceReadonly = useDeviceReadonly();

  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);
  const devicesLoaded = useSelector((state) => state.devices.loaded);
  const geofences = useSelector((state) => state.geofences.items);

  const toolbarRef = useRef();
  const inputRef = useRef();
  const quickRef = useRef(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [devicesAnchorEl, setDevicesAnchorEl] = useState(null);
  const tokens = useMemo(() => tokenizeSearch(keyword), [keyword]);

  const deviceStatusCount = (status) =>
    Object.values(devices).filter((d) => d.status === status).length;

  const filtersActive =
    filter.statuses.length > 0 ||
    filter.groups.length > 0 ||
    filter.geofences.length > 0 ||
    (filter.activities || []).length > 0;

  return (
    <div ref={toolbarRef} className={classes.toolbar}>
      <Tooltip title={devicesOpen ? t('mapTitle') : t('sharedDeviceList')}>
        <IconButton className={classes.tonal} onClick={() => setDevicesOpen(!devicesOpen)}>
          {devicesOpen ? (
            <MapOutlinedIcon fontSize="small" />
          ) : (
            <ViewListRoundedIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <OutlinedInput
        ref={inputRef}
        className={classes.search}
        placeholder={t('deviceSearchPlaceholder')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={() => setDevicesAnchorEl(toolbarRef.current)}
        // LIV-30: a tap on a result must not close the list first. Leaving by keyboard closes it
        // here; a press outside closes it in the ClickAwayListener below.
        onBlur={(event) => {
          if (event.relatedTarget && !quickRef.current?.contains(event.relatedTarget)) {
            setDevicesAnchorEl(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDevicesAnchorEl(null);
        }}
        startAdornment={
          <InputAdornment position="start">
            <SearchRoundedIcon fontSize="small" className={classes.searchIcon} />
          </InputAdornment>
        }
        endAdornment={
          <InputAdornment position="end">
            <Tooltip title={t('sharedFilter')}>
              <IconButton
                size="small"
                edge="end"
                onClick={() => setFilterAnchorEl(inputRef.current)}
              >
                <Badge color="primary" variant="dot" invisible={!filtersActive}>
                  <TuneRoundedIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          </InputAdornment>
        }
        size="small"
        fullWidth
      />
      <Popper
        open={!!devicesAnchorEl && !devicesOpen && filteredDevices.length > 0}
        anchorEl={devicesAnchorEl}
        placement="bottom"
        className={classes.quickResults}
        modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
      >
        <ClickAwayListener
          mouseEvent="onPointerDown"
          touchEvent={false}
          onClickAway={(event) => {
            if (!toolbarRef.current?.contains(event.target)) setDevicesAnchorEl(null);
          }}
        >
          <Paper
            ref={quickRef}
            elevation={1}
            className={classes.popover}
            style={{ width: `calc(${toolbarRef.current?.clientWidth}px - ${theme.spacing(4)})` }}
            // Picking a vehicle closes the list.
            onClick={(event) => {
              if (event.target.closest('[data-row]')) setDevicesAnchorEl(null);
            }}
          >
            {filteredDevices.slice(0, 3).map((_, index) => (
              <DeviceRow
                key={filteredDevices[index].id}
                devices={filteredDevices}
                tokens={tokens}
                index={index}
              />
            ))}
            {filteredDevices.length > 3 && (
              <ListItemButton
                className={classes.more}
                onClick={() => {
                  setDevicesAnchorEl(null);
                  setDevicesOpen(true);
                }}
              >
                <ListItemText
                  primary={t('deviceShowAllResults').replace('{0}', filteredDevices.length)}
                  slotProps={{ primary: { align: 'center', fontWeight: 600 } }}
                />
              </ListItemButton>
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>
      <Popover
        open={!!filterAnchorEl}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: theme.direction === 'rtl' ? 'right' : 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: theme.direction === 'rtl' ? 'right' : 'left',
        }}
        slotProps={{ paper: { className: classes.popover } }}
      >
        <div className={classes.filterPanel}>
          <Typography variant="subtitle2" className={classes.filterTitle}>
            {t('sharedFilter')}
          </Typography>
          <FormControl>
            <InputLabel id="main-toolbar-device-status-label">{t('deviceStatus')}</InputLabel>
            <Select
              labelId="main-toolbar-device-status-label"
              label={t('deviceStatus')}
              value={filter.statuses}
              onChange={(e) => setFilter({ ...filter, statuses: e.target.value })}
              multiple
            >
              <MenuItem value="online">{`${t('deviceStatusOnline')} (${deviceStatusCount('online')})`}</MenuItem>
              <MenuItem value="offline">{`${t('deviceStatusOffline')} (${deviceStatusCount('offline')})`}</MenuItem>
              <MenuItem value="unknown">{`${t('deviceStatusUnknown')} (${deviceStatusCount('unknown')})`}</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel id="main-toolbar-settings-groups-label">{t('settingsGroups')}</InputLabel>
            <Select
              labelId="main-toolbar-settings-groups-label"
              label={t('settingsGroups')}
              value={filter.groups}
              onChange={(e) => setFilter({ ...filter, groups: e.target.value })}
              multiple
            >
              {Object.values(groups)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel id="main-toolbar-shared-geofences-label">{t('sharedGeofences')}</InputLabel>
            <Select
              labelId="main-toolbar-shared-geofences-label"
              label={t('sharedGeofences')}
              value={filter.geofences}
              onChange={(e) => setFilter({ ...filter, geofences: e.target.value })}
              multiple
            >
              {Object.values(geofences)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((geofence) => (
                  <MenuItem key={geofence.id} value={geofence.id}>
                    {geofence.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel id="main-toolbar-shared-sort-by-label" shrink>
              {t('sharedSortBy')}
            </InputLabel>
            <Select
              labelId="main-toolbar-shared-sort-by-label"
              label={t('sharedSortBy')}
              value={filterSort}
              displayEmpty
              onChange={(e) => setFilterSort(e.target.value)}
            >
              <MenuItem value="">{' '}</MenuItem>
              <MenuItem value="name">{t('sharedName')}</MenuItem>
              <MenuItem value="lastUpdate">{t('deviceLastUpdate')}</MenuItem>
              <MenuItem value="group">{t('sortByGroup')}</MenuItem>
            </Select>
          </FormControl>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox checked={filterMap} onChange={(e) => setFilterMap(e.target.checked)} />
              }
              label={t('sharedFilterMap')}
            />
          </FormGroup>
          <SavedViews
            filter={filter}
            setFilter={setFilter}
            filterSort={filterSort}
            setFilterSort={setFilterSort}
            filterMap={filterMap}
            setFilterMap={setFilterMap}
          />
        </div>
      </Popover>
      {/* LIV-25: pick several vehicles for one action. */}
      <Tooltip title={t(picking ? 'pickedDone' : 'pickedStart')}>
        <IconButton
          className={classes.tonal}
          onClick={() =>
            dispatch(picking ? devicesActions.stopPicking() : devicesActions.startPicking())
          }
          aria-pressed={picking}
          aria-label={t(picking ? 'pickedDone' : 'pickedStart')}
        >
          <ChecklistRoundedIcon />
        </IconButton>
      </Tooltip>
      <Tooltip
        open={!deviceReadonly && devicesLoaded && Object.keys(devices).length === 0}
        title={t('deviceRegisterFirst')}
        arrow
      >
        <span>
          <IconButton
            className={cx(
              classes.primary,
              devicesLoaded && Object.keys(devices).length === 0 && classes.primaryCta,
            )}
            onClick={() => navigate('/fleet/vehicle/new')}
            disabled={deviceReadonly}
            aria-label={t('shellAddDevice')}
          >
            <AddRoundedIcon />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  );
};

export default MainToolbar;
