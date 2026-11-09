import { useReducer, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ApiRoundedIcon from '@mui/icons-material/ApiRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../reactHelper';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import { getFleetClient, unwrap } from '../common/fleet/client';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import StateChip from './components/StateChip';
import { useAdminAccess } from './useAdmin';

const useStyles = makeStyles()((theme) => ({
  number: {
    fontVariantNumeric: 'tabular-nums',
  },
  action: {
    width: '1%',
    whiteSpace: 'nowrap',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
}));

const MINUTE_MAX = 6000;
const DAY_MAX = 5000000;

const validLimit = (value, max) => Number.isInteger(Number(value)) && value >= 1 && value <= max;

// Service management → API (INT-01): the public API package of every organization: requests a
// minute and a day, active keys and use in the last 24 hours. Platform administrators only.
const ApiLimitsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const access = useAdminAccess();
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      if (!access.customersManage) {
        return;
      }
      setRows(unwrap(await getFleetClient().rpc('api_limits_overview').abortSignal(signal)) || []);
    },
    [access.customersManage, reloadKey],
  );

  const save = useCatch(async () => {
    unwrap(
      await getFleetClient()
        .from('api_limits')
        .upsert({
          org_id: editing.org_id,
          per_minute: Number(editing.per_minute),
          per_day: Number(editing.per_day),
          updated_at: new Date().toISOString(),
        }),
    );
    setEditing(null);
    reload();
  });

  const restore = useCatch(async () => {
    unwrap(await getFleetClient().from('api_limits').delete().eq('org_id', editing.org_id));
    setEditing(null);
    reload();
  });

  const number = (value) => Number(value).toLocaleString(language);
  const valid =
    editing && validLimit(editing.per_minute, MINUTE_MAX) && validLimit(editing.per_day, DAY_MAX);

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminApi']}
      description={t('adminApiDescription')}
    >
      <AdminGate need="customersManage" />
      {access.customersManage && (
        <DataTable
          toolbar={<TableToolbar count={rows?.length || 0} />}
          empty={rows?.length === 0}
          emptyState={{ icon: <ApiRoundedIcon />, title: t('adminApiNone') }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('adminApiOrganization')}</TableCell>
              <TableCell>{t('apiDocsPerMinute')}</TableCell>
              <TableCell>{t('apiDocsPerDay')}</TableCell>
              <TableCell>{t('adminApiPackage')}</TableCell>
              <TableCell>{t('adminApiKeys')}</TableCell>
              <TableCell>{t('apiDocsUsedToday')}</TableCell>
              <TableCell className={classes.action} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows ? (
              rows.map((row) => (
                <TableRow key={row.org_id} hover>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className={classes.number}>{number(row.per_minute)}</TableCell>
                  <TableCell className={classes.number}>{number(row.per_day)}</TableCell>
                  <TableCell>
                    <StateChip
                      state={row.custom ? 'active' : 'archived'}
                      label={t(row.custom ? 'adminApiCustom' : 'adminApiDefault')}
                    />
                  </TableCell>
                  <TableCell className={classes.number}>{number(row.active_keys)}</TableCell>
                  <TableCell className={classes.number}>{number(row.used_day)}</TableCell>
                  <TableCell className={classes.action} padding="none">
                    <Tooltip title={t('adminApiEdit')}>
                      <IconButton
                        size="small"
                        aria-label={`${t('adminApiEdit')}: ${row.name}`}
                        onClick={() => setEditing({ ...row })}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableShimmer columns={7} endAction />
            )}
          </TableBody>
        </DataTable>
      )}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{editing.name}</DialogTitle>
          <DialogContent className={classes.form}>
            <TextField
              type="number"
              label={t('apiDocsPerMinute')}
              value={editing.per_minute}
              onChange={(event) => setEditing({ ...editing, per_minute: event.target.value })}
              error={!validLimit(editing.per_minute, MINUTE_MAX)}
              slotProps={{ htmlInput: { min: 1, max: MINUTE_MAX, step: 1 } }}
            />
            <TextField
              type="number"
              label={t('apiDocsPerDay')}
              value={editing.per_day}
              onChange={(event) => setEditing({ ...editing, per_day: event.target.value })}
              error={!validLimit(editing.per_day, DAY_MAX)}
              slotProps={{ htmlInput: { min: 1, max: DAY_MAX, step: 1 } }}
            />
          </DialogContent>
          <DialogActions>
            {editing.custom && <Button onClick={restore}>{t('adminApiRestore')}</Button>}
            <Button onClick={() => setEditing(null)}>{t('sharedCancel')}</Button>
            <Button variant="contained" onClick={save} disabled={!valid}>
              {t('sharedSave')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageLayout>
  );
};

export default ApiLimitsPage;
