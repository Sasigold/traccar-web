import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormGroup,
  InputAdornment,
  IconButton,
  OutlinedInput,
  Autocomplete,
  TextField,
  createFilterOptions,
  Button,
  Tabs,
  Tab,
  Tooltip,
  Chip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CachedRoundedIcon from '@mui/icons-material/CachedRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import { useTranslation, useTranslationKeys } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import FormPage from './components/FormPage';
import FormSection from './components/FormSection';
import CheckboxField from './components/CheckboxField';
import SaveBar from './components/SaveBar';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import { prefixString, unprefixString } from '../common/util/stringUtils';
import SelectField from '../common/components/SelectField';
import useMapStyles from '../map/core/useMapStyles';
import useMapOverlays from '../map/overlay/useMapOverlays';
import { useCatch } from '../reactHelper';
import { sessionActions } from '../store';
import { useAdministrator, useRestriction } from '../common/util/permissions';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { DateField } from '../common/components/pickers';

const deviceFields = [
  { id: 'name', name: 'sharedName' },
  { id: 'uniqueId', name: 'deviceIdentifier' },
  { id: 'phone', name: 'sharedPhone' },
  { id: 'model', name: 'deviceModel' },
  { id: 'contact', name: 'deviceContact' },
  { id: 'geofenceIds', name: 'sharedGeofence' },
  { id: 'driverUniqueId', name: 'sharedDriver' },
  { id: 'motion', name: 'positionMotion' },
];

const useStyles = makeStyles()((theme) => ({
  tabs: {
    marginBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '& .MuiTab-root': {
      minHeight: 48,
      gap: theme.spacing(1),
    },
  },
  toggles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: theme.spacing(1),
  },
  toggle: {
    margin: 0,
    paddingInline: theme.spacing(0.5, 1.5),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.surface.sunken,
  },
  verticalActions: {
    display: 'flex',
    flexDirection: 'column',
  },
  tokenField: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.8125rem',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing(1.5),
  },
  infoTile: {
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.surface.sunken,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  infoValue: {
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
}));

const PreferencesPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const admin = useAdministrator();
  const readonly = useRestriction('readonly');

  const [searchParams, setSearchParams] = useSearchParams();

  const user = useSelector((state) => state.session.user);
  const [attributes, setAttributes] = useState(user.attributes);
  const [saving, setSaving] = useState(false);

  const versionApp = import.meta.env.VITE_APP_VERSION;
  const versionServer = useSelector((state) => state.session.server.version);
  const socket = useSelector((state) => state.session.socket);

  const [token, setToken] = useState(null);
  const [tokenExpiration, setTokenExpiration] = useState(() =>
    dayjs().add(1, 'week').locale('en').format('YYYY-MM-DD'),
  );

  const mapStyles = useMapStyles();
  const mapOverlays = useMapOverlays();

  const positionAttributes = usePositionAttributes(t);

  const filter = createFilterOptions();

  const sections = useMemo(
    () =>
      [
        { id: 'map', titleKey: 'mapTitle', icon: MapRoundedIcon, visible: !readonly },
        { id: 'devices', titleKey: 'sharedDeviceList', icon: DnsRoundedIcon, visible: !readonly },
        { id: 'sound', titleKey: 'sharedSound', icon: VolumeUpRoundedIcon, visible: !readonly },
        { id: 'token', titleKey: 'settingsAccessToken', icon: KeyRoundedIcon, visible: true },
        { id: 'info', titleKey: 'sharedInfoTitle', icon: InfoRoundedIcon, visible: !readonly },
      ].filter((section) => section.visible),
    [readonly],
  );

  const requested = searchParams.get('section');
  const section = sections.some((it) => it.id === requested) ? requested : sections[0].id;

  const selectSection = (id) => {
    const params = new URLSearchParams(searchParams);
    params.set('section', id);
    setSearchParams(params, { replace: true });
  };

  const generateToken = useCatch(async () => {
    const expiration = dayjs(tokenExpiration, 'YYYY-MM-DD').toISOString();
    const response = await fetchOrThrow('api/session/token', {
      method: 'POST',
      body: new URLSearchParams(`expiration=${expiration}`),
    });
    setToken(await response.text());
  });

  const alarms = useTranslationKeys((it) => it.startsWith('alarm')).map((it) => ({
    key: unprefixString('alarm', it),
    name: t(it),
  }));

  const handleSave = useCatch(async () => {
    setSaving(true);
    try {
      const response = await fetchOrThrow(`api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...user, attributes }),
      });
      dispatch(sessionActions.updateUser(await response.json()));
      navigate(-1);
    } finally {
      setSaving(false);
    }
  });

  const handleReboot = useCatch(async () => {
    const response = await fetch('api/server/reboot', { method: 'POST' });
    throw Error(response.statusText);
  });

  const renderToggle = (key, labelKey, defaultValue, helpKey) => (
    <CheckboxField
      key={key}
      checked={attributes.hasOwnProperty(key) ? attributes[key] : defaultValue}
      onChange={(e) => setAttributes({ ...attributes, [key]: e.target.checked })}
      label={t(labelKey)}
      helperText={helpKey && t(helpKey)}
    />
  );

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'sharedPreferences']}
      description={t('settingsPreferencesDescription')}
      footer={
        !readonly && <SaveBar onCancel={() => navigate(-1)} onSave={handleSave} saving={saving} />
      }
    >
      <Tabs
        className={classes.tabs}
        value={section}
        onChange={(_, value) => selectSection(value)}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {sections.map((it) => {
          const Icon = it.icon;
          return (
            <Tab
              key={it.id}
              value={it.id}
              label={t(it.titleKey)}
              icon={<Icon fontSize="small" />}
              iconPosition="start"
            />
          );
        })}
      </Tabs>

      {section === 'map' && (
        <FormSection
          title={t('mapTitle')}
          description={t('settingsPreferencesDescription')}
          icon={<MapRoundedIcon />}
        >
          <FormControl>
            <InputLabel id="preferences-page-map-active-label">{t('mapActive')}</InputLabel>
            <Select
              labelId="preferences-page-map-active-label"
              label={t('mapActive')}
              value={
                attributes.activeMapStyles?.split(',') || [
                  'viperFleet',
                  'locationIqStreets',
                  'locationIqDark',
                  'openFreeMap',
                ]
              }
              onChange={(e, child) => {
                const clicked = mapStyles.find((s) => s.id === child.props.value);
                if (clicked.available) {
                  setAttributes({ ...attributes, activeMapStyles: e.target.value.join(',') });
                } else if (clicked.id !== 'custom') {
                  const query = new URLSearchParams({ attribute: clicked.attribute });
                  navigate(`/settings/user/${user.id}?${query.toString()}`);
                }
              }}
              multiple
            >
              {mapStyles.map((style) => (
                <MenuItem key={style.id} value={style.id}>
                  <Typography component="span" color={style.available ? 'textPrimary' : 'error'}>
                    {style.title}
                  </Typography>
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{t('preferencesMapActiveHelp')}</FormHelperText>
          </FormControl>
          <FormControl>
            <InputLabel id="preferences-page-map-overlay-label">{t('mapOverlay')}</InputLabel>
            <Select
              labelId="preferences-page-map-overlay-label"
              label={t('mapOverlay')}
              value={attributes.selectedMapOverlay?.split(',') || []}
              onChange={(e, child) => {
                const clicked = mapOverlays.find((o) => o.id === child.props.value);
                if (clicked.available) {
                  setAttributes({
                    ...attributes,
                    selectedMapOverlay: e.target.value.join(','),
                  });
                } else if (clicked.id !== 'custom') {
                  const query = new URLSearchParams({ attribute: clicked.attribute });
                  navigate(`/settings/user/${user.id}?${query.toString()}`);
                }
              }}
              multiple
            >
              {mapOverlays.map((overlay) => (
                <MenuItem key={overlay.id} value={overlay.id}>
                  <Typography component="span" color={overlay.available ? 'textPrimary' : 'error'}>
                    {overlay.title}
                  </Typography>
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{t('preferencesOverlayHelp')}</FormHelperText>
          </FormControl>
          <Autocomplete
            multiple
            freeSolo
            options={Object.keys(positionAttributes)}
            getOptionLabel={(option) => {
              if (typeof option === 'object' && option.inputValue) {
                return option.inputValue;
              }
              return positionAttributes[option]?.name || option;
            }}
            value={
              attributes.positionItems?.split(',') || [
                'fixTime',
                'address',
                'speed',
                'totalDistance',
              ]
            }
            onChange={(_, newValue) => {
              setAttributes({
                ...attributes,
                positionItems: newValue
                  .map((x) => (typeof x === 'string' ? x : x.inputValue))
                  .join(','),
              });
            }}
            filterOptions={(options, params) => {
              const filtered = filter(options, params);
              if (params.inputValue && !options.includes(params.inputValue)) {
                filtered.push({
                  inputValue: params.inputValue,
                  name: `${t('sharedAdd')} "${params.inputValue}"`,
                });
              }
              return filtered;
            }}
            renderOption={(props, option) => (
              <li {...props}>
                {option.name ? option.name : positionAttributes[option]?.name || option}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('attributePopupInfo')}
                helperText={t('preferencesPopupHelp')}
              />
            )}
          />
          <FormControl>
            <InputLabel id="preferences-page-map-live-routes-label">
              {t('mapLiveRoutes')}
            </InputLabel>
            <Select
              labelId="preferences-page-map-live-routes-label"
              label={t('mapLiveRoutes')}
              value={attributes.mapLiveRoutes || 'none'}
              onChange={(e) => setAttributes({ ...attributes, mapLiveRoutes: e.target.value })}
            >
              <MenuItem value="none">{t('sharedDisabled')}</MenuItem>
              <MenuItem value="selected">{t('deviceSelected')}</MenuItem>
              <MenuItem value="all">{t('notificationAlways')}</MenuItem>
            </Select>
            <FormHelperText>{t('preferencesLiveRoutesHelp')}</FormHelperText>
          </FormControl>
          <FormControl>
            <InputLabel id="preferences-page-map-direction-label">{t('mapDirection')}</InputLabel>
            <Select
              labelId="preferences-page-map-direction-label"
              label={t('mapDirection')}
              value={attributes.mapDirection || 'selected'}
              onChange={(e) => setAttributes({ ...attributes, mapDirection: e.target.value })}
            >
              <MenuItem value="none">{t('sharedDisabled')}</MenuItem>
              <MenuItem value="selected">{t('deviceSelected')}</MenuItem>
              <MenuItem value="all">{t('notificationAlways')}</MenuItem>
            </Select>
            <FormHelperText>{t('preferencesDirectionHelp')}</FormHelperText>
          </FormControl>
          <FormGroup className={classes.toggles}>
            {renderToggle('mapFollow', 'deviceFollow', true, 'preferencesFollowHelp')}
            {renderToggle('mapCluster', 'mapClustering', true, 'preferencesClusterHelp')}
            {renderToggle('mapOnSelect', 'mapOnSelect', true, 'preferencesOnSelectHelp')}
          </FormGroup>
        </FormSection>
      )}

      {section === 'devices' && (
        <FormSection
          title={t('sharedDeviceList')}
          description={t('settingsDevicesDescription')}
          icon={<DnsRoundedIcon />}
        >
          <SelectField
            value={attributes.devicePrimary || 'name'}
            onChange={(e) => setAttributes({ ...attributes, devicePrimary: e.target.value })}
            data={deviceFields}
            titleGetter={(it) => t(it.name)}
            label={t('devicePrimaryInfo')}
            helperText={t('preferencesPrimaryHelp')}
          />
          <SelectField
            value={attributes.deviceSecondary}
            onChange={(e) => setAttributes({ ...attributes, deviceSecondary: e.target.value })}
            data={deviceFields}
            titleGetter={(it) => t(it.name)}
            label={t('deviceSecondaryInfo')}
            helperText={t('preferencesSecondaryHelp')}
          />
        </FormSection>
      )}

      {section === 'sound' && (
        <FormSection
          title={t('sharedSound')}
          description={t('preferencesSoundHelp')}
          icon={<VolumeUpRoundedIcon />}
        >
          <SelectField
            multiple
            value={attributes.soundEvents?.split(',') || []}
            onChange={(e) =>
              setAttributes({ ...attributes, soundEvents: e.target.value.join(',') })
            }
            endpoint="api/notifications/types"
            keyGetter={(it) => it.type}
            titleGetter={(it) => t(prefixString('event', it.type))}
            label={t('eventsSoundEvents')}
          />
          <SelectField
            multiple
            value={attributes.soundAlarms?.split(',') || ['sos']}
            onChange={(e) =>
              setAttributes({ ...attributes, soundAlarms: e.target.value.join(',') })
            }
            data={alarms}
            keyGetter={(it) => it.key}
            label={t('eventsSoundAlarms')}
          />
        </FormSection>
      )}

      {section === 'token' && (
        <FormSection
          title={t('userToken')}
          description={t('preferencesTokenHelp')}
          icon={<KeyRoundedIcon />}
        >
          <DateField
            label={t('userExpirationTime')}
            value={tokenExpiration}
            clearable={false}
            onChange={(e) => {
              setTokenExpiration(e.target.value);
              setToken(null);
            }}
          />
          <FormControl>
            <OutlinedInput
              multiline
              rows={5}
              readOnly
              type="text"
              value={token || ''}
              slotProps={{ input: { 'aria-label': t('userToken') } }}
              className={classes.tokenField}
              endAdornment={
                <InputAdornment position="end">
                  <div className={classes.verticalActions}>
                    <Tooltip title={t('sharedAdd')} describeChild>
                      <span>
                        <IconButton
                          aria-label={t('sharedAdd')}
                          size="small"
                          edge="end"
                          onClick={generateToken}
                          disabled={!!token}
                        >
                          <CachedRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('sharedCopy')} describeChild>
                      <span>
                        <IconButton
                          aria-label={t('sharedCopy')}
                          size="small"
                          edge="end"
                          onClick={() => navigator.clipboard.writeText(token)}
                          disabled={!token}
                        >
                          <ContentCopyRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </div>
                </InputAdornment>
              }
            />
          </FormControl>
        </FormSection>
      )}

      {section === 'info' && (
        <FormSection title={t('settingsSystem')} icon={<InfoRoundedIcon />}>
          <div className={classes.infoGrid}>
            <div className={classes.infoTile}>
              <Typography variant="caption" color="textSecondary">
                {t('settingsAppVersion')}
              </Typography>
              <Typography variant="body1" className={classes.infoValue}>
                {versionApp}
              </Typography>
            </div>
            <div className={classes.infoTile}>
              <Typography variant="caption" color="textSecondary">
                {t('settingsServerVersion')}
              </Typography>
              <Typography variant="body1" className={classes.infoValue}>
                {versionServer || '-'}
              </Typography>
            </div>
            <div className={classes.infoTile}>
              <Typography variant="caption" color="textSecondary">
                {t('settingsConnection')}
              </Typography>
              <div>
                <Chip
                  size="small"
                  color={socket ? 'success' : 'default'}
                  label={socket ? t('deviceStatusOnline') : t('deviceStatusOffline')}
                />
              </div>
            </div>
          </div>
          <div className={classes.actions}>
            <Button variant="outlined" color="primary" onClick={() => navigate('/emulator')}>
              {t('sharedEmulator')}
            </Button>
            {admin && (
              <Button variant="outlined" color="error" onClick={handleReboot}>
                {t('serverReboot')}
              </Button>
            )}
          </div>
        </FormSection>
      )}
    </FormPage>
  );
};

export default PreferencesPage;
