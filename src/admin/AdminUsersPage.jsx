import { useMemo, useState } from 'react';
import ImpersonateDialog from '../common/components/ImpersonateDialog';
import { useNavigate } from 'react-router-dom';
import {
  Chip,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import CustomerSelect from './components/CustomerSelect';
import AssignCustomerDialog from './components/AssignCustomerDialog';
import { useAdminAccess, useAdminDirectory, useTraccarList } from './useAdmin';
import { assignUser, updateTraccarUser } from './adminApi';
import { NO_CUSTOMER } from './AdminDevicesPage';

const useStyles = makeStyles()((theme) => ({
  name: {
    fontWeight: 600,
  },
  sub: {
    display: 'block',
    color: theme.palette.text.secondary,
  },
  muted: {
    color: theme.palette.text.secondary,
  },
  customerFilter: {
    width: 220,
  },
  chips: {
    display: 'flex',
    gap: theme.spacing(0.5),
    flexWrap: 'wrap',
  },
  actions: {
    whiteSpace: 'nowrap',
  },
}));

const roleOf = (user) => {
  if (user.administrator) return 'admin';
  if ((user.userLimit || 0) !== 0) return 'manager';
  return 'user';
};

const AdminUsersPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const access = useAdminAccess();
  const directory = useAdminDirectory();
  const currentUserId = useSelector((state) => state.session.user.id);
  const [users, reloadUsers] = useTraccarList('api/users');

  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState(null);
  const [assigning, setAssigning] = useState(null);

  const rows = useMemo(() => {
    if (!users) return null;
    const needle = search.trim().toLowerCase();
    return users
      .filter((user) => !user.temporary)
      .filter((user) => {
        const owner = directory.userCustomer.get(user.id)?.customer_id ?? null;
        if (customerFilter === NO_CUSTOMER && owner) return false;
        if (customerFilter && customerFilter !== NO_CUSTOMER && owner !== customerFilter)
          return false;
        if (!needle) return true;
        return [user.name, user.email, user.phone]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, search, customerFilter, directory.userCustomer]);

  // SEC-13: "log in as" asks for a reason and records it.
  const [impersonating, setImpersonating] = useState(null);
  const handleLogin = (userId) =>
    setImpersonating(
      users.find((item) => item.id === userId) || { id: userId, name: String(userId) },
    );

  const handleToggleDisabled = useCatch(async (user) => {
    const full = await (await fetchOrThrow(`api/users/${user.id}`)).json();
    await updateTraccarUser({ ...full, disabled: !full.disabled });
    reloadUsers();
  });

  const handleAssign = useCatch(async (customerId) => {
    await assignUser(assigning.id, customerId);
    setAssigning(null);
    directory.reload();
  });

  const customerOptions = [{ id: NO_CUSTOMER, name: t('adminNoCustomer') }, ...directory.customers];

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminUsers']}
      description={t('adminUsersDescription')}
    >
      <AdminGate need="customersRead" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={rows?.length}
            addPath="/settings/user"
            filters={
              access.customersRead && (
                <div className={classes.customerFilter}>
                  <CustomerSelect
                    size="small"
                    customers={customerOptions}
                    value={customerFilter}
                    onChange={setCustomerFilter}
                  />
                </div>
              )
            }
          />
        }
        empty={rows?.length === 0}
        emptyState={{
          icon: <PeopleRoundedIcon />,
          title: t(search ? 'tableNoMatches' : 'tableEmptyTitle'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('adminCustomer')}</TableCell>
            <TableCell>{t('adminRole')}</TableCell>
            <TableCell>{t('userExpirationTime')}</TableCell>
            <TableCell padding="none" />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows ? (
            rows.map((user) => {
              const link = directory.userCustomer.get(user.id);
              const customer = link ? directory.customerById.get(link.customer_id) : null;
              const role = roleOf(user);
              return (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <span className={classes.name}>{user.name}</span>
                    <Typography
                      variant="caption"
                      className={classes.sub}
                      dir="ltr"
                      style={{ textAlign: 'start' }}
                    >
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {customer ? (
                      <span>
                        {customer.name}
                        {link.is_primary && (
                          <Typography variant="caption" className={classes.sub}>
                            {t('adminPrimaryUser')}
                          </Typography>
                        )}
                      </span>
                    ) : (
                      <span className={classes.muted}>{t('adminNoCustomer')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className={classes.chips}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={role === 'user' ? 'default' : 'primary'}
                        label={t(
                          role === 'admin'
                            ? 'userAdmin'
                            : role === 'manager'
                              ? 'adminRoleManager'
                              : 'adminRoleUser',
                        )}
                      />
                      {user.disabled && (
                        <Chip
                          size="small"
                          color="error"
                          variant="outlined"
                          label={t('sharedDisabled')}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span dir="ltr">{formatTime(user.expirationTime, 'date')}</span>
                  </TableCell>
                  <TableCell padding="none" className={classes.actions}>
                    {access.customersManage && (
                      <Tooltip title={t('adminAssignCustomer')}>
                        <IconButton
                          size="small"
                          aria-label={t('adminAssignCustomer')}
                          onClick={() => setAssigning(user)}
                        >
                          <StoreRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {user.id !== currentUserId && (
                      <>
                        <Tooltip title={t('loginLogin')}>
                          <IconButton
                            size="small"
                            aria-label={t('loginLogin')}
                            onClick={() => handleLogin(user.id)}
                          >
                            <LoginRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t(user.disabled ? 'adminEnableUser' : 'adminDisableUser')}>
                          <IconButton
                            size="small"
                            aria-label={t(user.disabled ? 'adminEnableUser' : 'adminDisableUser')}
                            onClick={() => handleToggleDisabled(user)}
                          >
                            {user.disabled ? (
                              <CheckCircleOutlineRoundedIcon fontSize="small" />
                            ) : (
                              <BlockRoundedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip title={t('sharedEdit')}>
                      <IconButton
                        size="small"
                        aria-label={t('sharedEdit')}
                        onClick={() => navigate(`/settings/user/${user.id}`)}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableShimmer columns={5} endAction />
          )}
        </TableBody>
      </DataTable>
      {assigning && (
        <AssignCustomerDialog
          open
          title={`${t('adminAssignCustomer')} · ${assigning.name}`}
          description={t('adminLinkUserHelp')}
          customers={directory.customers}
          initial={directory.userCustomer.get(assigning.id)?.customer_id ?? null}
          onClose={() => setAssigning(null)}
          onAssign={handleAssign}
        />
      )}
      {impersonating && (
        <ImpersonateDialog user={impersonating} onClose={() => setImpersonating(null)} />
      )}
    </PageLayout>
  );
};

export default AdminUsersPage;
