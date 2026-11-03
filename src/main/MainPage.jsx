import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { makeStyles } from 'tss-react/mui';
import { useTheme, alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import DeviceList from './DeviceList';
import BottomMenu from '../common/components/BottomMenu';
import StatusCard from '../common/components/StatusCard';
import { devicesActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import EventsDrawer from './EventsDrawer';
import useFilter from './useFilter';
import MainToolbar from './MainToolbar';
import { useAttributePreference } from '../common/util/preferences';
import useFeatures from '../common/util/useFeatures';
import { glass } from '../common/theme/glass';
import MainHeader from './components/MainHeader';
import FleetStats from './components/FleetStats';

const MainMap = lazy(() => import('./MainMap'));

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
  },
  sidebar: {
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('md')]: {
      position: 'fixed',
      left: 0,
      top: 0,
      height: `calc(100% - ${theme.spacing(4)})`,
      width: theme.dimensions.drawerWidthDesktop,
      margin: theme.spacing(2),
      gap: theme.spacing(1.5),
      zIndex: 3,
    },
    [theme.breakpoints.down('md')]: {
      height: '100%',
      width: '100%',
    },
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    [theme.breakpoints.up('md')]: {
      ...glass(theme),
      pointerEvents: 'auto',
      position: 'relative',
      borderRadius: 22,
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        insetInline: 24,
        top: 0,
        height: 2,
        borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main} 30%, ${theme.palette.info.main} 70%, transparent)`,
        zIndex: 1,
      },
    },
    [theme.breakpoints.down('md')]: {
      flex: 1,
    },
  },
  panelOpen: {
    flex: 1,
  },
  header: {
    pointerEvents: 'auto',
    zIndex: 6,
    position: 'relative',
    [theme.breakpoints.down('md')]: {
      ...glass(theme, 0.92),
      borderRadius: 0,
      borderWidth: '0 0 1px 0',
    },
  },
  divider: {
    height: 1,
    marginInline: theme.spacing(2),
    background: `linear-gradient(90deg, transparent, ${theme.palette.divider} 20%, ${theme.palette.divider} 80%, transparent)`,
  },
  footer: {
    ...glass(theme),
    pointerEvents: 'auto',
    zIndex: 5,
    borderRadius: 22,
    overflow: 'hidden',
    padding: theme.spacing(0.75),
    '& .MuiPaper-root, & .MuiBottomNavigation-root': {
      backgroundColor: 'transparent',
      boxShadow: 'none',
      border: 'none',
    },
    '& .MuiBottomNavigationAction-root': {
      borderRadius: 16,
      transition: 'background-color 160ms ease, color 160ms ease',
      '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.06),
      },
    },
    '& .MuiBottomNavigationAction-root.Mui-selected': {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
    },
  },
  footerSpacer: {
    marginTop: 'auto',
  },
  middle: {
    flex: 1,
    display: 'grid',
    minHeight: 0,
  },
  middleHidden: {
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  contentMap: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
  },
  contentList: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
    zIndex: 4,
    display: 'flex',
    minHeight: 0,
    [theme.breakpoints.down('md')]: {
      backgroundColor: theme.palette.background.paper,
    },
  },
}));

const MainPage = () => {
  const { classes, cx } = useStyles();
  const dispatch = useDispatch();
  const theme = useTheme();

  const features = useFeatures();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const mapOnSelect = useAttributePreference('mapOnSelect', true);

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const selectedPosition = filteredPositions.find(
    (position) => selectedDeviceId && position.deviceId === selectedDeviceId,
  );

  const [filteredDevices, setFilteredDevices] = useState([]);

  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = usePersistedState('deviceFilter', {
    statuses: [],
    groups: [],
    geofences: [],
  });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  const [filterMap, setFilterMap] = usePersistedState('filterMap', false);

  const [devicesOpen, setDevicesOpen] = useState(desktop);
  const [eventsOpen, setEventsOpen] = useState(false);

  const onEventsClick = useCallback(() => setEventsOpen(true), [setEventsOpen]);

  useEffect(() => {
    if (!desktop && mapOnSelect && selectedDeviceId) {
      setDevicesOpen(false);
    }
  }, [desktop, mapOnSelect, selectedDeviceId]);

  useFilter(
    keyword,
    filter,
    filterSort,
    filterMap && !features.disableDeviceList,
    positions,
    setFilteredDevices,
    setFilteredPositions,
  );

  return (
    <div className={classes.root}>
      {desktop && (
        <Suspense fallback={null}>
          <MainMap
            filteredPositions={filteredPositions}
            selectedPosition={selectedPosition}
            onEventsClick={onEventsClick}
          />
        </Suspense>
      )}
      <div className={classes.sidebar}>
        {(!desktop || !features.disableDeviceList) && (
          <div className={cx(classes.panel, devicesOpen && classes.panelOpen)}>
            {!features.disableDeviceList && (
              <div className={classes.header}>
                {desktop && <MainHeader />}
                <MainToolbar
                  filteredDevices={filteredDevices}
                  devicesOpen={devicesOpen}
                  setDevicesOpen={setDevicesOpen}
                  keyword={keyword}
                  setKeyword={setKeyword}
                  filter={filter}
                  setFilter={setFilter}
                  filterSort={filterSort}
                  setFilterSort={setFilterSort}
                  filterMap={filterMap}
                  setFilterMap={setFilterMap}
                />
                {devicesOpen && <FleetStats filter={filter} setFilter={setFilter} />}
                {devicesOpen && desktop && <div className={classes.divider} />}
              </div>
            )}
            <div className={cx(classes.middle, !devicesOpen && classes.middleHidden)}>
              {!desktop && (
                <div className={classes.contentMap}>
                  <Suspense fallback={null}>
                    <MainMap
                      filteredPositions={filteredPositions}
                      selectedPosition={selectedPosition}
                      onEventsClick={onEventsClick}
                    />
                  </Suspense>
                </div>
              )}
              {!features.disableDeviceList && (
                <div
                  className={classes.contentList}
                  style={devicesOpen ? {} : { visibility: 'hidden' }}
                >
                  <DeviceList devices={filteredDevices} />
                </div>
              )}
            </div>
          </div>
        )}
        {desktop && !features.disableTabs && (
          <div
            className={cx(
              classes.footer,
              (!devicesOpen || features.disableDeviceList) && classes.footerSpacer,
            )}
          >
            <BottomMenu />
          </div>
        )}
      </div>
      <EventsDrawer open={eventsOpen} onClose={() => setEventsOpen(false)} />
      {selectedDeviceId && !features.disableStatusCard && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={selectedPosition}
          onClose={() => dispatch(devicesActions.selectId(null))}
          desktopPadding={features.disableDeviceList ? 0 : theme.dimensions.drawerWidthDesktop}
        />
      )}
    </div>
  );
};

export default MainPage;
