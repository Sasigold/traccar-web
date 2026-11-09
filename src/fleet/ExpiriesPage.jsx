import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chip, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { formatTime } from '../common/util/formatter';
import exportExcel from '../common/util/exportExcel';
import ExpiryBadge, { statusLabelKey, useDaysText } from './components/ExpiryBadge';
import useExpiries from './useExpiries';
import GovRegistrySync from './components/GovRegistrySync';
import { useFleetLabel } from '../common/fleet/useFleet';

const useStyles = makeStyles()((theme) => ({
  name: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  plate: {
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  row: {
    cursor: 'pointer',
  },
  ltr: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
}));

const statusFilters = ['attention', 'expired', 'expiring', 'all'];
const statusFilterLabel = {
  attention: 'fleetFilterAttention',
  expired: 'fleetFilterExpired',
  expiring: 'fleetFilterExpiring',
  all: 'fleetFilterAll',
};
const entityFilters = ['vehicle', 'driver'];

// Roadmap stage 0: every validity date (test, insurance, lease, driving license), soonest first.
const ExpiriesPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const navigate = useNavigate();
  const daysText = useDaysText();
  const { rows } = useExpiries();
  const fleetLabel = useFleetLabel();
  const rowLabel = (row) => (row.labelKey ? t(row.labelKey) : fleetLabel(row.labels));

  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFilters.includes(searchParams.get('status'))
    ? searchParams.get('status')
    : 'attention';
  const entity = entityFilters.includes(searchParams.get('entity'))
    ? searchParams.get('entity')
    : null;
  const [search, setSearch] = useState('');

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === 'attention' && row.status !== 'expired' && row.status !== 'expiring') {
        return false;
      }
      if ((status === 'expired' || status === 'expiring') && row.status !== status) {
        return false;
      }
      if (entity && row.entity !== entity) {
        return false;
      }
      return (
        !keyword ||
        [row.name, row.plateNumber, row.labelKey ? t(row.labelKey) : fleetLabel(row.labels)].some(
          (value) => value?.toLowerCase().includes(keyword),
        )
      );
    });
  }, [rows, status, entity, search, t, fleetLabel]);

  const entityText = (row) =>
    row.entity === 'vehicle' ? t('fleetEntityVehicle') : t('fleetEntityDriver');

  const open = (row) =>
    navigate(
      row.entity === 'vehicle'
        ? `/settings/device/${row.entityId}`
        : `/settings/driver/${row.entityId}`,
    );

  const handleExport = async () => {
    const data = filtered.map((row) => ({
      [t('fleetEntity')]: entityText(row),
      [t('sharedName')]: row.name,
      [t('fleetPlateNumber')]: row.plateNumber || '',
      [t('fleetValidityType')]: rowLabel(row),
      [t('fleetExpiresAt')]: formatTime(row.date, 'date'),
      [t('deviceStatus')]: t(statusLabelKey[row.status]),
      [t('fleetDaysColumn')]: row.days,
    }));
    const sheets = new Map();
    sheets.set(t('fleetExpiriesPage'), data);
    await exportExcel(t('fleetExpiriesPage'), 'expiries.xlsx', sheets, theme);
  };

  const chip = (key, active, label, onClick) => (
    <Chip
      key={key}
      size="small"
      label={label}
      color={active ? 'primary' : 'default'}
      variant={active ? 'filled' : 'outlined'}
      onClick={onClick}
    />
  );

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetExpiriesPage']}
      description={t('fleetExpiriesPageDescription')}
    >
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={filtered.length}
            exportHandler={handleExport}
            actions={<GovRegistrySync />}
            filters={[
              ...statusFilters.map((key) =>
                chip(key, status === key, t(statusFilterLabel[key]), () =>
                  setParam('status', key === 'attention' ? null : key),
                ),
              ),
              ...entityFilters.map((key) =>
                chip(
                  `entity-${key}`,
                  entity === key,
                  t(key === 'vehicle' ? 'fleetEntityVehicles' : 'sharedDrivers'),
                  () => setParam('entity', entity === key ? null : key),
                ),
              ),
            ]}
          />
        }
        empty={filtered.length === 0}
        emptyState={{
          icon: <EventAvailableRoundedIcon />,
          title: t(
            search
              ? 'tableNoMatches'
              : rows.length
                ? 'fleetExpiriesAllClear'
                : 'fleetExpiriesEmpty',
          ),
          description: search
            ? undefined
            : t(rows.length ? 'fleetExpiriesAllClearDescription' : 'fleetExpiriesEmptyDescription'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetEntity')}</TableCell>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('fleetValidityType')}</TableCell>
            <TableCell>{t('fleetExpiresAt')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((row) => (
            <TableRow
              key={row.id}
              hover
              className={classes.row}
              onClick={() => open(row)}
              tabIndex={0}
              onKeyDown={(event) => event.key === 'Enter' && open(row)}
            >
              <TableCell>{entityText(row)}</TableCell>
              <TableCell>
                <span className={classes.name}>
                  <span>{row.name}</span>
                  {row.plateNumber && (
                    <span className={classes.plate} dir="ltr">
                      {row.plateNumber}
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell>{rowLabel(row)}</TableCell>
              <TableCell className={classes.ltr}>
                {formatTime(row.date, 'date')}
                {row.status !== 'valid' && ` · ${daysText(row.days)}`}
              </TableCell>
              <TableCell>
                <ExpiryBadge date={row.date} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default ExpiriesPage;
