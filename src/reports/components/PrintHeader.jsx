import { useState } from 'react';
import { useSelector } from 'react-redux';
import DocumentPrintHeader from '../../common/components/print/DocumentPrintHeader';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { formatTime } from '../../common/util/formatter';
import { vehicleTitle } from '../common/vehicle';

// Up to five vehicles by name, then "+N".
export const scopeText = (devices, deviceIds, groups, groupIds, t) => {
  const names = deviceIds.filter((id) => id !== 'all').map((id) => vehicleTitle(devices, id));
  const groupNames = groupIds.map((id) => groups[id]?.name).filter(Boolean);
  const all = [...groupNames, ...names];
  if (!all.length) return t('reportAllVehicles');
  return all.length > 5 ? `${all.slice(0, 5).join(', ')} +${all.length - 5}` : all.join(', ');
};

const PrintHeader = ({ title, from, to, deviceIds, groupIds }) => {
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items);
  const user = useSelector((state) => state.session.user);
  const [producedAt] = useState(() => new Date());
  if (!from || !to) return null;
  // REP-16: what this is, for when, for which vehicles, by whom (BRD-08: the shared document header).
  return (
    <DocumentPrintHeader
      kind="REPORT"
      title={title}
      lines={[
        <span key="period">
          {`${t('reportPeriod')}: `}
          <bdi dir="ltr">{`${formatTime(from, 'minutes')} – ${formatTime(to, 'minutes')}`}</bdi>
        </span>,
        `${t('deviceTitle')}: ${scopeText(devices, deviceIds, groups, groupIds, t)}`,
        <span key="printed">
          {t('reportPrintedBy')
            .replace('{0}', user?.name || '')
            .replace('{1}', '')}
          <bdi dir="ltr">{formatTime(producedAt, 'minutes')}</bdi>
        </span>,
      ]}
    />
  );
};

export default PrintHeader;
