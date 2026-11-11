import { useReducer, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
  IconButton,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission } from '../common/fleet/useFleet';
import FleetNotice from './components/FleetNotice';
import MissedChecks from './components/MissedChecks';
import InspectionTemplateDialog, { frequencyKey } from './components/InspectionTemplateDialog';
import { readAllRows } from '../common/data/fleetQuery';
import { pascalCase } from '../common/util/stringUtils';

const useStyles = makeStyles()(() => ({
  row: {
    cursor: 'pointer',
  },
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  action: {
    width: '1%',
    whiteSpace: 'nowrap',
  },
}));

const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix'];
const severityColor = { low: 'default', medium: 'warning', high: 'error', critical: 'error' };

// Filled inspections, checklist templates and the open issues they raise.
const InspectionsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const canRead = useFleetPermission('inspections.read');
  const canFill = useFleetPermission('inspections.write');
  const canManage = useFleetPermission('inspections.manage');
  const canIssues = useFleetPermission('maintenance.read');
  const canFixIssues = useFleetPermission('maintenance.write');

  const views = ['inspections', 'templates', ...(canIssues ? ['issues'] : [])];
  const [view, setView] = useState('inspections');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    setRows(null);
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
    if (view === 'inspections') {
      // ARC-08: every page, not the first 500.
      setRows(
        await readAllRows('inspections', () =>
          client
            .from('inspections')
            .select('*, vehicles(plate_number), drivers(full_name)')
            .order('started_at', { ascending: false }),
        ),
      );
    } else if (view === 'templates') {
      setRows(
        unwrap(
          await client
            .from('inspection_templates')
            .select('*, inspection_template_items(*)')
            .order('name')
            .order('sort_order', { referencedTable: 'inspection_template_items' }),
        ) || [],
      );
    } else {
      setRows(
        unwrap(
          await client
            .from('issues')
            .select('*, vehicles(plate_number, traccar_device_id)')
            .in('status', ['open', 'in_progress'])
            .order('created_at', { ascending: false }),
        ) || [],
      );
    }
  }, [view, canRead, reloadKey]);

  const setIssueStatus = useCatch(async (issue, status) => {
    unwrap(
      await getFleetClient()
        .from('issues')
        .update({
          status,
          resolved_at:
            status === 'resolved' || status === 'wont_fix' ? new Date().toISOString() : null,
        })
        .eq('id', issue.id),
    );
    reload();
  });

  const viewChips = views.map((key) => (
    <Chip
      key={key}
      size="small"
      label={t(`fleetInspectionsView${pascalCase(key)}`)}
      color={view === key ? 'primary' : 'default'}
      variant={view === key ? 'filled' : 'outlined'}
      onClick={() => setView(key)}
    />
  ));

  const actions =
    view === 'templates'
      ? canManage && (
          <Button variant="contained" size="small" onClick={() => setEditing({})}>
            {t('fleetInspectionTemplateAdd')}
          </Button>
        )
      : view === 'inspections' &&
        canFill && (
          <Button variant="contained" size="small" component={RouterLink} to="/fleet/inspection">
            {t('fleetInspectionAdd')}
          </Button>
        );

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetInspectionsPage']}
      description={t('fleetInspectionsPageDescription')}
    >
      <FleetNotice permission="inspections.read" />
      {canRead && view === 'inspections' && <MissedChecks />}
      <DataTable
        toolbar={
          <TableToolbar
            count={rows ? rows.length : undefined}
            filters={viewChips}
            actions={actions}
          />
        }
        empty={rows != null && rows.length === 0}
        emptyState={{
          icon: <FactCheckRoundedIcon />,
          title: t(`fleetInspectionsNone${pascalCase(view)}`),
        }}
      >
        {view === 'inspections' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetExpenseDate')}</TableCell>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('sharedDriver')}</TableCell>
                <TableCell>{t('fleetInspectionTemplate')}</TableCell>
                <TableCell>{t('fleetInspectionResult')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={5} />}
              {rows?.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  tabIndex={0}
                  className={classes.row}
                  onClick={() => navigate(`/fleet/inspection/${row.id}`)}
                  onKeyDown={(event) =>
                    event.key === 'Enter' && navigate(`/fleet/inspection/${row.id}`)
                  }
                >
                  <TableCell className={classes.nowrap}>
                    {formatTime(row.started_at, 'minutes')}
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{row.vehicles?.plate_number}</span>
                  </TableCell>
                  <TableCell>{row.drivers?.full_name}</TableCell>
                  <TableCell>{row.template_name}</TableCell>
                  <TableCell>
                    {row.result && (
                      <Chip
                        size="small"
                        color={row.result === 'pass' ? 'success' : 'error'}
                        label={t(
                          row.result === 'pass' ? 'fleetInspectionPass' : 'fleetInspectionFail',
                        )}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'templates' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedName')}</TableCell>
                <TableCell>{t('fleetInspectionFrequency')}</TableCell>
                <TableCell>{t('fleetInspectionItems')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                {canManage && <TableCell className={classes.action} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && canRead && <TableShimmer columns={4} />}
              {rows?.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{t(frequencyKey(row.frequency))}</TableCell>
                  <TableCell>{row.inspection_template_items?.length || 0}</TableCell>
                  <TableCell>
                    {t(row.active ? 'fleetRecipientActive' : 'fleetRecipientPaused')}
                  </TableCell>
                  {canManage && (
                    <TableCell className={classes.action}>
                      <Tooltip title={t('sharedEdit')}>
                        <IconButton
                          size="small"
                          aria-label={t('sharedEdit')}
                          onClick={() => setEditing(row)}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
        {view === 'issues' && (
          <>
            <TableHead>
              <TableRow>
                <TableCell>{t('fleetExpenseDate')}</TableCell>
                <TableCell>{t('fleetEntityVehicle')}</TableCell>
                <TableCell>{t('fleetIssueTitle')}</TableCell>
                <TableCell>{t('fleetIncidentSeverity')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
                {canFixIssues && <TableCell className={classes.action} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows == null && <TableShimmer columns={6} />}
              {rows?.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell className={classes.nowrap}>
                    {formatTime(row.created_at, 'date')}
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{row.vehicles?.plate_number}</span>
                  </TableCell>
                  <TableCell>
                    {row.title}
                    {row.description && ` · ${row.description}`}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={severityColor[row.severity]}
                      label={t(`fleetIssueSeverity${pascalCase(row.severity)}`)}
                    />
                  </TableCell>
                  <TableCell>
                    {canFixIssues ? (
                      <TextField
                        select
                        size="small"
                        value={row.status}
                        onChange={(event) => setIssueStatus(row, event.target.value)}
                        slotProps={{ htmlInput: { 'aria-label': t('deviceStatus') } }}
                      >
                        {ISSUE_STATUSES.map((status) => (
                          <MenuItem key={status} value={status}>
                            {t(`fleetIssueStatus${pascalCase(status)}`)}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      t(`fleetIssueStatus${pascalCase(row.status)}`)
                    )}
                  </TableCell>
                  {canFixIssues && (
                    <TableCell className={classes.action}>
                      <Button
                        size="small"
                        component={RouterLink}
                        to={`/fleet/work-order?issue=${row.id}`}
                      >
                        {t('fleetWorkOrderAdd')}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </DataTable>
      {editing && (
        <InspectionTemplateDialog
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default InspectionsPage;
