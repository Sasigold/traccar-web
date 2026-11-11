import { useMemo } from 'react';

export default (t) =>
  useMemo(
    () => ({
      'command.sender': {
        name: t('deviceCommandSender'),
        type: 'string',
      },
      'web.reportColor': {
        name: t('attributeWebReportColor'),
        type: 'string',
        dataType: 'color',
      },
      devicePassword: {
        name: t('attributeDevicePassword'),
        type: 'string',
      },
      fuelCapacity: {
        name: t('attributeFuelCapacity'),
        type: 'number',
      },
      // OPS-09: an electric vehicle's battery, consumption and electricity price.
      evCapacityKwh: {
        name: t('attributeEvCapacityKwh'),
        type: 'number',
      },
      evKwhPer100Km: {
        name: t('attributeEvKwhPer100Km'),
        type: 'number',
      },
      evPricePerKwh: {
        name: t('attributeEvPricePerKwh'),
        type: 'number',
      },
      deviceImage: {
        name: t('attributeDeviceImage'),
        type: 'string',
      },
      'processing.copyAttributes': {
        name: t('attributeProcessingCopyAttributes'),
        type: 'string',
      },
      'decoder.timezone': {
        name: t('sharedTimezone'),
        type: 'string',
      },
      'forward.url': {
        name: t('attributeForwardUrl'),
        type: 'string',
      },
    }),
    [t],
  );
