import { useState } from 'react';
import { Alert, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { fleetRoles } from '../../common/fleet/config';
import {
  useFleetError,
  useFleetPermission,
  useFleetProfile,
  useFleetStatus,
} from '../../common/fleet/useFleet';
import FormSection from './FormSection';

const useStyles = makeStyles()((theme) => ({
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
}));

const roleKey = (role) => `fleetRole${role.charAt(0).toUpperCase()}${role.slice(1)}`;

// Shows (and lets managers change) the Viper Fleet role of a Traccar user.
const FleetRoleSection = ({ traccarUserId }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const status = useFleetStatus();
  const error = useFleetError();
  const me = useFleetProfile();
  const canManage = useFleetPermission('users.manage');

  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useAsyncTask(async () => {
    if (status !== 'ready' || !traccarUserId) {
      return;
    }
    const client = getFleetClient();
    const row = unwrap(
      await client
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('traccar_user_id', traccarUserId)
        .maybeSingle(),
    );
    setProfile(row);
    if (row) {
      if (row.id === me?.id) {
        setPermissions(unwrap(await client.rpc('my_permissions')) || []);
      } else {
        const rows = unwrap(
          await client.from('role_permissions').select('permission').eq('role', row.role),
        );
        setPermissions(row.role === 'owner' ? ['*'] : (rows || []).map((it) => it.permission));
      }
    }
    setLoaded(true);
  }, [status, traccarUserId, me?.id]);

  const handleRoleChange = useCatch(async (event) => {
    const role = event.target.value;
    const client = getFleetClient();
    const updated = unwrap(
      await client
        .from('profiles')
        .update({ role })
        .eq('id', profile.id)
        .select('id, role')
        .single(),
    );
    setProfile({ ...profile, role: updated.role });
    const rows = unwrap(
      await client.from('role_permissions').select('permission').eq('role', updated.role),
    );
    setPermissions(updated.role === 'owner' ? ['*'] : (rows || []).map((it) => it.permission));
  });

  if (status === 'disabled' || status === 'idle' || !traccarUserId) {
    return null;
  }

  const isSelf = profile && profile.id === me?.id;
  // Managers can change anyone but themselves; only an owner may touch another owner.
  const editable =
    canManage && profile && !isSelf && (profile.role !== 'owner' || me?.role === 'owner');
  const roleOptions = fleetRoles.filter((role) => role !== 'owner' || me?.role === 'owner');

  return (
    <FormSection
      title={t('fleetRole')}
      description={t('fleetRoleDescription')}
      icon={<BadgeRoundedIcon />}
    >
      {status === 'error' && (
        <Alert severity="warning">{t('fleetConnectionError').replace('{0}', error || '')}</Alert>
      )}
      {status === 'ready' && loaded && !profile && (
        <Typography color="textSecondary">{t('fleetNoProfile')}</Typography>
      )}
      {status === 'ready' && profile && (
        <>
          <TextField
            select
            label={t('fleetRole')}
            value={profile.role}
            onChange={handleRoleChange}
            disabled={!editable}
          >
            {roleOptions.map((role) => (
              <MenuItem key={role} value={role}>
                {t(roleKey(role))}
              </MenuItem>
            ))}
          </TextField>
          <div>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {t('fleetPermissions')}
            </Typography>
            <div className={classes.chips}>
              {permissions.map((permission) => (
                <Chip key={permission} size="small" variant="outlined" label={permission} />
              ))}
            </div>
          </div>
        </>
      )}
    </FormSection>
  );
};

export default FleetRoleSection;
