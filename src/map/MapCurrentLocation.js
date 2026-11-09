import * as maplibregl from 'maplibre-gl';
import { useEffect } from 'react';
import { map } from './core/MapView';
import { useTheme } from '@mui/material';

const MapCurrentLocation = () => {
  const theme = useTheme();

  useEffect(() => {
    const control = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 5000,
      },
      trackUserLocation: false,
    });
    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    // MapLibre names the button only after its async geolocation check; name it right away.
    const button = control._container?.querySelector('button');
    if (button && !button.getAttribute('aria-label')) {
      const label = map._getUIString('GeolocateControl.FindMyLocation');
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    return () => map.removeControl(control);
  }, [theme.direction]);

  return null;
};

export default MapCurrentLocation;
