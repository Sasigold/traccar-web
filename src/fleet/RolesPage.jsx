import { Fragment, useReducer, useState } from 'react';
import {
  Button,
  Checkbox,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import {
  EDITABLE_ROLES,
  PERMISSION_AREAS,
  areaLabelKey,
  effectiveGranted,
  permissionLabelKey,
  toggleChange,
} from '../common/fleet/permissionsCatalog';
import FleetNotice from './components/FleetNotice';

const useStyles = makeStyles()((theme) => ({
  area: {
    '& .MuiTableCell-root': {
      backgroundColor: theme.palette.surface.tint,
      fontWeight: 700,
    },
  },
  cell: {
    textAlign: 'center',
    width: 110,
  },
  changed: {
    fontWeight: 700,
  },
}));

const roleKey = (role) => `fleetRole${role.replace(/^\w/, (c) => c.toUpperCase())}`;
// Customers and billing belong to the platform admin area, not to an organization's roles.
const areas = PERMISSION_AREAS.filter((area) => area.area !== 'billing');

// Roadmap 4.3: what each role may do in this organization, on top of the defaults.
const RolesPage = () => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('users.read');
  const canManage = useFleetPermission('roles.manage');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [defaults, setDefaults] = useState(null);
  const [overrides, setOverrides] = useState([]);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead) {
      return;
    }
    const client = getFleetClient();
    const [defaultRows, overrideRows] = await Promise.all([
      client.from('role_permissions').select('role, permission'),
      client.from('org_role_permissions').select('role, permission, granted'),
    ]);
    setDefaults(unwrap(defaultRows) || []);
    setOverrides(unwrap(overrideRows) || []);
  }, [canRead, reloadKey]);

  const toggle = useCatch(async (role, permission, granted) => {
    const client = getFleetClient();
    const change = toggleChange(role, permission, granted, defaults);
    if (change.remove) {
      unwrap(
        await client
          .from('org_role_permissions')
          .delete()
          .eq('org_id', profile.org_id)
          .eq('role', role)
          .eq('permission', permission),
      );
    } else {
      unwrap(
        await client.from('org_role_permissions').upsert(
          {
            ...change.upsert,
            org_id: profile.org_id,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,role,permission' },
        ),
      );
    }
    reload();
  });

  const resetAll = useCatch(async () => {
    unwrap(
      await getFleetClient().from('org_role_permissions').delete().eq('org_id', profile.org_id),
    );
    reload();
  });

  const isOverridden = (role, permission) =>
    overrides.some((row) => row.role === role && row.permission === permission);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetRolesPage']}
      description={t('fleetRolesPageDescription')}
    >
      <FleetNotice permission="users.read" />
      <DataTable
        toolbar={
          <TableToolbar
            actions={
              canManage &&
              overrides.length > 0 && (
                <Button size="small" onClick={resetAll}>
                  {t('fleetRolesReset')}
                </Button>
              )
            }
          />
        }
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetPermissions')}</TableCell>
            {EDITABLE_ROLES.map((role) => (
              <TableCell key={role} className={classes.cell}>
                {t(roleKey(role))}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {defaults == null && canRead && <TableShimmer columns={EDITABLE_ROLES.length + 1} />}
          {defaults &&
            areas.map((area) => (
              <Fragment key={area.area}>
                <TableRow className={classes.area}>
                  <TableCell colSpan={EDITABLE_ROLES.length + 1}>
                    {t(areaLabelKey(area.area))}
                  </TableCell>
                </TableRow>
                {area.keys.map((permission) => (
                  <TableRow key={permission} hover>
                    <TableCell>{t(permissionLabelKey(permission))}</TableCell>
                    {EDITABLE_ROLES.map((role) => {
                      const granted = effectiveGranted(role, permission, defaults, overrides);
                      const locked = role === 'admin' && permission === 'roles.manage';
                      return (
                        <TableCell key={role} className={classes.cell}>
                          <Checkbox
                            size="small"
                            checked={granted}
                            disabled={!canManage || locked}
                            onChange={(event) => toggle(role, permission, event.target.checked)}
                            className={cx(isOverridden(role, permission) && classes.changed)}
                            slotProps={{
                              input: {
                                'aria-label': `${t(roleKey(role))}: ${t(permissionLabelKey(permission))}`,
                              },
                            }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
        </TableBody>
      </DataTable>
      {defaults && (
        <Typography variant="body2" color="textSecondary" sx={{ mx: 3, mb: 3 }}>
          {t('fleetRolesHint')}
        </Typography>
      )}
    </PageLayout>
  );
};

export default RolesPage;
