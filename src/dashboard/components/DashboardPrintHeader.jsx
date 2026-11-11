import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../common/components/LocalizationProvider';
import DocumentPrintHeader from '../../common/components/print/DocumentPrintHeader';
import { formatTime } from '../../common/util/formatter';
import { useDashboardData } from '../data/DashboardDataContext';
import { periodLabel } from './periodLabel';

// REP-16: the dashboard on paper: its name, the period with its dates, the groups and driver it
// is filtered to, and who printed it when (BRD-08's shared document header).
const DashboardPrintHeader = ({ title }) => {
  const t = useTranslation();
  const { filters, range } = useDashboardData();
  const groups = useSelector((state) => state.groups.items);
  const user = useSelector((state) => state.session.user);
  const [printedAt] = useState(() => new Date());
  const groupNames = filters.groupIds.map((id) => groups[id]?.name).filter(Boolean);
  return (
    <DocumentPrintHeader
      kind="DASHBOARD"
      title={title}
      lines={[
        <span key="period">
          {`${t('reportPeriod')}: ${periodLabel(filters, range, t)} · `}
          <bdi dir="ltr">{`${formatTime(range.from, 'date')} – ${formatTime(range.to, 'date')}`}</bdi>
        </span>,
        `${t('deviceTitle')}: ${groupNames.length ? groupNames.join(', ') : t('dashboardAllVehicles')}`,
        <span key="printed">
          {t('reportPrintedBy')
            .replace('{0}', user?.name || '')
            .replace('{1}', '')}
          <bdi dir="ltr">{formatTime(printedAt, 'minutes')}</bdi>
        </span>,
      ]}
    />
  );
};

export default DashboardPrintHeader;
