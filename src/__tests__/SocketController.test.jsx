// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import SocketController from '../SocketController';
import { fakeFetch, location, renderApp } from '../test/render';
import { metrics } from '../common/telemetry/metrics';

// FND-07: the live connection. A drop must refresh the data, reconnect with back-off, fetch the
// events missed meanwhile, and never reconnect after a logout.
vi.mock('../common/util/reconnect', async (original) => ({
  ...(await original()),
  reconnectDelay: () => 30,
}));
vi.mock('../common/util/alarmSound', () => ({ playAlarm: vi.fn() }));

class FakeSocket {
  static instances = [];

  static CONNECTING = 0;

  static OPEN = 1;

  static CLOSED = 3;

  constructor(url) {
    this.url = String(url);
    this.readyState = FakeSocket.CONNECTING;
    this.sent = [];
    FakeSocket.instances.push(this);
  }

  send(text) {
    this.sent.push(text);
  }

  close(code = 1000) {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.closedWith = code;
    this.onclose?.({ code });
  }

  // Test controls.
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  receive(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1006 });
  }
}
FakeSocket.prototype.CLOSED = FakeSocket.CLOSED;

const devices = [
  { id: 1, name: 'טנדר 1', status: 'online', attributes: {} },
  { id: 2, name: 'משאית 2', status: 'offline', attributes: {} },
];
const position = (deviceId, attributes = {}) => ({
  id: deviceId * 10,
  deviceId,
  latitude: 32,
  longitude: 34.8,
  fixTime: new Date().toISOString(),
  attributes,
});

const state = {
  session: { server: { attributes: {} }, user: { id: 1, attributes: {} } },
};

let api;
beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  metrics.take();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const start = async (handlers = {}) => {
  api = fakeFetch({
    'GET api/devices': devices,
    'GET api/positions': [position(1)],
    'GET api/reports/events': [],
    ...handlers,
  });
  vi.stubGlobal('fetch', vi.fn(api.fetch));
  return renderApp(<SocketController />, { state });
};

const lastSocket = () => FakeSocket.instances.at(-1);

describe('SocketController', () => {
  it('loads the vehicles, connects and applies live updates', async () => {
    const { store } = await start();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    expect(lastSocket().url).toMatch(/\/api\/socket$/);
    expect(Object.keys(store.getState().devices.items)).toEqual(['1', '2']);

    act(() => lastSocket().open());
    expect(store.getState().session.socket).toBe(true);
    store.dispatch({
      type: 'commands/sent',
      payload: { deviceId: 2, type: 'engineStop', queued: false, sentAt: Date.now() - 1000 },
    });
    expect(JSON.parse(lastSocket().sent[0])).toEqual({ logs: false });

    act(() =>
      lastSocket().receive({
        devices: [{ ...devices[1], status: 'online' }],
        positions: [position(2, { result: 'engineStop: OK' })],
      }),
    );
    await waitFor(() => expect(store.getState().devices.items[2].status).toBe('online'));
    await waitFor(() => expect(store.getState().session.positions[2]).toBeTruthy());
    // A command reply is read before the throttle can merge it away.
    expect(store.getState().commands.items[2]).toMatchObject({
      status: 'answered',
      result: 'engineStop: OK',
    });
  });

  it('after a drop refreshes, reconnects and fetches the events it missed', async () => {
    const { store } = await start({
      'GET api/reports/events': [
        {
          id: 5,
          type: 'alarm',
          deviceId: 1,
          eventTime: new Date().toISOString(),
          attributes: { alarm: 'sos' },
        },
      ],
    });
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    act(() => lastSocket().open());

    const now = Date.now();
    act(() => lastSocket().drop());
    expect(store.getState().session.socket).toBe(false);
    await waitFor(() => expect(store.getState().session.reconnectAt).toBeGreaterThan(now));
    expect(api.calls.filter((call) => call.url === 'api/positions')).toHaveLength(1);

    // A minute passes before the connection is back: the gap is back-filled.
    vi.spyOn(Date, 'now').mockReturnValue(now + 60000);
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    act(() => lastSocket().open());
    await waitFor(() =>
      expect(api.calls.some((call) => call.url.startsWith('api/reports/events?'))).toBe(true),
    );
    const query = new URLSearchParams(
      api.calls.find((call) => call.url.startsWith('api/reports/events?')).url.split('?')[1],
    );
    expect(query.getAll('deviceId')).toEqual(['1', '2']);
    expect(query.get('type')).toBe('allEvents');
    await waitFor(() =>
      expect(store.getState().events.items.map((event) => event.id)).toContain(5),
    );
    expect(metrics.take().counters).toMatchObject({ socket_disconnect: 1, socket_reconnect: 1 });
  });

  it('goes to the login page when the session expired', async () => {
    await start({ 'GET api/positions': new Response('', { status: 401 }) });
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    act(() => lastSocket().open());
    act(() => lastSocket().drop());
    await waitFor(() => expect(location.current.pathname).toBe('/login'));
  });

  it('closes for good on logout', async () => {
    const { store } = await start();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const socket = lastSocket();
    act(() => socket.open());
    act(() => store.dispatch({ type: 'session/updateUser', payload: null }));
    expect(socket.closedWith).toBe(4000);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(FakeSocket.instances).toHaveLength(1);
    expect(api.calls.filter((call) => call.url === 'api/positions')).toHaveLength(0);
  });
});
