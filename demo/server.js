import { WebSocketServer, WebSocket } from 'ws';
import { createDrivers, createFleet, createMaintenance, maintenanceFor } from './fleet.js';
import { eventTypes, findEvent, geofences, report, sampleEvent } from './reports.js';

const commandTypes = ['positionSingle', 'engineStop', 'engineResume', 'custom'];

const groups = [
  { id: 1, name: 'צפון', groupId: 0, attributes: {} },
  { id: 2, name: 'מרכז', groupId: 0, attributes: {} },
];

export const demoServer = (server) => {
  const fleet = createFleet();
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
    if (request.method !== 'GET') {
      response.writeHead(403).end('This demo is read-only.');
      return;
    }
    fleet.advance();
    let data;
    switch (url.pathname) {
      case '/api/server':
        data = settings;
        break;
      case '/api/session':
        data = user;
        break;
      case '/api/devices':
        data = fleet.devices;
        break;
      case '/api/positions':
        data = fleet.query(url.searchParams);
        break;
      case '/api/geofences':
        data = geofences;
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
        data = createDrivers();
        break;
      case '/api/maintenance':
        data = url.searchParams.has('deviceId')
          ? maintenanceFor(url.searchParams.get('deviceId'))
          : createMaintenance();
        break;
      case '/api/groups':
        data = groups;
        break;
      case '/api/calendars':
        data = [];
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
        if (/^\/api\/devices\/\d+$/.test(url.pathname)) {
          data = fleet.devices.find(
            (device) => device.id === Number(url.pathname.split('/').at(-1)),
          );
          if (data) break;
        }
        if (/^\/api\/drivers\/\d+$/.test(url.pathname)) {
          data = createDrivers().find(
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
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(data));
  });
  server.httpServer.on('upgrade', (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname === '/api/socket') {
      sockets.handleUpgrade(request, socket, head, (client) => {
        client.demoClient = /(?:^|;\s*)demoClient=([^;]+)/.exec(request.headers.cookie || '')?.[1];
        fleet.advance();
        client.send(JSON.stringify({ devices: fleet.devices, positions: fleet.positions }));
      });
    }
  });
  const timer = setInterval(() => {
    if (sockets.clients.size === 0) return;
    fleet.advance();
    const message = JSON.stringify({ devices: fleet.devices, positions: fleet.positions });
    sockets.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  }, 5000);
  server.httpServer.on('close', () => {
    clearInterval(timer);
    sockets.clients.forEach((client) => client.terminate());
    sockets.close();
  });
};
