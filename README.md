# [Traccar Web App](https://www.traccar.org)

## Overview

This is the browser-based tracking dashboard for [Traccar](https://www.traccar.org), a free and open source GPS tracking platform. It's a React, Material UI, and MapLibre single-page app that talks to the [Traccar server](https://github.com/traccar/traccar) over its REST API, providing the live map, reports, geofences, and device management UI most people mean when they say "Traccar."

This repository is the front-end only. For the back-end server, see the [main Traccar repository](https://github.com/traccar/traccar). You don't need to build this yourself to use Traccar - the server repository already bundles a built copy - this repo is for contributing to or customizing the UI itself.

[Try the live demo](https://www.traccar.org/demo-server/) without installing anything.

| Web Dashboard |
|---|
| ![Traccar web dashboard](.github/screenshot.png) |

## Development

```shell
npm install
npm start
```

This starts a local dev server (Vite) that proxies API requests to a running Traccar server. See the [web app build documentation](https://www.traccar.org/build-web-app/) for full setup details, including how to point it at your own server.

To build a production bundle:

```shell
npm run build
```

## Team

- Anton Tananaev ([anton@traccar.org](mailto:anton@traccar.org))
- Andrey Kunitsyn ([andrey@traccar.org](mailto:andrey@traccar.org))

## License

Apache License, Version 2.0. See [LICENSE.txt](https://github.com/traccar/traccar-web/blob/master/LICENSE.txt) for details.

## Custom Hebrew / RTL fork

This fork is branded as **viper fleet** (SYNC POINT / MIDNIGHT AQUA): midnight navy, aqua, ice,
paper and ink, Sora + Assistant type, the Sync Point logo and app icons (light by default with a dark
mode toggle). It adds a navy navigation rail with a top bar and command palette (Ctrl+K), a settings
hub with grouped sections, data tables, section-card forms, a brand login screen, Hebrew as the
default language and full RTL.

**Brand rules are binding:** read [BRAND.md](BRAND.md) before changing anything visual. The brand book
and every source asset live in [`brand/`](brand/). `npm run lint` blocks raw colors outside the design
tokens in `src/common/theme/tokens.js`. Deploy with `sh deploy/deploy.sh`,
which builds and uploads `build/` into the Traccar container's web directory on the VPS
(see `deploy/docker-compose.override.example.yml`). Database changes go out with `sh deploy/migrate.sh`
and the edge functions kept here (the public API) with `sh deploy/functions.sh`.

A customizable **dashboard** (`/dashboard`, second item in the rail) lets every user build their own
boards from live fleet state, period activity and fleet-database widgets, in any form (KPI, donut,
pie, bars, columns, line, area, table), with a gapless drag-and-resize layout. See the "Dashboard"
section in [FLEET.md](FLEET.md).

Custom UI strings live in `src/resources/l10n/en.json` and `he.json` and are maintained in this repository.
The upstream Transifex workflow was removed because it force-pulled `he.json` and dropped them.

### נתוני דמו לשרת האמיתי

`deploy/demo-data.mjs` יוצר בשרת Traccar צי דמו ישראלי: 12 רכבים (משאיות, ואנים, טנדר, אופנוע,
אוטובוס ורכבי הנהלה), 4 קבוצות, 8 נהגים ו־6 אזורים גאוגרפיים. הוא ממלא כמה שעות של היסטוריה
(לדוחות ולהפעלה חוזרת של מסלולים) ואז מזיז את הרכבים בזמן אמת על כבישים אמיתיים (מסלולים מ־OSRM).
הסטטוסים מגוונים: רוב הרכבים בנסיעה, אחד חונה, אחד מנותק ואחד שמעולם לא דיווח.

```shell
export TRACCAR_URL=http://72.61.153.60:8082   # כתובת הממשק
export TRACCAR_EMAIL=admin@example.com        # משתמש מנהל
export TRACCAR_PASSWORD='...'

node deploy/demo-data.mjs          # יצירה + היסטוריה + סימולציה חיה (Ctrl+C לעצירה)
node deploy/demo-data.mjs simulate # רק להריץ שוב את התנועה (בלי ליצור מחדש)
node deploy/demo-data.mjs clean    # מחיקת כל נתוני הדמו, ורק אותם
```

המיקומים נשלחים בפרוטוקול OsmAnd לפורט 5055 באותו שרת, ולכן הפורט צריך להיות פתוח
(או להריץ את הסקריפט על ה־VPS עצמו עם `--osmand http://localhost:5055`).
אפשרויות נוספות: `--history <שעות>` (ברירת מחדל 3), `--interval <שניות>` (ברירת מחדל 10), `--no-osrm`.
