import { lazy, Suspense, useState } from 'react';
import { Button } from '@mui/material';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';

// The picker carries MapLibre: it loads only when it is opened.
const MapPointDialog = lazy(() => import('./MapPointDialog'));

const toNumber = (value) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// ADM-20: "pick on the map" beside a pair of latitude and longitude fields.
const PickOnMapButton = ({ latitude, longitude, onPick, className }) => {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<MapRoundedIcon />}
        onClick={() => setOpen(true)}
      >
        {t('mapPickButton')}
      </Button>
      {open && (
        <Suspense fallback={null}>
          <MapPointDialog
            latitude={toNumber(latitude)}
            longitude={toNumber(longitude)}
            onClose={() => setOpen(false)}
            onPick={(point) => {
              setOpen(false);
              onPick(point);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default PickOnMapButton;
