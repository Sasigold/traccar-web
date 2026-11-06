import { getFleetClient, unwrap } from '../common/fleet/client';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { traccarFlagsForRole } from '../common/fleet/permissionsCatalog';

// Changes a user's fleet role and aligns the Traccar user flags (read only, device read
// only, limited commands) so Traccar's own screens agree with it. Owners and admins are left
// as Traccar has them.
export const applyRole = async (profileRow, role) => {
  const updated = unwrap(
    await getFleetClient()
      .from('profiles')
      .update({ role })
      .eq('id', profileRow.id)
      .select('*')
      .single(),
  );
  if (profileRow.traccar_user_id && role !== 'owner' && role !== 'admin') {
    const response = await fetchOrThrow(`api/users/${profileRow.traccar_user_id}`);
    const user = await response.json();
    if (!user.administrator) {
      await fetchOrThrow(`api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...user, ...traccarFlagsForRole(role) }),
      });
    }
  }
  return updated;
};
