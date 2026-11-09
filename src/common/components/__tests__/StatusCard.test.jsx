// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import StatusCard from '../StatusCard';
import { fakeFetch, location, renderApp } from '../../../test/render';

// FND-07: the vehicle card (the details of one vehicle on the map).
const now = new Date().toISOString();
const device = {
  id: 1,
  name: 'טנדר צפון',
  uniqueId: '860000000000001',
  status: 'online',
  category: 'van',
  lastUpdate: now,
  attributes: { plateNumber: '12-345-67' },
};
const position = {
  id: 501,
  deviceId: 1,
  protocol: 'teltonika',
  latitude: 32.794,
  longitude: 34.989,
  speed: 30,
  course: 90,
  fixTime: now,
  address: 'שדרות הנשיא 1, חיפה',
  attributes: { motion: true, driverUniqueId: 'd7', totalDistance: 123456000 },
};

const state = (user = {}) => ({
  session: {
    server: { attributes: {} },
    user: { id: 1, administrator: true, attributes: {}, ...user },
    positions: { 1: position },
  },
  devices: { items: { 1: device }, selectedId: 1 },
  drivers: {
    items: { d7: { id: 7, name: 'דנה לוי', uniqueId: 'd7', attributes: { phone: '0501234567' } } },
  },
});

afterEach(() => vi.unstubAllGlobals());

describe('the vehicle card', () => {
  it('shows the vehicle, its state, its position and its driver', async () => {
    await renderApp(<StatusCard deviceId={1} position={position} onClose={() => {}} />, {
      state: state(),
    });
    expect(await screen.findByText('טנדר צפון')).toBeInTheDocument();
    expect(screen.getByText('12-345-67')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('בתנועה')).toBeInTheDocument();
    expect(screen.getAllByText(/56 ק"מ\/שעה/).length).toBeGreaterThan(0);
    expect(screen.getByText('נהג: דנה לוי')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'יותר פרטים' })).toHaveAttribute(
      'href',
      '/position/501',
    );
  });

  it('closes, and opens the live dials of a moving vehicle', async () => {
    const onClose = vi.fn();
    const { user } = await renderApp(
      <StatusCard deviceId={1} position={position} onClose={onClose} />,
      { state: state() },
    );
    await user.click(await screen.findByRole('button', { name: 'סגירה' }));
    expect(onClose).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'מחוונים חיים' }));
    expect(location.current.pathname).toBe('/telemetry/1');
  });

  it('offers today’s replay for a parked vehicle', async () => {
    const parked = { ...position, speed: 0, attributes: { ...position.attributes, motion: false } };
    const { user } = await renderApp(
      <StatusCard deviceId={1} position={parked} onClose={() => {}} />,
      { state: state() },
    );
    await user.click(await screen.findByRole('button', { name: 'שחזור היום' }));
    expect(location.current.pathname).toBe('/replay');
    expect(location.current.search).toBe('?deviceId=1');
  });

  it('creates a geofence around the vehicle and opens it', async () => {
    const api = fakeFetch({
      'POST api/geofences': { id: 44, name: 'גדר וירטואלית' },
      'POST api/permissions': new Response(null, { status: 204 }),
    });
    vi.stubGlobal('fetch', vi.fn(api.fetch));
    const { user } = await renderApp(
      <StatusCard deviceId={1} position={position} onClose={() => {}} />,
      { state: state() },
    );
    await user.click(await screen.findByRole('button', { name: 'פעולות נוספות' }));
    await user.click(await screen.findByRole('menuitem', { name: 'יצירת גדר וירטואלית' }));
    await waitFor(() => expect(location.current.pathname).toBe('/settings/geofence/44'));
    expect(JSON.parse(api.calls[0].body).area).toBe('CIRCLE (32.794 34.989, 50)');
    expect(JSON.parse(api.calls[1].body)).toEqual({ deviceId: 1, geofenceId: 44 });
  });

  it('hides what a read-only user cannot do', async () => {
    const { user } = await renderApp(
      <StatusCard deviceId={1} position={position} onClose={() => {}} />,
      { state: state({ administrator: false, readonly: true }) },
    );
    await user.click(await screen.findByRole('button', { name: 'פעולות נוספות' }));
    await screen.findByRole('menuitem', { name: 'כרטיס הרכב' });
    expect(screen.queryByRole('menuitem', { name: 'יצירת גדר וירטואלית' })).toBeNull();
  });
});
