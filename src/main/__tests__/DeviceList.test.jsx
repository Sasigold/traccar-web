// @vitest-environment jsdom
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import DeviceList from '../DeviceList';
import useFilter from '../useFilter';
import { fakeFetch, renderApp } from '../../test/render';

// FND-07: the vehicle list as MainPage builds it: the filter, the search and the rows.
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const devices = [
  {
    id: 1,
    name: 'טנדר צפון',
    status: 'online',
    groupId: 1,
    lastUpdate: minutesAgo(1),
    attributes: { plateNumber: '12-345-67' },
  },
  {
    id: 2,
    name: 'משאית מרכז',
    status: 'offline',
    groupId: 2,
    lastUpdate: minutesAgo(600),
    attributes: {},
  },
  {
    id: 3,
    name: 'רכב מנהל',
    status: 'online',
    groupId: 2,
    lastUpdate: minutesAgo(3),
    attributes: {},
  },
];
const positions = {
  1: {
    id: 11,
    deviceId: 1,
    speed: 40,
    fixTime: minutesAgo(1),
    attributes: { motion: true, driverUniqueId: 'd7' },
  },
  3: { id: 13, deviceId: 3, speed: 0, fixTime: minutesAgo(3), attributes: { motion: false } },
};
const state = {
  session: {
    server: { attributes: {} },
    user: { id: 1, administrator: true, attributes: {} },
    positions,
  },
  devices: {
    items: Object.fromEntries(devices.map((device) => [device.id, device])),
    loaded: true,
  },
  groups: {
    items: { 1: { id: 1, name: 'צפון', groupId: 0 }, 2: { id: 2, name: 'מרכז', groupId: 0 } },
  },
  drivers: { items: { d7: { id: 7, name: 'דנה לוי', uniqueId: 'd7', attributes: {} } } },
};

const noFilter = { statuses: [], groups: [], geofences: [], activities: [] };

const List = ({ keyword = '', filter = noFilter, sort = '' }) => {
  const live = useSelector((s) => s.session.positions);
  const [shown, setShown] = useState([]);
  const [shownPositions, setShownPositions] = useState([]);
  useFilter(keyword, filter, sort, false, live, setShown, setShownPositions);
  return (
    <div style={{ height: 600 }} data-positions={shownPositions.length}>
      <DeviceList devices={shown} keyword={keyword} />
    </div>
  );
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch({ 'GET api/devices': devices }).fetch));
});
afterEach(() => vi.unstubAllGlobals());

const rowNames = () =>
  screen.getAllByRole('listitem').map((row) => within(row).getByRole('button').textContent);

describe('the vehicle list', () => {
  it('lists every vehicle with its state', async () => {
    await renderApp(<List />, { state });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    const [north] = screen.getAllByRole('listitem');
    expect(north).toHaveTextContent('טנדר צפון');
    // Traccar speeds are knots: 40 kn is 74 km/h.
    expect(north).toHaveTextContent('בתנועה');
    expect(north).toHaveTextContent('74 ק"מ/שעה');
  });

  it('filters by status and group, and sorts by name', async () => {
    await renderApp(<List filter={{ ...noFilter, statuses: ['online'] }} sort="name" />, { state });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(rowNames()[0]).toContain('טנדר צפון');
    expect(rowNames()[1]).toContain('רכב מנהל');
  });

  it('filters by group, including subgroups', async () => {
    await renderApp(<List filter={{ ...noFilter, groups: [2] }} />, { state });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(rowNames().join()).not.toContain('טנדר צפון');
  });

  it('finds a vehicle by its plate, and shows what matched', async () => {
    await renderApp(<List keyword="345" />, { state });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByRole('listitem')).toHaveTextContent('12-345-67');
    expect(screen.getByRole('listitem').querySelector('mark')).toHaveTextContent('345');
  });

  it('finds a vehicle by its driver', async () => {
    await renderApp(<List keyword="דנה" />, { state });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByRole('listitem')).toHaveTextContent('טנדר צפון');
    expect(screen.getByRole('listitem')).toHaveTextContent('דנה לוי');
  });

  it('selects a vehicle on click', async () => {
    const { store, user } = await renderApp(<List />, { state });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    const button = within(screen.getAllByRole('listitem')[1]).getByRole('button');
    await user.click(button);
    expect(store.getState().devices.selectedId).toBe(2);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('refreshes the vehicles from the server', async () => {
    const { store } = await renderApp(<List />, { state });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('api/devices', expect.anything()));
    expect(store.getState().devices.loaded).toBe(true);
  });
});
