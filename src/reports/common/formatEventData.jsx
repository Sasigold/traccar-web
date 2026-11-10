import { Link } from '@mui/material';
import { formatNumber, formatSpeed } from '../../common/util/formatter';
import { prefixString } from '../../common/util/stringUtils';
import { overspeedBand, overspeedText } from './reportRules';

const formatEventData = (event, { deviceUniqueId, speedUnit, t }) => {
  switch (event.type) {
    case 'alarm':
      return t(prefixString('alarm', event.attributes.alarm));
    case 'deviceOverspeed': {
      // REP-14: the speed with the limit it crossed.
      const text = overspeedText(
        event.attributes,
        (value) => formatSpeed(value, speedUnit, t),
        t('reportSpeedLimitOf'),
      );
      // SAF-06: how far over the road's limit.
      const band = overspeedBand(event.attributes);
      return band ? `${text} · ${t(`speedBand${band[0].toUpperCase()}${band.slice(1)}`)}` : text;
    }
    case 'driverChanged':
      return event.attributes.driverUniqueId;
    case 'deviceFuelDrop':
    case 'deviceFuelIncrease':
      return formatNumber(Math.abs(event.attributes.after - event.attributes.before));
    case 'media':
      return (
        <Link href={`api/media/${deviceUniqueId}/${event.attributes.file}`} target="_blank">
          {event.attributes.file}
        </Link>
      );
    case 'commandResult':
      return event.attributes.result;
    default:
      return '';
  }
};

export default formatEventData;
