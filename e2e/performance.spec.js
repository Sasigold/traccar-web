import { test, expect } from './fixtures';

// FND-07: a performance profile with 2,000 vehicles (the demo's large fleet, cookie
// demoFleet=large). It measures the first load, the live updates (the socket sends every
// vehicle every 5 seconds), a search and opening a vehicle, attaches the numbers to the report
// (performance.json) and fails only past generous budgets, so a regression of the order of
// "the list freezes" is caught on CI machines of any speed. docs/PERFORMANCE.md has the
// baseline and how to profile a production build.

const BUDGET = {
  // From navigation until the list shows vehicles of the large fleet.
  firstListMs: 20000,
  // While the live updates arrive: the longest single task, and the JavaScript time per update
  // (native drawing is reported, not judged: it depends on the machine's GPU).
  liveLongestTaskMs: 1500,
  liveJsPerUpdateMs: 2500,
  // From typing a search until the list shows the one match.
  searchMs: 5000,
  // From clicking a row until the vehicle card is open.
  selectMs: 3000,
};

test('2,000 vehicles: load, live updates, search and selection stay responsive', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await page
    .context()
    .addCookies([{ name: 'demoFleet', value: 'large', url: 'http://localhost:3000' }]);
  await page.addInitScript(() => {
    window.vfLongTasks = [];
    try {
      new PerformanceObserver((list) =>
        list.getEntries().forEach((entry) => window.vfLongTasks.push(entry.duration)),
      ).observe({ type: 'longtask', buffered: true });
    } catch {
      // not Chromium
    }
  });
  const blocking = () =>
    page.evaluate(() => {
      const tasks = window.vfLongTasks.splice(0);
      return {
        count: tasks.length,
        longest: Math.round(Math.max(0, ...tasks)),
        blocking: Math.round(tasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0)),
      };
    });

  // First load.
  await page.goto('/');
  const firstListMs = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const check = () => {
          if (
            [...document.querySelectorAll('[role=listitem]')].some((row) =>
              /רכב \d+/.test(row.textContent),
            )
          ) {
            resolve(Math.round(performance.now()));
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      }),
  );
  await page.waitForLoadState('networkidle');
  const load = await blocking();

  // Live updates: three rounds of 2,000 vehicles, under the CPU profiler. Its samples split the
  // main thread's time into JavaScript (ours, React, MapLibre's placement) and native work
  // (layout, paint, and WebGL, which CI machines draw in software, far slower than a GPU).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await page.evaluate(() => {
    window.vfLongTasks.length = 0;
  });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(15000);
  const { profile: cpu } = await cdp.send('Profiler.stop');
  const live = await blocking();
  const nodes = new Map(cpu.nodes.map((node) => [node.id, node.callFrame.functionName]));
  const time = { js: 0, native: 0, gc: 0, idle: 0 };
  cpu.samples.forEach((id, index) => {
    const name = nodes.get(id);
    const delta = (cpu.timeDeltas[index] || 0) / 1000;
    if (name === '(idle)') time.idle += delta;
    else if (name === '(program)') time.native += delta;
    else if (name === '(garbage collector)') time.gc += delta;
    else time.js += delta;
  });
  const updates = 3;
  const perUpdate = (value) => Math.round(value / updates);
  const heapMb = await page.evaluate(() =>
    performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  );

  // Search for one vehicle among 2,000.
  const input = page.getByPlaceholder('חיפוש לפי שם, לוחית או נהג');
  const rows = page.getByRole('listitem').filter({ has: page.getByRole('button') });
  let started = Date.now();
  await input.fill('רכב 1999');
  await expect(rows).toHaveCount(1, { timeout: BUDGET.searchMs * 3 });
  const searchMs = Date.now() - started;

  // Open it.
  started = Date.now();
  await rows.first().getByRole('button').click();
  await expect(page.getByRole('button', { name: 'פקודה', exact: true })).toBeVisible({
    timeout: BUDGET.selectMs * 3,
  });
  const selectMs = Date.now() - started;

  const profile = {
    vehicles: 2000,
    firstListMs,
    load,
    live: {
      ...live,
      updates,
      blockingPerUpdateMs: perUpdate(live.blocking),
      jsPerUpdateMs: perUpdate(time.js + time.gc),
      nativePerUpdateMs: perUpdate(time.native),
      idleShare:
        Math.round((time.idle / (time.idle + time.js + time.gc + time.native)) * 100) / 100,
    },
    heapMb,
    searchMs,
    selectMs,
  };
  await testInfo.attach('performance.json', {
    body: JSON.stringify(profile, null, 2),
    contentType: 'application/json',
  });
  console.log(`FND-07 performance profile: ${JSON.stringify(profile)}`);

  expect(firstListMs).toBeLessThan(BUDGET.firstListMs);
  expect(live.longest).toBeLessThan(BUDGET.liveLongestTaskMs);
  expect(profile.live.jsPerUpdateMs).toBeLessThan(BUDGET.liveJsPerUpdateMs);
  expect(searchMs).toBeLessThan(BUDGET.searchMs);
  expect(selectMs).toBeLessThan(BUDGET.selectMs);
});
