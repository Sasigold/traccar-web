import { lazy, Suspense, useState, useEffect } from 'react';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@mui/material';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useVisiblePositions from '../common/fleet/usePrivacy';
import { logPrivacyView } from '../common/fleet/privacyData';
import DeviceList from './DeviceList';
import MorningInsights from './MorningInsights';
import ActiveFilters from './components/ActiveFilters';
import DeviceListShimmer from './components/DeviceListShimmer';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import { rememberDevice } from '../common/util/recentDevices';
import StatusCard from '../common/components/StatusCard';
import EmptyState from '../common/components/table/EmptyState';
import { devicesActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import useFilter from './useFilter';
import MainToolbar from './MainToolbar';
import { useAttributePreference } from '../common/util/preferences';
import { useAdministrator, useDeviceReadonly, useRestriction } from '../common/util/permissions';
import useFeatures from '../common/util/useFeatures';
import { glass } from '../common/theme/surfaces';
import { useTranslation } from '../common/components/LocalizationProvider';
import FleetStats from './components/FleetStats';
import ExpiryTiles from '../fleet/components/ExpiryTiles';
import { decodeView } from './savedViews';
import { fitView } from './components/SavedViews';

const MainMap = lazy(() => import('./MainMap'));

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'relative',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  sidebar: {
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('md')]: {
      position: 'absolute',
      insetInlineStart: theme.dimensions.panelGap,
      top: theme.dimensions.panelGap,
      bottom: theme.dimensions.panelGap,
      width: theme.dimensions.devicePanelWidth,
      zIndex: theme.layers.panel,
    },
    [theme.breakpoints.down('md')]: {
      height: '100%',
      width: '100%',
    },
  },
  sidebarCollapsed: {
    [theme.breakpoints.up('md')]: {
      bottom: 'auto',
    },
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    flex: 1,
    [theme.breakpoints.up('md')]: {
      ...glass(theme, 0.9),
      pointerEvents: 'auto',
      position: 'relative',
      borderRadius: theme.tokens.radius.xxl,
      overflow: 'hidden',
    },
  },
  header: {
    pointerEvents: 'auto',
    zIndex: 6,
    position: 'relative',
    [theme.breakpoints.down('md')]: {
      backgroundColor: theme.palette.background.paper,
      borderBottom: `1px solid ${theme.palette.surface.border}`,
    },
  },
  divider: {
    height: 1,
    marginInline: theme.spacing(2),
    backgroundColor: theme.palette.surface.border,
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
    position: 'relative',
  },
  // AI-02: beside the map, clear of the map controls at the end side.
  insights: {
    position: 'absolute',
    zIndex: theme.layers.panel,
    [theme.breakpoints.up('md')]: {
      top: theme.dimensions.panelGap,
      insetInlineEnd: 76,
    },
    [theme.breakpoints.down('md')]: {
      top: theme.spacing(1.5),
      insetInlineStart: theme.spacing(1.5),
      zIndex: 3,
    },
  },
  contentList: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
    zIndex: 4,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    [theme.breakpoints.down('md')]: {
      backgroundColor: theme.palette.background.paper,
    },
  },
  empty: {
    flex: 1,
  },
}));

const MainPage = () => {
  const { classes, cx } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const t = useTranslation();

  const features = useFeatures();
  const deviceReadonly = useDeviceReadonly();
  const administrator = useAdministrator();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const readonly = useRestriction('readonly');

  const mapOnSelect = useAttributePreference('mapOnSelect', true);

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const cardHidden = useSelector((state) => state.devices.cardHidden);
  const livePositions = useSelector((state) => state.session.positions);
  // Locations hidden by the privacy policy never reach the map or the card (ISR-03).
  const { positions, hidden: hiddenPositions } = useVisiblePositions(livePositions);
  const devicesLoaded = useSelector((state) => state.devices.loaded);
  const deviceCount = useSelector((state) => Object.keys(state.devices.items).length);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const selectedPosition = filteredPositions.find(
    (position) => selectedDeviceId && position.deviceId === selectedDeviceId,
  );

  const [filteredDevices, setFilteredDevices] = useState([]);

  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = usePersistedState('deviceFilter', {
    activities: [],
    statuses: [],
    groups: [],
    geofences: [],
  });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  // LIV-11: the map shows what the list shows, unless switched off.
  const [filterMap, setFilterMap] = usePersistedState('filterMap', true);
  const [favorites] = usePersistedState('favoriteDevices', []);

  // LIV-22: a shared view link (?view=…) applies the view once, then leaves a clean address.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const encoded = searchParams.get('view');
    if (!encoded) return;
    const view = decodeView(encoded);
    if (view) {
      setFilter(view.filter);
      setFilterSort(view.sort);
      setFilterMap(view.filterMap);
      fitView(view);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, setFilter, setFilterSort, setFilterMap]);

  const [devicesOpen, setDevicesOpen] = useState(desktop);

  useEffect(() => {
    if (!desktop && mapOnSelect && selectedDeviceId) {
      setDevicesOpen(false);
    }
  }, [desktop, mapOnSelect, selectedDeviceId]);

  // A driver starts in the driver area (ADM-09), once per session; the map stays one tab away.
  const driverRole = useSelector((state) => state.fleet.profile?.role === 'driver');
  useEffect(() => {
    if (driverRole && !sessionStorage.getItem('driverLanded')) {
      sessionStorage.setItem('driverLanded', '1');
      navigate('/driver', { replace: true });
    }
  }, [driverRole, navigate]);

  // LIV-16: the browser tab names the screen.
  useEffect(() => {
    document.title = `${t('mapLiveTitle')} · viper fleet`;
  }, [t]);

  useEffect(() => {
    if (selectedDeviceId) {
      rememberDevice(selectedDeviceId);
      // Opening a vehicle shows where it is now: recorded in the view log (ISR-03).
      logPrivacyView([selectedDeviceId], 'live');
    }
  }, [selectedDeviceId]);

  useFilter(
    keyword,
    filter,
    filterSort,
    filterMap && !features.disableDeviceList,
    positions,
    setFilteredDevices,
    setFilteredPositions,
    favorites,
  );

  const panelOffset = features.disableDeviceList
    ? '0px'
    : `${theme.dimensions.devicePanelWidth + 2 * theme.dimensions.panelGap}px`;

  const showEmpty = devicesLoaded && deviceCount === 0;

  return (
    <div className={classes.root}>
      {desktop && (
        <Suspense fallback={null}>
          <MainMap filteredPositions={filteredPositions} selectedPosition={selectedPosition} />
        </Suspense>
      )}
      {desktop && <MorningInsights className={classes.insights} />}
      <div className={cx(classes.sidebar, desktop && !devicesOpen && classes.sidebarCollapsed)}>
        {(!desktop || !features.disableDeviceList) && (
          <div className={classes.panel}>
            {!features.disableDeviceList && (
              <div className={classes.header}>
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
                {devicesOpen && !showEmpty && <FleetStats filter={filter} setFilter={setFilter} />}
                {devicesOpen && !showEmpty && (
                  <ActiveFilters
                    filter={filter}
                    setFilter={setFilter}
                    keyword={keyword}
                    setKeyword={setKeyword}
                    shown={filteredDevices.length}
                    total={deviceCount}
                  />
                )}
                {devicesOpen && !showEmpty && !readonly && <ExpiryTiles compact />}
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
                    />
                  </Suspense>
                  <MorningInsights className={classes.insights} />
                </div>
              )}
              {!features.disableDeviceList && (
                <div
                  className={classes.contentList}
                  style={devicesOpen ? {} : { visibility: 'hidden' }}
                >
                  {showEmpty ? (
                    // Who is looking decides what an empty fleet says (ADM-01): a viewer waits
                    // for the installation, the operator opens the setup wizard, a manager adds
                    // the first vehicle.
                    <EmptyState
                      className={classes.empty}
                      icon={<DnsRoundedIcon />}
                      title={t(deviceReadonly ? 'deviceEmptyReadonly' : 'deviceRegisterFirst')}
                      description={t(
                        deviceReadonly ? 'deviceEmptyReadonlyHelp' : 'deviceRegisterFirstHelp',
                      )}
                      action={
                        !deviceReadonly && (
                          <Button
                            variant="contained"
                            onClick={() =>
                              navigate(administrator ? '/admin/device' : '/fleet/vehicle/new')
                            }
                          >
                            {t(administrator ? 'deviceSetupWizard' : 'shellAddDevice')}
                          </Button>
                        )
                      }
                    />
                  ) : !devicesLoaded ? (
                    // LIV-11: rows of shimmer while the fleet loads, not an empty list.
                    <DeviceListShimmer />
                  ) : filteredDevices.length === 0 && deviceCount > 0 ? (
                    <EmptyState
                      className={classes.empty}
                      icon={<FilterAltOffRoundedIcon />}
                      title={t('deviceFilterNoMatch')}
                      action={
                        <Button
                          onClick={() => {
                            setFilter({ activities: [], statuses: [], groups: [], geofences: [] });
                            setKeyword('');
                          }}
                        >
                          {t('deviceFilterClear')}
                        </Button>
                      }
                    />
                  ) : (
                    <DeviceList devices={filteredDevices} keyword={keyword} favorites={favorites} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {selectedDeviceId && !cardHidden && !features.disableStatusCard && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={selectedPosition}
          privacy={hiddenPositions[selectedDeviceId]}
          onClose={() => dispatch(devicesActions.hideCard())}
          desktopPadding={panelOffset}
        />
      )}
    </div>
  );
};

export default MainPage;
