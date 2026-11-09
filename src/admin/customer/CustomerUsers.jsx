import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Button,
  Chip,
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
  Typography,
} from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { makeStyles } from 'tss-react/mui';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { messagesActions } from '../../store';
import FormSection from '../../settings/components/FormSection';
import EmptyState from '../../common/components/table/EmptyState';
import PasswordField from '../../common/components/PasswordField';
import { assignUser, createTraccarUser, syncCustomerAccess } from '../adminApi';

const useStyles = makeStyles()((theme) => ({
  name: {
    fontWeight: 600,
  },
  sub: {
    display: 'block',
    color: theme.palette.text.secondary,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
  scroll: {
    overflowX: 'auto',
  },
}));

const CustomerUsers = ({ customer, users, directory, editable, onUsersChanged }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [dialog, setDialog] = useState(null);
  const [picked, setPicked] = useState(null);
  const [draft, setDraft] = useState({ name: '', email: '', password: '' });

  const userById = useMemo(() => new Map((users || []).map((user) => [user.id, user])), [users]);
  const rows = directory.customerUsers
    .filter((row) => row.customer_id === customer.id)
    .map((row) => ({ row, user: userById.get(row.traccar_user_id) }))
    .filter((item) => item.user);
  const candidates = (users || []).filter(
    (user) => directory.userCustomer.get(user.id)?.customer_id !== customer.id,
  );

  const close = () => {
    setDialog(null);
    setPicked(null);
    setDraft({ name: '', email: '', password: '' });
  };

  const handleLink = useCatch(async () => {
    await assignUser(picked.id, customer.id, { primary: rows.length === 0 });
    close();
    directory.reload();
  });

  const handleCreate = useCatch(async () => {
    const user = await createTraccarUser({
      name: draft.name.trim(),
      email: draft.email.trim(),
      password: draft.password,
      attributes: {},
    });
    await assignUser(user.id, customer.id, { primary: rows.length === 0 });
    close();
    onUsersChanged();
    directory.reload();
  });

  const handleUnlink = useCatch(async (userId) => {
    await assignUser(userId, null);
    directory.reload();
  });

  const handleSync = useCatch(async () => {
    const result = await syncCustomerAccess(customer.id);
    dispatch(
      messagesActions.push({
        message: t('adminSyncDone')
          .replace('{0}', result.users)
          .replace('{1}', result.devices)
          .replace('{2}', result.added)
          .replace('{3}', result.removed),
        severity: 'success',
      }),
    );
    if (result.unknown.length) {
      dispatch(
        messagesActions.push({
          message: t('adminSyncUnknown')
            .replace('{0}', result.unknown.length)
            .replace('{1}', result.unknown.join(', ')),
          severity: 'warning',
        }),
      );
    }
  });

  const handleLogin = useCatch(async (userId) => {
    await fetchOrThrow(`api/session/${userId}`);
    window.location.replace(document.baseURI);
  });

  return (
    <FormSection
      icon={<PeopleRoundedIcon />}
      title={t('adminCustomerUsers').replace('{0}', rows.length)}
      description={t('adminCustomerUsersHelp')}
      actions={
        editable && (
          <div className={classes.actions}>
            <Button
              variant="outlined"
              startIcon={<AddLinkRoundedIcon />}
              onClick={() => setDialog('link')}
            >
              {t('adminLinkUser')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<PersonAddRoundedIcon />}
              onClick={() => setDialog('create')}
            >
              {t('adminCreateUser')}
            </Button>
          </div>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact icon={<PeopleRoundedIcon />} title={t('adminNoUsersForCustomer')} />
      ) : (
        <div className={classes.scroll}>
          <ResponsiveTable size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedName')}</TableCell>
                <TableCell>{t('adminRole')}</TableCell>
                <TableCell padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ row, user }) => (
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
                    {row.is_primary && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={t('adminPrimaryUser')}
                      />
                    )}{' '}
                    {user.disabled && <Chip size="small" label={t('sharedDisabled')} />}
                  </TableCell>
                  <TableCell padding="none" style={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title={t('loginLogin')}>
                      <IconButton
                        size="small"
                        aria-label={t('loginLogin')}
                        onClick={() => handleLogin(user.id)}
                      >
                        <LoginRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('sharedEdit')}>
                      <IconButton
                        size="small"
                        aria-label={t('sharedEdit')}
                        onClick={() => navigate(`/settings/user/${user.id}`)}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {editable && (
                      <Tooltip title={t('adminUnassign')}>
                        <IconButton
                          size="small"
                          aria-label={t('adminUnassign')}
                          onClick={() => handleUnlink(user.id)}
                        >
                          <LinkOffRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </div>
      )}
      {editable && rows.length > 0 && (
        <div>
          <Button size="small" startIcon={<SyncRoundedIcon />} onClick={handleSync}>
            {t('adminSyncAccess')}
          </Button>
        </div>
      )}

      <Dialog open={dialog === 'link'} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>{t('adminLinkUser')}</DialogTitle>
        <DialogContent className={classes.form}>
          <Autocomplete
            options={candidates}
            value={picked}
            onChange={(_, value) => setPicked(value)}
            getOptionLabel={(user) => `${user.name} · ${user.email}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label={t('settingsUser')} autoFocus />}
          />
          <Typography variant="body2" color="textSecondary">
            {t('adminLinkUserHelp')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={close}>
            {t('sharedCancel')}
          </Button>
          <Button variant="contained" disabled={!picked} onClick={handleLink}>
            {t('adminAssign')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'create'} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>{t('adminCreateUser')}</DialogTitle>
        <DialogContent className={classes.form}>
          <TextField
            label={t('sharedName')}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            autoFocus
          />
          <TextField
            label={t('userEmail')}
            value={draft.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
          <PasswordField
            label={t('userPassword')}
            value={draft.password}
            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
          />
          <Typography variant="body2" color="textSecondary">
            {t('adminCreateUserHelp')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={close}>
            {t('sharedCancel')}
          </Button>
          <Button
            variant="contained"
            disabled={!draft.name.trim() || !draft.email.trim() || draft.password.length < 6}
            onClick={handleCreate}
          >
            {t('adminCreateUser')}
          </Button>
        </DialogActions>
      </Dialog>
    </FormSection>
  );
};

export default CustomerUsers;
