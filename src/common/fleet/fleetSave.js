import { getFleetClient, unwrap } from './client';

// ARC-05: a parent row and its child rows in one transaction (fleet_save in the database). `kind`
// is 'work_order', 'incident' or 'inspection_template'; `id` null inserts; `children` replaces the
// child rows (null keeps them); `single` is the incident's claim. Returns the parent's id.
export const fleetSave = async (kind, id, row, children = null, single = null) =>
  unwrap(
    await getFleetClient().rpc('fleet_save', {
      p_kind: kind,
      p_id: id || null,
      p_row: row,
      p_children: children,
      p_single: single,
    }),
  );

// Runs `save` with a file uploaded first; when the save fails, the file is removed again so it
// is not left orphaned in storage. `upload` returns the path or null.
export const withUploadedFile = async (upload, remove, save) => {
  const path = await upload();
  try {
    return await save(path);
  } catch (error) {
    if (path) {
      await remove(path).catch(() => {});
    }
    throw error;
  }
};
