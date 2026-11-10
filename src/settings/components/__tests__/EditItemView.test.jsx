// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { TextField } from '@mui/material';
import EditItemView from '../EditItemView';
import { fakeFetch, location, renderApp } from '../../../test/render';

// FND-07: saving a settings item (vehicle, group, geofence... all go through EditItemView).
const GroupForm = ({ onItemSaved }) => {
  const [item, setItem] = useState();
  return (
    <EditItemView
      endpoint="groups"
      item={item}
      setItem={setItem}
      defaultItem={{ name: '' }}
      validate={() => item?.name?.trim()}
      onItemSaved={onItemSaved}
      breadcrumbs={['settingsTitle', 'groupDialog']}
    >
      <TextField
        label="שם"
        value={item?.name || ''}
        onChange={(event) => setItem({ ...item, name: event.target.value })}
      />
    </EditItemView>
  );
};

const state = {
  session: { server: { attributes: {} }, user: { id: 1, administrator: true, attributes: {} } },
};

const open = (route, handlers, props = {}) => {
  const api = fakeFetch(handlers);
  vi.stubGlobal('fetch', vi.fn(api.fetch));
  return renderApp(<GroupForm {...props} />, {
    state,
    path: '/settings/group/:id?',
    route,
    history: ['/settings/groups'],
  }).then((result) => ({ ...result, api }));
};

afterEach(() => vi.unstubAllGlobals());

describe('saving an item', () => {
  it('loads the item, saves the change with PUT and goes back', async () => {
    const onItemSaved = vi.fn();
    const { user, api, store } = await open(
      '/settings/group/5',
      {
        'GET api/groups/5': { id: 5, name: 'צפון', groupId: 0, attributes: {} },
        'PUT api/groups/5': (url, init) => JSON.parse(init.body),
      },
      { onItemSaved },
    );
    const name = await screen.findByLabelText('שם');
    expect(name).toHaveValue('צפון');
    await user.clear(name);
    await user.type(name, 'צפון רחוק');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(location.current.pathname).toBe('/settings/groups'));
    const put = api.calls.find((call) => call.method === 'PUT');
    expect(JSON.parse(put.body)).toEqual({ id: 5, name: 'צפון רחוק', groupId: 0, attributes: {} });
    expect(onItemSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'צפון רחוק' }));
    // ADM-28: the save says what was saved.
    expect(store.getState().messages.messages).toContainEqual({
      message: 'צפון רחוק נשמר',
      severity: 'success',
    });
  });

  it('creates a new item with POST, and cannot save it empty', async () => {
    const { user, api } = await open('/settings/group', {
      'POST api/groups': (url, init) => ({ id: 9, ...JSON.parse(init.body) }),
    });
    const save = await screen.findByRole('button', { name: 'שמירה' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('שם'), 'דרום');
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(location.current.pathname).toBe('/settings/groups'));
    expect(api.calls.map((call) => `${call.method} ${call.url}`)).toEqual(['POST api/groups']);
  });

  // ADM-14: a new item stays open at its own address, and a disabled save says why.
  it('save and continue keeps a new item open at its address', async () => {
    const { user, api } = await open('/settings/group', {
      'POST api/groups': (url, init) => ({ id: 9, ...JSON.parse(init.body) }),
      'GET api/groups/9': { id: 9, name: 'דרום', attributes: {} },
    });
    const keep = await screen.findByRole('button', { name: 'שמירה והמשך' });
    expect(keep).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('כדי לשמור יש למלא את שדות החובה');
    await user.type(screen.getByLabelText('שם'), 'דרום');
    expect(screen.queryByText('כדי לשמור יש למלא את שדות החובה')).toBeNull();
    await user.click(keep);
    await waitFor(() => expect(location.current.pathname).toBe('/settings/group/9'));
    expect(await screen.findByLabelText('שם')).toHaveValue('דרום');
    expect(api.calls[0].method).toBe('POST');
    // An item that is already saved has no "save and continue".
    expect(screen.queryByRole('button', { name: 'שמירה והמשך' })).toBeNull();
  });

  it('stays on the form and shows the server error when the save fails', async () => {
    const { user, store } = await open('/settings/group/5', {
      'GET api/groups/5': { id: 5, name: 'צפון', attributes: {} },
      'PUT api/groups/5': new Response('Duplicate name', { status: 400 }),
    });
    await user.type(await screen.findByLabelText('שם'), '!');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(store.getState().messages.messages).toHaveLength(1));
    expect(String(store.getState().messages.messages[0])).toContain('Duplicate name');
    expect(location.current.pathname).toBe('/settings/group/5');
    expect(screen.getByRole('button', { name: 'שמירה' })).toBeEnabled();
  });

  it('cancel goes back without saving', async () => {
    const { user, api } = await open('/settings/group/5', {
      'GET api/groups/5': { id: 5, name: 'צפון', attributes: {} },
    });
    await screen.findByLabelText('שם');
    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(location.current.pathname).toBe('/settings/groups');
    expect(api.calls.every((call) => call.method === 'GET')).toBe(true);
  });
});
