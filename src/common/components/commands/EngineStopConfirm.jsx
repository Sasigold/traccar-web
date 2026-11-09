import { useId } from 'react';
import { useSelector } from 'react-redux';
import { Alert, TextField, Typography } from '@mui/material';
import { useTranslation } from '../LocalizationProvider';
import { useAttributePreference } from '../../util/preferences';
import { formatSpeed } from '../../util/formatter';
import { confirmationTarget } from '../../util/commands';
import useActivityText from '../useActivityText';

// Warning and typed confirmation for engine stop: the plate number (or the name of a vehicle
// without one), plus a stronger warning while the vehicle is moving.
const EngineStopConfirm = ({ deviceId, value, onChange }) => {
  const t = useTranslation();
  const speedUnit = useAttributePreference('speedUnit');
  const device = useSelector((state) => state.devices.items[deviceId]);
  const position = useSelector((state) => state.session.positions[deviceId]);
  const { activity } = useActivityText(device, position);
  const target = confirmationTarget(device);
  const labelId = useId();
  const [before, after = ''] = t(
    target.kind === 'plate' ? 'commandConfirmPlate' : 'commandConfirmName',
  ).split('{0}');

  return (
    <>
      {activity === 'moving' && position && (
        <Alert severity="error">
          {t('commandMovingWarning').replace('{0}', formatSpeed(position.speed, speedUnit, t))}
        </Alert>
      )}
      <Alert severity="warning">{t('commandEngineStopWarning')}</Alert>
      <Typography variant="body2" id={labelId}>
        {before}
        <bdi dir={target.kind === 'plate' ? 'ltr' : 'auto'}>
          <strong>{target.value}</strong>
        </bdi>
        {after}
      </Typography>
      <TextField
        autoFocus
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={target.value}
        slotProps={{
          htmlInput: {
            'aria-labelledby': labelId,
            dir: target.kind === 'plate' ? 'ltr' : 'auto',
          },
        }}
      />
    </>
  );
};

export default EngineStopConfirm;
