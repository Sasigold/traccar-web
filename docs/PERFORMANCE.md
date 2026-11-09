# Performance profile: 2,000 vehicles (FND-07)

`e2e/performance.spec.js` opens the main screen with the demo's large fleet (cookie
`demoFleet=large`: 2,000 vehicles, a fifth of them offline, the live socket sending all of them
every 5 seconds) and measures:

| Measure | What it is |
|---|---|
| `firstListMs` | from navigation until the list shows vehicles of the large fleet |
| `load` | long tasks (over 50 ms) during the first load: count, longest, blocking time |
| `live` | 15 seconds of live updates under the CPU profiler: long tasks, and per update the JavaScript time (ours, React, MapLibre's placement) and the native time (layout, paint, WebGL) |
| `heapMb` | JavaScript heap after the live updates |
| `searchMs` | typing "רכב 1999" until the list shows the one match |
| `selectMs` | clicking that row until the vehicle card is open |

The numbers are attached to the Playwright report (`performance.json`) and printed in the log. The
test fails only past generous budgets (top of the spec): CI runs the development server, whose
React is about three times slower, on machines of any speed. It is meant to catch "the list
freezes", not a 10% change.

## Baseline (9 November 2026, production build, headless Chromium without a GPU)

| | |
|---|---|
| First list | 0.9 to 1.0 s |
| Load | about 16 long tasks, longest 0.17 to 0.32 s |
| Live, per update of 2,000 vehicles | JavaScript 0.31 to 0.34 s; native 2.5 to 2.7 s; the main thread is idle 41 to 45% of the time |
| Longest task while live | 0.37 to 0.40 s |
| Heap | 51 to 73 MB |
| Search | 0.1 s (1.3 s when it lands on a live update) |
| Open a vehicle | 1.1 to 1.2 s |

The development server (what CI measures) gave: first list 2.0 s, JavaScript 0.93 s per update.

## What the profile showed

- **The map's drawing dominates, and it is the machine, not the app.** Without a GPU, Chromium
  draws WebGL in software: each map frame with 2,000 markers costs about 200 ms of native time, a
  few frames per update. With the map hidden, native time falls from 3.5 s to 0.8 s per 10
  seconds. On a computer with a GPU it should be a small fraction (see below). This is why the budget judges the
  JavaScript time and only reports the native time.
- **Our JavaScript is light.** The socket handler took 66 ms in 10 seconds (two updates,
  development mode); the rest is React rendering the visible rows and MapLibre placing the markers.
- **"On a GPU this is a small fraction" is an expectation, not a measurement:** this environment has
  no GPU. Worth confirming once on a real office PC and a mid-range phone.
- **Fixed: the driving icon's animation above 300 markers.** The animated speed streaks make the
  map repaint 15 times a second while a driving vehicle is visible, and every repaint places every
  marker again. Like the marker glide, it is now switched off above 300 markers
  (`setMovingAnimation` in `src/map/core/movingIcon.js`): the icon keeps its static driving pose.

## Profiling a production build

```sh
npm run demo:build      # production build of the demo into build-demo/
npm run demo:preview    # serves it on :3000 with the same mock server
npx playwright test e2e/performance.spec.js --trace off   # reuses the running server
```

For a CPU profile in the browser: open `http://localhost:3000` after setting the cookie
`demoFleet=large` (DevTools → Application → Cookies), then record in the Performance panel.
