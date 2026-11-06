import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, Chip, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import exportExcel from '../common/util/exportExcel';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission } from '../common/fleet/useFleet';
import FleetNotice from './components/FleetNotice';
import { money } from './fleetData';

const useStyles = makeStyles()(() => ({
  row: {
    cursor: 'pointer',
  },
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
}));

const camel = (value) => value.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
export const incidentKey = (group, value) => `fleetIncident${group}${camel(value)}`;

const statusColor = {
  reported: 'error',
  under_review: 'warning',
  in_repair: 'info',
  claim: 'info',
  closed: 'success',
};

export const IncidentStatusChip = ({ status }) => {
  const t = useTranslation();
  return <Chip size="small" color={statusColor[status]} label={t(incidentKey('Status', status))} />;
};

const filters = ['open', 'closed', 'all'];

// Roadmap stage 2: damage and accident reports, newest first.
const IncidentsPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const navigate = useNavigate();
  const canRead = useFleetPermission('incidents.read');
  const canWrite = useFleetPermission('incidents.write');

  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);

  useAsyncTask(async () => {
    if (!canRead) {
      return;
    }
    setRows(
      unwrap(
        await getFleetClient()
          .from('incidents')
          .select('*, vehicles(plate_number), drivers(full_name)')
          .order('occurred_at', { ascending: false })
          .limit(500),
      ) || [],
    );
  }, [canRead]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (rows || []).filter((row) => {
      if (filter === 'open' && row.status === 'closed') {
        return false;
      }
      if (filter === 'closed' && row.status !== 'closed') {
        return false;
      }
      return (
        !keyword ||
        [
          row.vehicles?.plate_number,
          row.drivers?.full_name,
          row.address,
          row.description,
          String(row.number),
        ].some((value) => value?.toLowerCase().includes(keyword))
      );
    });
  }, [rows, filter, search]);

  const handleExport = async () => {
    const data = filtered.map((row) => ({
      [t('fleetWorkOrderNumber')]: row.number,
      [t('fleetIncidentOccurred')]: formatTime(row.occurred_at, 'minutes'),
      [t('fleetEntityVehicle')]: row.vehicles?.plate_number,
      [t('sharedDriver')]: row.drivers?.full_name,
      [t('sharedType')]: t(incidentKey('Type', row.type)),
      [t('fleetIncidentFault')]: t(incidentKey('Fault', row.fault)),
      [t('positionAddress')]: row.address,
      [t('deviceStatus')]: t(incidentKey('Status', row.status)),
      [t('fleetIncidentRepairCost')]: row.repair_cost == null ? '' : Number(row.repair_cost),
    }));
    const sheets = new Map();
    sheets.set(t('fleetIncidentsPage'), data);
    await exportExcel(t('fleetIncidentsPage'), 'incidents.xlsx', sheets, theme);
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetIncidentsPage']}
      description={t('fleetIncidentsPageDescription')}
    >
      <FleetNotice permission="incidents.read" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={rows ? filtered.length : undefined}
            exportHandler={handleExport}
            filters={filters.map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(`fleetIncidentFilter${camel(key)}`)}
                color={filter === key ? 'primary' : 'default'}
                variant={filter === key ? 'filled' : 'outlined'}
                onClick={() => setFilter(key)}
              />
            ))}
            actions={
              canWrite && (
                <Button
                  variant="contained"
                  size="small"
                  component={RouterLink}
                  to="/fleet/incident"
                >
                  {t('fleetIncidentAdd')}
                </Button>
              )
            }
          />
        }
        empty={rows != null && filtered.length === 0}
        emptyState={{
          icon: <CarCrashRoundedIcon />,
          title: t(search ? 'tableNoMatches' : 'fleetIncidentsNone'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetWorkOrderNumber')}</TableCell>
            <TableCell>{t('fleetIncidentOccurred')}</TableCell>
            <TableCell>{t('fleetEntityVehicle')}</TableCell>
            <TableCell>{t('sharedDriver')}</TableCell>
            <TableCell>{t('sharedType')}</TableCell>
            <TableCell>{t('fleetIncidentFault')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell>{t('fleetIncidentRepairCost')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows == null && canRead && <TableShimmer columns={8} />}
          {filtered.map((row) => (
            <TableRow
              key={row.id}
              hover
              tabIndex={0}
              className={classes.row}
              onClick={() => navigate(`/fleet/incident/${row.id}`)}
              onKeyDown={(event) => event.key === 'Enter' && navigate(`/fleet/incident/${row.id}`)}
            >
              <TableCell className={classes.nowrap}>{row.number}</TableCell>
              <TableCell className={classes.nowrap}>
                {formatTime(row.occurred_at, 'minutes')}
              </TableCell>
              <TableCell>
                <span dir="ltr">{row.vehicles?.plate_number}</span>
              </TableCell>
              <TableCell>{row.drivers?.full_name}</TableCell>
              <TableCell>
                {t(incidentKey('Type', row.type))}
                {row.injuries && ` · ${t('fleetIncidentInjuries')}`}
              </TableCell>
              <TableCell>{t(incidentKey('Fault', row.fault))}</TableCell>
              <TableCell>
                <IncidentStatusChip status={row.status} />
              </TableCell>
              <TableCell className={classes.nowrap}>{money(row.repair_cost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default IncidentsPage;
