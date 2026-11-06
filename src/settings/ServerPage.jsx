import { useState } from 'react';
import TextField from '@mui/material/TextField';
import {
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import FileInput from '../common/components/FileInput';
import { sessionActions } from '../store';
import EditAttributesAccordion from './components/EditAttributesAccordion';
import { useTranslation } from '../common/components/LocalizationProvider';
import SelectField from '../common/components/SelectField';
import SettingsMenu from './components/SettingsMenu';
import useCommonDeviceAttributes from '../common/attributes/useCommonDeviceAttributes';
import useCommonUserAttributes from '../common/attributes/useCommonUserAttributes';
import { useCatch } from '../reactHelper';
import useServerAttributes from '../common/attributes/useServerAttributes';
import useMapStyles from '../map/core/useMapStyles';
import { map } from '../map/core/MapView';
import fetchOrThrow from '../common/util/fetchOrThrow';
import FormSection from './components/FormSection';
import CheckboxField from './components/CheckboxField';
import FormPage from './components/FormPage';
import SaveBar from './components/SaveBar';

const ServerPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const mapStyles = useMapStyles();
  const commonUserAttributes = useCommonUserAttributes(t);
  const commonDeviceAttributes = useCommonDeviceAttributes(t);
  const serverAttributes = useServerAttributes(t);

  const original = useSelector((state) => state.session.server);
  const [item, setItem] = useState({ ...original });

  const handleFileChange = useCatch(async (newFile) => {
    if (newFile) {
      await fetchOrThrow(`api/server/file/${newFile.name}`, {
        method: 'POST',
        body: newFile,
      });
    }
  });

  const handleSave = useCatch(async () => {
    const response = await fetchOrThrow('api/server', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    dispatch(sessionActions.updateServer(await response.json()));
    navigate(-1);
  });

  return (
    <FormPage
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle', 'settingsServer']}
      description={t('serverPageDescription')}
      footer={<SaveBar onCancel={() => navigate(-1)} onSave={handleSave} />}
    >
      {item && (
        <>
          <FormSection title={t('serverDisplaySection')} description={t('serverDisplayHelp')}>
            <TextField
              value={item.mapUrl || ''}
              onChange={(event) => setItem({ ...item, mapUrl: event.target.value })}
              label={t('mapCustomLabel')}
              helperText={t('serverMapUrlHelp')}
            />
            <TextField
              value={item.overlayUrl || ''}
              onChange={(event) => setItem({ ...item, overlayUrl: event.target.value })}
              label={t('mapOverlayCustom')}
              helperText={t('serverOverlayUrlHelp')}
            />
            <FormControl>
              <InputLabel id="server-page-map-default-label">{t('mapDefault')}</InputLabel>
              <Select
                labelId="server-page-map-default-label"
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
              <InputLabel id="server-page-settings-coordinate-format-label">
                {t('settingsCoordinateFormat')}
              </InputLabel>
              <Select
                labelId="server-page-settings-coordinate-format-label"
                label={t('settingsCoordinateFormat')}
                value={item.coordinateFormat || 'dd'}
                onChange={(event) => setItem({ ...item, coordinateFormat: event.target.value })}
              >
                <MenuItem value="dd">{t('sharedDecimalDegrees')}</MenuItem>
                <MenuItem value="ddm">{t('sharedDegreesDecimalMinutes')}</MenuItem>
                <MenuItem value="dms">{t('sharedDegreesMinutesSeconds')}</MenuItem>
              </Select>
              <FormHelperText>{t('userCoordinateHelp')}</FormHelperText>
            </FormControl>
            <FormControl>
              <InputLabel id="server-page-settings-speed-unit-label">
                {t('settingsSpeedUnit')}
              </InputLabel>
              <Select
                labelId="server-page-settings-speed-unit-label"
                label={t('settingsSpeedUnit')}
                value={item.attributes.speedUnit || 'kmh'}
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
              <InputLabel id="server-page-settings-distance-unit-label">
                {t('settingsDistanceUnit')}
              </InputLabel>
              <Select
                labelId="server-page-settings-distance-unit-label"
                label={t('settingsDistanceUnit')}
                value={item.attributes.distanceUnit || 'km'}
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
              <InputLabel id="server-page-settings-altitude-unit-label">
                {t('settingsAltitudeUnit')}
              </InputLabel>
              <Select
                labelId="server-page-settings-altitude-unit-label"
                label={t('settingsAltitudeUnit')}
                value={item.attributes.altitudeUnit || 'm'}
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
              <InputLabel id="server-page-settings-volume-unit-label">
                {t('settingsVolumeUnit')}
              </InputLabel>
              <Select
                labelId="server-page-settings-volume-unit-label"
                label={t('settingsVolumeUnit')}
                value={item.attributes.volumeUnit || 'ltr'}
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
              value={item.attributes.timezone}
              onChange={(e) =>
                setItem({
                  ...item,
                  attributes: { ...item.attributes, timezone: e.target.value },
                })
              }
              endpoint="api/server/timezones"
              keyGetter={(it) => it}
              titleGetter={(it) => it}
              label={t('sharedTimezone')}
              helperText={t('userTimezoneHelp')}
            />
            <TextField
              value={item.poiLayer || ''}
              onChange={(event) => setItem({ ...item, poiLayer: event.target.value })}
              label={t('mapPoiLayer')}
              helperText={t('userPoiLayerHelp')}
            />
            <TextField
              value={item.announcement || ''}
              onChange={(event) => setItem({ ...item, announcement: event.target.value })}
              label={t('serverAnnouncement')}
              helperText={t('serverAnnouncementHelp')}
            />
            <CheckboxField
              checked={item.forceSettings}
              onChange={(event) => setItem({ ...item, forceSettings: event.target.checked })}
              label={t('serverForceSettings')}
              helperText={t('serverForceSettingsHelp')}
            />
          </FormSection>
          <FormSection title={t('userLocationSection')} description={t('serverLocationHelp')}>
            <TextField
              type="number"
              value={item.latitude || 0}
              onChange={(event) => setItem({ ...item, latitude: Number(event.target.value) })}
              label={t('positionLatitude')}
            />
            <TextField
              type="number"
              value={item.longitude || 0}
              onChange={(event) => setItem({ ...item, longitude: Number(event.target.value) })}
              label={t('positionLongitude')}
            />
            <TextField
              type="number"
              value={item.zoom || 0}
              onChange={(event) => setItem({ ...item, zoom: Number(event.target.value) })}
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
          <FormSection
            title={t('serverPermissionsSection')}
            description={t('serverPermissionsHelp')}
          >
            <CheckboxField
              checked={item.registration}
              onChange={(event) => setItem({ ...item, registration: event.target.checked })}
              label={t('serverRegistration')}
              helperText={t('serverRegistrationHelp')}
            />
            <CheckboxField
              checked={item.readonly}
              onChange={(event) => setItem({ ...item, readonly: event.target.checked })}
              label={t('serverReadonly')}
              helperText={t('userReadonlyHelp')}
            />
            <CheckboxField
              checked={item.deviceReadonly}
              onChange={(event) => setItem({ ...item, deviceReadonly: event.target.checked })}
              label={t('userDeviceReadonly')}
              helperText={t('userDeviceReadonlyHelp')}
            />
            <CheckboxField
              checked={item.limitCommands}
              onChange={(event) => setItem({ ...item, limitCommands: event.target.checked })}
              label={t('userLimitCommands')}
              helperText={t('userLimitCommandsHelp')}
            />
            <CheckboxField
              checked={item.disableReports}
              onChange={(event) => setItem({ ...item, disableReports: event.target.checked })}
              label={t('userDisableReports')}
              helperText={t('userDisableReportsHelp')}
            />
            <CheckboxField
              checked={item.fixedEmail}
              onChange={(e) => setItem({ ...item, fixedEmail: e.target.checked })}
              label={t('userFixedEmail')}
              helperText={t('userFixedEmailHelp')}
            />
          </FormSection>
          <FormSection title={t('serverFileSection')} description={t('serverFileHelp')}>
            <FileInput
              placeholder={t('sharedSelectFile')}
              value={null}
              onChange={handleFileChange}
            />
          </FormSection>
          <EditAttributesAccordion
            attributes={item.attributes}
            setAttributes={(attributes) => setItem({ ...item, attributes })}
            definitions={{
              ...commonUserAttributes,
              ...commonDeviceAttributes,
              ...serverAttributes,
            }}
          />
        </>
      )}
    </FormPage>
  );
};

export default ServerPage;
