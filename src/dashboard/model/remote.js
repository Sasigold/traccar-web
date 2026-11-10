import fetchOrThrow from '../../common/util/fetchOrThrow';
import { unwrap } from '../../common/fleet/client';

// ARC-09: where the dashboards are kept.
//
// With a fleet database that has the `dashboards` area, each person's document is a row of
// `dashboards` and the organization default a row of `dashboard_defaults`; nothing else is
// written. Without one (an older database, or a server without the fleet), they stay in the
// Traccar attributes `web.dashboard` (user) and `web.dashboardDefault` (server), and every save
// reads the latest object first and changes only that one attribute, so it never brings back
// what someone else changed since the page was opened.

const json = (body) => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// The latest object with one attribute set (or removed, with `undefined`).
export const withAttribute = (object, key, value) => {
  const attributes = { ...object.attributes };
  if (value === undefined) {
    delete attributes[key];
  } else {
    attributes[key] = value;
  }
  return { ...object, attributes };
};

// `decide(latest)` may return false to skip the write (the attribute no longer fits, say).
export const putUserAttribute = async (userId, key, value, decide) => {
  const latest = await (await fetchOrThrow(`api/users/${userId}`)).json();
  if (decide && !decide(latest)) {
    return null;
  }
  const response = await fetchOrThrow(
    `api/users/${userId}`,
    json(withAttribute(latest, key, value)),
  );
  return response.json();
};

export const putServerAttribute = async (key, value) => {
  const latest = await (await fetchOrThrow('api/server')).json();
  const response = await fetchOrThrow('api/server', json(withAttribute(latest, key, value)));
  return response.json();
};

// Fleet database rows. `doc` is the compact document (codec.js), stored as JSON.
// Row security already limits `dashboards` to the person's own row; the filter says so.
export const readOwnDashboards = (client, profileId) =>
  client.from('dashboards').select('doc, updated_at').eq('profile_id', profileId).limit(1);

export const readDefaultDashboards = (client) =>
  client.from('dashboard_defaults').select('doc, updated_at').limit(1);

export const saveOwnDashboards = async (client, { orgId, profileId }, encoded) =>
  unwrap(
    await client
      .from('dashboards')
      .upsert(
        { org_id: orgId, profile_id: profileId, doc: JSON.parse(encoded) },
        { onConflict: 'profile_id' },
      ),
  );

export const publishDefaultDashboards = async (client, orgId, encoded) =>
  unwrap(
    await client
      .from('dashboard_defaults')
      .upsert({ org_id: orgId, doc: JSON.parse(encoded) }, { onConflict: 'org_id' }),
  );
