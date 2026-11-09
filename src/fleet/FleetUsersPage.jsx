import { useMemo, useReducer, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { fleetRoles } from '../common/fleet/config';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  PERMISSION_AREAS,
  areaLabelKey,
  permissionLabelKey,
  roleLabelKey,
} from '../common/fleet/permissionsCatalog';
import FleetNotice from './components/FleetNotice';
import { applyRole } from './users';
import { useConfirm } from '../common/components/confirm/ConfirmProvider';

const useStyles = makeStyles()((theme) => ({
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  overrides: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 140px',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  area: {
    gridColumn: '1 / -1',
    marginTop: theme.spacing(1),
    fontWeight: 700,
  },
}));

const areas = PERMISSION_AREAS.filter((area) => area.area !== 'billing');

// Per-user exceptions to the role: allow, deny, or follow the role.
const OverridesDialog = ({ user, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [rows, setRows] = useState(null);

  useAsyncTask(async () => {
    setRows(
      unwrap(
        await getFleetClient()
          .from('user_permissions')
          .select('permission, granted')
          .eq('user_id', user.id),
      ) || [],
    );
  }, [user.id]);

  const setValue = useCatch(async (permission, value) => {
    const client = getFleetClient();
    if (value === 'role') {
      unwrap(
        await client
          .from('user_permissions')
          .delete()
          .eq('user_id', user.id)
          .eq('permission', permission),
      );
    } else {
      unwrap(
        await client
          .from('user_permissions')
          .upsert(
            { user_id: user.id, permission, granted: value === 'allow' },
            { onConflict: 'user_id,permission' },
          ),
      );
    }
    setRows((current) => [
      ...current.filter((row) => row.permission !== permission),
      ...(value === 'role' ? [] : [{ permission, granted: value === 'allow' }]),
    ]);
  });

  const valueOf = (permission) => {
    const row = rows?.find((it) => it.permission === permission);
    if (!row) return 'role';
    return row.granted ? 'allow' : 'deny';
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('fleetUserOverridesTitle').replace('{0}', user.full_name || user.email || '')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {t('fleetUserOverridesHint')}
        </Typography>
        {rows && (
          <div className={classes.overrides}>
            {areas.map((area) => [
              <Typography key={area.area} variant="body2" className={classes.area}>
                {t(areaLabelKey(area.area))}
              </Typography>,
              ...area.keys.flatMap((permission) => [
                <Typography key={`${permission}-label`} variant="body2">
                  {t(permissionLabelKey(permission))}
                </Typography>,
                <TextField
                  key={permission}
                  select
                  size="small"
                  value={valueOf(permission)}
                  onChange={(event) => setValue(permission, event.target.value)}
                  slotProps={{ htmlInput: { 'aria-label': t(permissionLabelKey(permission)) } }}
                >
                  <MenuItem value="role">{t('fleetUserOverrideRole')}</MenuItem>
                  <MenuItem value="allow">{t('fleetUserOverrideAllow')}</MenuItem>
                  <MenuItem value="deny">{t('fleetUserOverrideDeny')}</MenuItem>
                </TextField>,
              ]),
            ])}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('adminClose')}</Button>
      </DialogActions>
    </Dialog>
  );
};

// Roadmap 4.3 "my users": role, active, last seen and per-user exceptions.
const FleetUsersPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const confirm = useConfirm();
  const me = useFleetProfile();
  const canRead = useFleetPermission('users.read');
  const canManage = useFleetPermission('users.manage');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [rows, setRows] = useState(null);
  const [activity, setActivity] = useState({});
  const [search, setSearch] = useState('');
  const [overridesFor, setOverridesFor] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
    setRows(unwrap(await client.from('profiles').select('*').order('full_name')) || []);
    const seen = await client.from('profile_activity').select('profile_id, last_seen_at');
    setActivity(
      Object.fromEntries((seen.data || []).map((row) => [row.profile_id, row.last_seen_at])),
    );
  }, [canRead, reloadKey]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (rows || []).filter(
      (row) =>
        !keyword ||
        [row.full_name, row.email, row.phone].some((value) =>
          value?.toLowerCase().includes(keyword),
        ),
    );
  }, [rows, search]);

  const changeRole = useCatch(async (row, role) => {
    await applyRole(row, role);
    reload();
  });

  const setActive = useCatch(async (row, active) => {
    if (
      !active &&
      !(await confirm({
        title: t('fleetUserDeactivateConfirm').replace('{0}', row.full_name || row.email || ''),
        message: t('fleetUserDeactivateConsequence'),
        confirmLabel: t('fleetUserDeactivate'),
      }))
    ) {
      return;
    }
    unwrap(await getFleetClient().from('profiles').update({ is_active: active }).eq('id', row.id));
    reload();
  });

  const editable = (row) =>
    canManage && row.id !== me?.id && (row.role !== 'owner' || me?.role === 'owner');
  const roleOptions = fleetRoles.filter((role) => role !== 'owner' || me?.role === 'owner');

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetUsersPage']}
      description={t('fleetUsersPageDescription')}
    >
      <FleetNotice permission="users.read" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={rows ? filtered.length : undefined}
            actions={
              <Button size="small" component={RouterLink} to="/fleet/roles">
                {t('fleetRolesPage')}
              </Button>
            }
          />
        }
        empty={rows != null && filtered.length === 0}
        emptyState={{ icon: <PeopleRoundedIcon />, title: t('tableNoMatches') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('userEmail')}</TableCell>
            <TableCell>{t('fleetRole')}</TableCell>
            <TableCell>{t('fleetUserLastSeen')}</TableCell>
            <TableCell>{t('fleetRecipientActive')}</TableCell>
            {canManage && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows == null && canRead && <TableShimmer columns={6} />}
          {filtered.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>
                {row.traccar_user_id ? (
                  <Link component={RouterLink} to={`/settings/user/${row.traccar_user_id}`}>
                    {row.full_name || row.email}
                  </Link>
                ) : (
                  row.full_name
                )}
              </TableCell>
              <TableCell>
                <span dir="ltr">{row.email}</span>
              </TableCell>
              <TableCell>
                {editable(row) ? (
                  <TextField
                    select
                    size="small"
                    value={row.role}
                    onChange={(event) => changeRole(row, event.target.value)}
                    slotProps={{ htmlInput: { 'aria-label': t('fleetRole') } }}
                  >
                    {roleOptions.map((role) => (
                      <MenuItem key={role} value={role}>
                        {t(roleLabelKey(role))}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  t(roleLabelKey(row.role))
                )}
              </TableCell>
              <TableCell className={classes.nowrap}>
                {activity[row.id] ? formatTime(activity[row.id], 'minutes') : '—'}
              </TableCell>
              <TableCell>
                <Switch
                  size="small"
                  checked={row.is_active}
                  disabled={!editable(row)}
                  onChange={(event) => setActive(row, event.target.checked)}
                  slotProps={{ input: { 'aria-label': t('fleetRecipientActive') } }}
                />
              </TableCell>
              {canManage && (
                <TableCell>
                  {editable(row) && row.role !== 'owner' && (
                    <Button size="small" onClick={() => setOverridesFor(row)}>
                      {t('fleetUserOverrides')}
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      {overridesFor && (
        <OverridesDialog user={overridesFor} onClose={() => setOverridesFor(null)} />
      )}
    </PageLayout>
  );
};

export default FleetUsersPage;
