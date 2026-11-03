import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Toolbar,
  IconButton,
  OutlinedInput,
  InputAdornment,
  Popover,
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
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme, alpha } from '@mui/material/styles';
import MapIcon from '@mui/icons-material/MapOutlined';
import DnsIcon from '@mui/icons-material/ViewListRounded';
import AddIcon from '@mui/icons-material/AddRounded';
import TuneIcon from '@mui/icons-material/TuneRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import { glass, accentGradient } from '../common/theme/glass';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useDeviceReadonly } from '../common/util/permissions';
import DeviceRow from './DeviceRow';

const useStyles = makeStyles()((theme) => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: 'auto',
    padding: theme.spacing(1.5, 2),
    [theme.breakpoints.up('sm')]: {
      minHeight: 'auto',
      padding: theme.spacing(1.5, 2),
    },
  },
  tonal: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.02),
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
      borderColor: alpha(theme.palette.primary.main, 0.35),
    },
  },
  primary: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 12,
    color: theme.palette.getContrastText(theme.palette.primary.main),
    background: accentGradient(theme),
    boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.35)}, inset 0 1px 0 ${alpha('#ffffff', 0.25)}`,
    transition: 'transform 160ms ease, box-shadow 160ms ease, filter 160ms ease',
    '&:hover': {
      background: accentGradient(theme),
      filter: 'brightness(1.08)',
      transform: 'translateY(-1px)',
      boxShadow: `0 10px 26px ${alpha(theme.palette.primary.main, 0.45)}, inset 0 1px 0 ${alpha('#ffffff', 0.25)}`,
    },
    '&.Mui-disabled': {
      background: theme.palette.action.disabledBackground,
      boxShadow: 'none',
    },
  },
  search: {
    height: 40,
    borderRadius: 12,
    backgroundColor: alpha(
      theme.palette.text.primary,
      theme.palette.mode === 'dark' ? 0.05 : 0.035,
    ),
    transition: 'box-shadow 160ms ease, background-color 160ms ease',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.divider,
    },
    '&.Mui-focused': {
      backgroundColor: theme.palette.background.paper,
      boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.14)}`,
    },
  },
  searchIcon: {
    color: theme.palette.text.secondary,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    marginInlineEnd: theme.spacing(0.5),
    borderRadius: 6,
    fontSize: '0.6875rem',
    fontWeight: 700,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: theme.palette.text.secondary,
    border: `1px solid ${theme.palette.divider}`,
    borderBottomWidth: 2,
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  popover: {
    ...glass(theme, 0.9),
    borderRadius: 16,
  },
  filterPanel: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
    width: theme.dimensions.drawerWidthTablet,
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
  const { classes } = useStyles();
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
  const searchRef = useRef();
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [devicesAnchorEl, setDevicesAnchorEl] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const deviceStatusCount = (status) =>
    Object.values(devices).filter((d) => d.status === status).length;

  return (
    <Toolbar ref={toolbarRef} className={classes.toolbar}>
      <IconButton className={classes.tonal} onClick={() => setDevicesOpen(!devicesOpen)}>
        {devicesOpen ? <MapIcon fontSize="small" /> : <DnsIcon fontSize="small" />}
      </IconButton>
      <OutlinedInput
        ref={inputRef}
        inputRef={searchRef}
        className={classes.search}
        placeholder={t('sharedSearchDevices')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={() => {
          setSearchFocused(true);
          setDevicesAnchorEl(toolbarRef.current);
        }}
        onBlur={() => {
          setSearchFocused(false);
          setDevicesAnchorEl(null);
        }}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon fontSize="small" className={classes.searchIcon} />
          </InputAdornment>
        }
        endAdornment={
          <InputAdornment position="end">
            {!searchFocused && !keyword && <span className={classes.kbd}>/</span>}
            <IconButton size="small" edge="end" onClick={() => setFilterAnchorEl(inputRef.current)}>
              <Badge
                color="info"
                variant="dot"
                invisible={
                  !filter.statuses.length && !filter.groups.length && !filter.geofences.length
                }
              >
                <TuneIcon fontSize="small" />
              </Badge>
            </IconButton>
          </InputAdornment>
        }
        size="small"
        fullWidth
      />
      <Popover
        open={!!devicesAnchorEl && !devicesOpen}
        anchorEl={devicesAnchorEl}
        onClose={() => setDevicesAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: Number(theme.spacing(2).slice(0, -2)),
        }}
        marginThreshold={0}
        slotProps={{
          paper: {
            className: classes.popover,
            style: { width: `calc(${toolbarRef.current?.clientWidth}px - ${theme.spacing(4)})` },
          },
        }}
        elevation={1}
        disableAutoFocus
        disableEnforceFocus
      >
        {filteredDevices.slice(0, 3).map((_, index) => (
          <DeviceRow key={filteredDevices[index].id} devices={filteredDevices} index={index} />
        ))}
        {filteredDevices.length > 3 && (
          <ListItemButton alignItems="center" onClick={() => setDevicesOpen(true)}>
            <ListItemText primary={t('notificationAlways')} style={{ textAlign: 'center' }} />
          </ListItemButton>
        )}
      </Popover>
      <Popover
        open={!!filterAnchorEl}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{ paper: { className: classes.popover } }}
      >
        <div className={classes.filterPanel}>
          <FormControl>
            <InputLabel>{t('deviceStatus')}</InputLabel>
            <Select
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
            <InputLabel>{t('settingsGroups')}</InputLabel>
            <Select
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
            <InputLabel>{t('sharedGeofences')}</InputLabel>
            <Select
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
            <InputLabel>{t('sharedSortBy')}</InputLabel>
            <Select
              label={t('sharedSortBy')}
              value={filterSort}
              onChange={(e) => setFilterSort(e.target.value)}
            >
              <MenuItem value="">{'\u00a0'}</MenuItem>
              <MenuItem value="name">{t('sharedName')}</MenuItem>
              <MenuItem value="lastUpdate">{t('deviceLastUpdate')}</MenuItem>
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
        </div>
      </Popover>
      <IconButton
        className={classes.primary}
        onClick={() => navigate('/settings/device')}
        disabled={deviceReadonly}
      >
        <Tooltip
          open={!deviceReadonly && devicesLoaded && Object.keys(devices).length === 0}
          title={t('deviceRegisterFirst')}
          arrow
        >
          <AddIcon />
        </Tooltip>
      </IconButton>
    </Toolbar>
  );
};

export default MainToolbar;
