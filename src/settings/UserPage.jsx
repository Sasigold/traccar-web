import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  OutlinedInput,
  Dialog,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForeverRounded';
import CachedIcon from '@mui/icons-material/CachedRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useDispatch, useSelector } from 'react-redux';
import EditItemView from './components/EditItemView';
import CheckboxField from './components/CheckboxField';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import FleetRoleSection from './components/FleetRoleSection';
import { traccarFlagsForRole } from '../common/fleet/permissionsCatalog';
import { useTranslation } from '../common/components/LocalizationProvider';
import useUserAttributes from '../common/attributes/useUserAttributes';
import { sessionActions } from '../store';
import SelectField from '../common/components/SelectField';
import PasswordField from '../common/components/PasswordField';
import TotpQrCodeButton from '../common/components/TotpQrCodeButton';
import SettingsMenu from './components/SettingsMenu';
import useCommonUserAttributes from '../common/attributes/useCommonUserAttributes';
import { useAdministrator, useRestriction, useManager } from '../common/util/permissions';
import { useCatch } from '../reactHelper';
import useMapStyles from '../map/core/useMapStyles';
import { map } from '../map/core/MapView';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import { DateField } from '../common/components/pickers';

const UserPage = () => {
  const { classes } = useSettingsStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const manager = useManager();
  const fixedEmail = useRestriction('fixedEmail');

  const currentUser = useSelector((state) => state.session.user);
  const registrationEnabled = useSelector((state) => state.session.server.registration);
  const openIdForced = useSelector((state) => state.session.server.openIdForce);
  const totpEnable = useSelector((state) => state.session.server.attributes.totpEnable);
  const totpForce = useSelector((state) => state.session.server.attributes.totpForce);

  const mapStyles = useMapStyles();
  const commonUserAttributes = useCommonUserAttributes(t);
  const userAttributes = useUserAttributes(t);

  const { id } = useParams();
  const [item, setItem] = useState(id === currentUser.id.toString() ? currentUser : null);

  const [deleteEmail, setDeleteEmail] = useState();
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeToken, setRevokeToken] = useState('');

  const handleDelete = useCatch(async () => {
    if (deleteEmail === currentUser.email) {
      setDeleteFailed(false);
      await fetchOrThrow(`api/users/${currentUser.id}`, { method: 'DELETE' });
      navigate('/login');
      dispatch(sessionActions.updateUser(null));
    } else {
      setDeleteFailed(true);
    }
  });

  const handleGenerateTotp = useCatch(async () => {
    const response = await fetchOrThrow('api/users/totp', { method: 'POST' });
    setItem({ ...item, totpKey: await response.text() });
  });

  const closeRevokeDialog = () => {
    setRevokeDialogOpen(false);
    setRevokeToken('');
  };

  const handleRevokeToken = useCatch(async () => {
    await fetchOrThrow('api/session/token/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: revokeToken }).toString(),
    });
    closeRevokeDialog();
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const attribute = searchParams.get('attribute');

  useEffect(() => {
    if (item && attribute) {
      if (!item.attributes.hasOwnProperty(attribute)) {
        setItem({ ...item, attributes: { ...item.attributes, [attribute]: '' } });

        const newParams = new URLSearchParams(searchParams);
        newParams.delete('attribute');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [item, searchParams, setSearchParams, attribute]);

  const onItemSaved = (result) => {
    if (result.id === currentUser.id) {
      dispatch(sessionActions.updateUser(result));
    }
  };

  const validate = () =>
    item &&
    item.name &&
    item.email &&
    (item.id || item.password || openIdForced) &&
    (admin || !totpForce || item.totpKey);

  return (
    <EditItemView
      endpoint="users"
      item={item}
      setItem={setItem}
      defaultItem={admin ? { deviceLimit: -1 } : {}}
      validate={validate}
      onItemSaved={onItemSaved}
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'settingsUser']}
      description={t('userPageDescription')}
    >
      {item && (
        <>
          <FormSection title={t('formSectionBasic')}>
            <TextField
              value={item.name || ''}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
              label={t('sharedName')}
              helperText={t('userNameHelp')}
            />
            <TextField
              value={item.email || ''}
              onChange={(e) => setItem({ ...item, email: e.target.value })}
              label={t('userEmail')}
              helperText={t('userEmailHelp')}
              disabled={fixedEmail && item.id === currentUser.id}
            />
            {!openIdForced && (
              <PasswordField
                onChange={(e) => setItem({ ...item, password: e.target.value })}
                label={t('userPassword')}
                helperText={t(item.id ? 'userPasswordHelpEdit' : 'userPasswordHelpNew')}
              />
            )}
            {totpEnable && (
              <FormControl>
                <InputLabel htmlFor="user-totp-key">{t('loginTotpKey')}</InputLabel>
                <OutlinedInput
                  id="user-totp-key"
                  readOnly
                  label={t('loginTotpKey')}
                  value={item.totpKey || ''}
                  endAdornment={
                    <InputAdornment position="end">
                      <TotpQrCodeButton email={item.email} totpKey={item.totpKey} />
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={handleGenerateTotp}
                        aria-label={t('a11yGenerate')}
                      >
                        <CachedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={() => setItem({ ...item, totpKey: null })}
                        aria-label={t('a11yClear')}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  }
                />
                <FormHelperText>{t('userTotpHelp')}</FormHelperText>
              </FormControl>
            )}
          </FormSection>
          <FormSection title={t('userPreferencesSection')} description={t('userPreferencesHelp')}>
            <TextField
              value={item.phone || ''}
              onChange={(e) => setItem({ ...item, phone: e.target.value })}
              label={t('sharedPhone')}
              helperText={t('userPhoneHelp')}
            />
            <FormControl>
              <InputLabel id="user-page-map-default-label">{t('mapDefault')}</InputLabel>
              <Select
                labelId="user-page-map-default-label"
                label={t('mapDefault')}
                value={item.map || 'openFreeMap'}
                onChange={(e) => setItem({ ...item, map: e.target.value })}
              >
                {mapStyles
                  .filter((style) => style.available)
                  .map((style) => (
                    <MenuItem key={style.id} value={style.id}>
                      <Typography component="span">{style.title}</Typography>
                    </MenuItem>
                  ))}
              </Select>
              <FormHelperText>{t('userMapHelp')}</FormHelperText>
            </FormControl>
            <FormControl>
              <InputLabel id="user-page-settings-coordinate-format-label">
                {t('settingsCoordinateFormat')}
              </InputLabel>
              <Select
                labelId="user-page-settings-coordinate-format-label"
                label={t('settingsCoordinateFormat')}
                value={item.coordinateFormat || 'dd'}
                onChange={(e) => setItem({ ...item, coordinateFormat: e.target.value })}
              >
                <MenuItem value="dd">{t('sharedDecimalDegrees')}</MenuItem>
                <MenuItem value="ddm">{t('sharedDegreesDecimalMinutes')}</MenuItem>
                <MenuItem value="dms">{t('sharedDegreesMinutesSeconds')}</MenuItem>
              </Select>
              <FormHelperText>{t('userCoordinateHelp')}</FormHelperText>
            </FormControl>
            <FormControl>
              <InputLabel id="user-page-settings-speed-unit-label">
                {t('settingsSpeedUnit')}
              </InputLabel>
              <Select
                labelId="user-page-settings-speed-unit-label"
                label={t('settingsSpeedUnit')}
                value={(item.attributes && item.attributes.speedUnit) || 'kmh'}
                onChange={(e) =>
                  setItem({
                    ...item,
                    attributes: { ...item.attributes, speedUnit: e.target.value },
                  })
                }
              >
                <MenuItem value="kn">{t('sharedKn')}</MenuItem>
                <MenuItem value="kmh">{t('sharedKmh')}</MenuItem>
                <MenuItem value="mph">{t('sharedMph')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel id="user-page-settings-distance-unit-label">
                {t('settingsDistanceUnit')}
              </InputLabel>
              <Select
                labelId="user-page-settings-distance-unit-label"
                label={t('settingsDistanceUnit')}
                value={(item.attributes && item.attributes.distanceUnit) || 'km'}
                onChange={(e) =>
                  setItem({
                    ...item,
                    attributes: { ...item.attributes, distanceUnit: e.target.value },
                  })
                }
              >
                <MenuItem value="km">{t('sharedKm')}</MenuItem>
                <MenuItem value="mi">{t('sharedMi')}</MenuItem>
                <MenuItem value="nmi">{t('sharedNmi')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel id="user-page-settings-altitude-unit-label">
                {t('settingsAltitudeUnit')}
              </InputLabel>
              <Select
                labelId="user-page-settings-altitude-unit-label"
                label={t('settingsAltitudeUnit')}
                value={(item.attributes && item.attributes.altitudeUnit) || 'm'}
                onChange={(e) =>
                  setItem({
                    ...item,
                    attributes: { ...item.attributes, altitudeUnit: e.target.value },
                  })
                }
              >
                <MenuItem value="m">{t('sharedMeters')}</MenuItem>
                <MenuItem value="ft">{t('sharedFeet')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel id="user-page-settings-volume-unit-label">
                {t('settingsVolumeUnit')}
              </InputLabel>
              <Select
                labelId="user-page-settings-volume-unit-label"
                label={t('settingsVolumeUnit')}
                value={(item.attributes && item.attributes.volumeUnit) || 'ltr'}
                onChange={(e) =>
                  setItem({
                    ...item,
                    attributes: { ...item.attributes, volumeUnit: e.target.value },
                  })
                }
              >
                <MenuItem value="ltr">{t('sharedLiter')}</MenuItem>
                <MenuItem value="usGal">{t('sharedUsGallon')}</MenuItem>
                <MenuItem value="impGal">{t('sharedImpGallon')}</MenuItem>
              </Select>
            </FormControl>
            <SelectField
              value={item.attributes && item.attributes.timezone}
              onChange={(e) =>
                setItem({ ...item, attributes: { ...item.attributes, timezone: e.target.value } })
              }
              endpoint="api/server/timezones"
              keyGetter={(it) => it}
              titleGetter={(it) => it}
              label={t('sharedTimezone')}
              helperText={t('userTimezoneHelp')}
            />
            <TextField
              value={item.poiLayer || ''}
              onChange={(e) => setItem({ ...item, poiLayer: e.target.value })}
              label={t('mapPoiLayer')}
              helperText={t('userPoiLayerHelp')}
            />
          </FormSection>
          <FormSection title={t('userLocationSection')} description={t('userLocationHelp')}>
            <TextField
              type="number"
              value={item.latitude || 0}
              onChange={(e) => setItem({ ...item, latitude: Number(e.target.value) })}
              label={t('positionLatitude')}
            />
            <TextField
              type="number"
              value={item.longitude || 0}
              onChange={(e) => setItem({ ...item, longitude: Number(e.target.value) })}
              label={t('positionLongitude')}
            />
            <TextField
              type="number"
              value={item.zoom || 0}
              onChange={(e) => setItem({ ...item, zoom: Number(e.target.value) })}
              label={t('serverZoom')}
              helperText={t('userZoomHelp')}
            />
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                const { lng, lat } = map.getCenter();
                setItem({
                  ...item,
                  latitude: Number(lat.toFixed(6)),
                  longitude: Number(lng.toFixed(6)),
                  zoom: Number(map.getZoom().toFixed(1)),
                });
              }}
            >
              {t('mapCurrentLocation')}
            </Button>
          </FormSection>
          <FormSection title={t('sharedPermissions')} description={t('userPermissionsHelp')}>
            <DateField
              label={t('userExpirationTime')}
              value={item.expirationTime ? item.expirationTime.split('T')[0] : '2099-01-01'}
              onChange={(e) => {
                if (e.target.value) {
                  setItem({ ...item, expirationTime: new Date(e.target.value).toISOString() });
                }
              }}
              helperText={t('userExpirationHelp')}
              clearable={false}
              disabled={!manager}
            />
            <TextField
              type="number"
              value={item.deviceLimit || 0}
              onChange={(e) => setItem({ ...item, deviceLimit: Number(e.target.value) })}
              label={t('userDeviceLimit')}
              helperText={t('userDeviceLimitHelp')}
              disabled={!admin}
            />
            <TextField
              type="number"
              value={item.userLimit || 0}
              onChange={(e) => setItem({ ...item, userLimit: Number(e.target.value) })}
              label={t('userUserLimit')}
              helperText={t('userUserLimitHelp')}
              disabled={!admin}
            />
            <div>
              <Button variant="outlined" color="primary" onClick={() => setRevokeDialogOpen(true)}>
                {t('userRevokeToken')}
              </Button>
              <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 0.5 }}>
                {t('userRevokeTokenHelp')}
              </Typography>
            </div>
            <CheckboxField
              checked={item.disabled}
              onChange={(e) => setItem({ ...item, disabled: e.target.checked })}
              label={t('sharedDisabled')}
              helperText={t('userDisabledHelp')}
              disabled={!manager}
            />
            <CheckboxField
              checked={item.administrator}
              onChange={(e) => setItem({ ...item, administrator: e.target.checked })}
              label={t('userAdmin')}
              helperText={t('userAdminHelp')}
              disabled={!admin}
            />
            <CheckboxField
              checked={item.readonly}
              onChange={(e) => setItem({ ...item, readonly: e.target.checked })}
              label={t('serverReadonly')}
              helperText={t('userReadonlyHelp')}
              disabled={!manager}
            />
            <CheckboxField
              checked={item.deviceReadonly}
              onChange={(e) => setItem({ ...item, deviceReadonly: e.target.checked })}
              label={t('userDeviceReadonly')}
              helperText={t('userDeviceReadonlyHelp')}
              disabled={!manager}
            />
            <CheckboxField
              checked={item.limitCommands}
              onChange={(e) => setItem({ ...item, limitCommands: e.target.checked })}
              label={t('userLimitCommands')}
              helperText={t('userLimitCommandsHelp')}
              disabled={!manager}
            />
            <CheckboxField
              checked={item.disableReports}
              onChange={(e) => setItem({ ...item, disableReports: e.target.checked })}
              label={t('userDisableReports')}
              helperText={t('userDisableReportsHelp')}
              disabled={!manager}
            />
            <CheckboxField
              checked={item.fixedEmail}
              onChange={(e) => setItem({ ...item, fixedEmail: e.target.checked })}
              label={t('userFixedEmail')}
              helperText={t('userFixedEmailHelp')}
              disabled={!manager}
            />
          </FormSection>
          <FleetRoleSection
            traccarUserId={item.id}
            onRoleApplied={(role) =>
              setItem((current) =>
                role === 'owner' || role === 'admin' || current.administrator
                  ? current
                  : { ...current, ...traccarFlagsForRole(role) },
              )
            }
          />
          <EditAttributesAccordion
            attribute={attribute}
            attributes={item.attributes}
            setAttributes={(attributes) => setItem({ ...item, attributes })}
            definitions={{ ...commonUserAttributes, ...userAttributes }}
            focusAttribute={attribute}
          />
          {registrationEnabled && item.id === currentUser.id && !manager && (
            <FormSection title={t('userDeleteAccount')} tone="danger">
              <TextField
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                label={t('userEmail')}
                error={deleteFailed}
              />
              <Button
                variant="outlined"
                color="error"
                onClick={handleDelete}
                startIcon={<DeleteForeverIcon />}
              >
                {t('userDeleteAccount')}
              </Button>
            </FormSection>
          )}
        </>
      )}
      <Dialog open={revokeDialogOpen} onClose={closeRevokeDialog} fullWidth maxWidth="xs">
        <DialogContent className={classes.details}>
          <TextField
            value={revokeToken}
            onChange={(e) => setRevokeToken(e.target.value)}
            label={t('userToken')}
            helperText={t('userTokenHelp')}
            autoFocus
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRevokeDialog}>{t('sharedCancel')}</Button>
          <Button onClick={handleRevokeToken} disabled={!revokeToken} variant="contained">
            {t('userRevokeToken')}
          </Button>
        </DialogActions>
      </Dialog>
    </EditItemView>
  );
};

export default UserPage;
