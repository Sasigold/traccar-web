import { WebSocketServer, WebSocket } from 'ws';
import process from 'node:process';
import { createDrivers, createFleet, createMaintenance, maintenanceFor } from './fleet.js';
import { israeliDrivers } from './israel.js';
import { eventTypes, findEvent, geofences, report, sampleEvent } from './reports.js';
import { DEMO_USERS, handleSandbox, overlay, overlayOne, sandboxOf } from './sandbox.js';

const commandTypes = ['positionSingle', 'engineStop', 'engineResume', 'custom'];

const groups = [
  { id: 1, name: 'צפון', groupId: 0, attributes: {} },
  { id: 2, name: 'מרכז', groupId: 0, attributes: {} },
];

export const demoServer = (server) => {
  // BRD-05: DEMO_FLEET=il serves the Israeli fleet to everyone (sales, screenshots).
  const fleet = createFleet(Date.now(), { israeli: process.env.DEMO_FLEET === 'il' });
  // FND-07: the performance profile's fleet of 2,000 (cookie demoFleet=large), made on first use.
  let largeFleet = null;
  let israeliFleet = fleet.israeli ? fleet : null;
  const fleetFor = (request) => {
    const cookie = request.headers.cookie || '';
    if (/(?:^|;\s*)demoFleet=large(?:;|$)/.test(cookie)) {
      return (largeFleet ||= createFleet(Date.now(), { size: 2000 }));
    }
    if (/(?:^|;\s*)demoFleet=il(?:;|$)/.test(cookie)) {
      return (israeliFleet ||= createFleet(Date.now(), { israeli: true }));
    }
    return fleet;
  };
  const driversFor = (fleetOf) =>
    fleetOf.israeli ? israeliDrivers(createDrivers()) : createDrivers();
  const sockets = new WebSocketServer({ noServer: true });
  const settings = {
    id: 1,
    readonly: true,
    attributes: {},
  };
  const user = {
    id: 1,
    name: 'Demo',
    attributes: {},
  };
  const broadcast = (message) => {
    const text = JSON.stringify(message);
    sockets.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(text);
    });
  };
  // Commands are simulated: an online vehicle answers after two seconds, an offline one is
  // queued. Nothing in the demo fleet changes.
  const sendCommand = (request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      let command;
      try {
        command = JSON.parse(body);
      } catch {
        response.writeHead(400).end('Invalid command.');
        return;
      }
      const device = fleet.devices.find((item) => item.id === command.deviceId);
      if (!device) {
        response.writeHead(404).end('Unknown device.');
        return;
      }
      const queued = device.status !== 'online';
      response.setHeader('Content-Type', 'application/json');
      response.writeHead(queued ? 202 : 200).end(JSON.stringify(command));
      if (!queued) {
        setTimeout(() => {
          const position = fleet.positions.find((item) => item.deviceId === device.id);
          if (position) {
            broadcast({
              positions: [
                {
                  ...position,
                  serverTime: new Date().toISOString(),
                  attributes: { ...position.attributes, result: `${command.type}: OK` },
                },
              ],
            });
          }
        }, 2000);
      }
    });
  };
  // Test hook: GET /api/demo/event?client=<id>&deviceId=1&type=alarm&alarm=sos[&speed=60]
  // sends a live event to the pages whose demoClient cookie is <id> (so parallel tests do not
  // see each other's alerts).
  let demoEventId = 900000;
  const sendDemoEvent = (params) => {
    const deviceId = Number(params.get('deviceId') || 1);
    const position = fleet.positions.find((item) => item.deviceId === deviceId);
    demoEventId += 1;
    const event = {
      id: demoEventId,
      type: params.get('type') || 'alarm',
      deviceId,
      eventTime: new Date().toISOString(),
      positionId: position?.id || 0,
      geofenceId: 0,
      maintenanceId: 0,
      attributes: {
        ...(params.get('alarm') && { alarm: params.get('alarm') }),
        ...(params.get('speed') && { speed: Number(params.get('speed')) }),
      },
    };
    const text = JSON.stringify({ events: [event] });
    let sent = 0;
    sockets.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.demoClient === params.get('client')) {
        client.send(text);
        sent += 1;
      }
    });
    return { sent, event };
  };
  server.middlewares.use((request, response, next) => {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (request.method === 'POST' && url.pathname === '/api/commands/send') {
      sendCommand(request, response);
      return;
    }
    const send = (value) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(value));
    };
    // FND-07: a test's own writable sandbox (cookie demoWrite), see sandbox.js.
    const sandbox = sandboxOf(request);
    if (sandbox) {
      handleSandbox(sandbox, request, response, url, send).then((handled) => {
        if (handled) return;
        if (request.method !== 'GET') {
          response.writeHead(404).end('Unavailable in this demo.');
        } else if (sandbox.userId == null && url.pathname !== '/api/server') {
          response.writeHead(401).end('Not signed in.');
        } else {
          read(url, response, send, sandbox, fleetFor(request));
        }
      });
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(403).end('This demo is read-only.');
      return;
    }
    read(url, response, send, null, fleetFor(request));
  });
  const read = (url, response, send, sandbox, fleet) => {
    fleet.advance();
    let data;
    const listed = (collection, items) => overlay(sandbox, collection, items);
    switch (url.pathname) {
      case '/api/server':
        data = sandbox ? { ...settings, ...sandbox.server, readonly: false } : settings;
        break;
      case '/api/session':
        data = user;
        break;
      case '/api/devices':
        data = listed('devices', fleet.devices);
        break;
      case '/api/positions':
        data = fleet.query(url.searchParams);
        break;
      case '/api/geofences':
        data = listed('geofences', geofences);
        break;
      case '/api/notifications/types':
        data = eventTypes.map((type) => ({ type }));
        break;
      case '/api/reports/route':
      case '/api/reports/combined':
      case '/api/reports/trips':
      case '/api/reports/stops':
      case '/api/reports/summary':
      case '/api/reports/events':
      case '/api/reports/geofences':
        data = report(fleet, url.pathname.split('/').at(-1), url.searchParams);
        break;
      case '/api/drivers':
        data = listed('drivers', driversFor(fleet));
        break;
      case '/api/maintenance':
        data = listed(
          'maintenance',
          url.searchParams.has('deviceId')
            ? maintenanceFor(url.searchParams.get('deviceId'))
            : createMaintenance(),
        );
        break;
      case '/api/groups':
        data = listed('groups', groups);
        break;
      case '/api/calendars':
        data = listed('calendars', []);
        break;
      // The demo's users, in write mode (SEC-13 "log in as" works on them).
      case '/api/users':
        data = sandbox ? listed('users', DEMO_USERS) : [];
        break;
      case '/api/demo/event':
        data = sendDemoEvent(url.searchParams);
        break;
      case '/api/commands/types':
        data = commandTypes.map((type) => ({ type }));
        break;
      case '/api/commands/send':
        data = [];
        break;
      default:
        // One user (ARC-09: a save reads the latest copy first).
        if (/^\/api\/users\/\d+$/.test(url.pathname)) {
          const id = Number(url.pathname.split('/').at(-1));
          data = sandbox
            ? overlayOne(
                sandbox,
                'users',
                DEMO_USERS.find((item) => item.id === id),
                id,
              )
            : id === user.id
              ? user
              : undefined;
          if (data) break;
        }
        if (/^\/api\/devices\/\d+$/.test(url.pathname)) {
          const id = Number(url.pathname.split('/').at(-1));
          data = overlayOne(
            sandbox,
            'devices',
            fleet.devices.find((device) => device.id === id),
            id,
          );
          if (data) break;
        }
        // One item of a listed collection (the edit pages load it this way).
        {
          const [, name, rawId] =
            /^\/api\/(groups|geofences|maintenance)\/(\d+)$/.exec(url.pathname) || [];
          if (name) {
            const id = Number(rawId);
            const lists = { groups, geofences, maintenance: createMaintenance() };
            data = overlayOne(
              sandbox,
              name,
              lists[name].find((item) => item.id === id),
              id,
            );
            if (data) break;
          }
        }
        // In a sandbox, any other collection lists what the test saved into it.
        if (sandbox) {
          const [, collection, id] = /^\/api\/([a-z]+)(?:\/(\d+))?$/.exec(url.pathname) || [];
          if (collection && id) {
            data = overlayOne(sandbox, collection, null, Number(id));
            if (data) break;
          } else if (collection) {
            data = listed(collection, []);
            break;
          }
        }
        if (/^\/api\/drivers\/\d+$/.test(url.pathname)) {
          data = driversFor(fleet).find(
            (driver) => driver.id === Number(url.pathname.split('/').at(-1)),
          );
          if (data) break;
        }
        if (/^\/api\/events\/\d+$/.test(url.pathname)) {
          const id = Number(url.pathname.split('/').at(-1));
          data = findEvent(fleet, id);
          if (data) break;
          const type = eventTypes[id % 10];
          const [position] = fleet.query(new URLSearchParams({ id: Math.floor(id / 10) }));
          if (position && type) {
            data = sampleEvent(position, type);
            break;
          }
        }
        response.writeHead(404).end('Unavailable in this demo.');
        return;
    }
    send(data);
  };
  server.httpServer.on('upgrade', (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname === '/api/socket') {
      sockets.handleUpgrade(request, socket, head, (client) => {
        client.demoClient = /(?:^|;\s*)demoClient=([^;]+)/.exec(request.headers.cookie || '')?.[1];
        client.sandbox = sandboxOf(request);
        client.fleet = fleetFor(request);
        client.fleet.advance();
        client.send(
          JSON.stringify({
            devices: overlay(client.sandbox, 'devices', client.fleet.devices),
            positions: client.fleet.positions,
          }),
        );
      });
    }
  });
  const timer = setInterval(() => {
    if (sockets.clients.size === 0) return;
    // One message per fleet, shared by its clients; a sandbox sees its own changes.
    const messages = new Map();
    sockets.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const source = client.fleet || fleet;
      if (!messages.has(source)) {
        source.advance();
        messages.set(
          source,
          JSON.stringify({ devices: source.devices, positions: source.positions }),
        );
      }
      client.send(
        client.sandbox
          ? JSON.stringify({
              devices: overlay(client.sandbox, 'devices', source.devices),
              positions: source.positions,
            })
          : messages.get(source),
      );
    });
  }, 5000);
  server.httpServer.on('close', () => {
    clearInterval(timer);
    sockets.clients.forEach((client) => client.terminate());
    sockets.close();
  });
};
