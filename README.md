# viper fleet

Hebrew-first (RTL) fleet management on top of [Traccar](https://www.traccar.org): the live map,
reports, a customizable dashboard, fleet operations (vehicles, drivers, maintenance, costs,
dispatch, safety) and an administration area, in the viper fleet brand.

This repository is the web app only. It talks to a [Traccar server](https://github.com/traccar/traccar)
over its REST API and WebSocket, and to the fleet database (self-hosted Supabase, `supabase/`).

## Development

```shell
npm install
npm start      # needs a Traccar server on :8082
npm run demo   # or: the built-in demo server, no Traccar needed
npm run demo:il  # the same with an Israeli fleet (Hebrew names, Israeli cities), for sales and screenshots
```

The e2e tests run against `npm run demo`. A test or a browser can switch to the Israeli fleet with the
cookie `demoFleet=il`. Screenshots of the demo shown outside the app carry the note
`ILLUSTRATIVE UI / FICTIONAL DATA`.

Before a commit: `npm run lint` (includes the brand color guard), `npm test`, and
`npm run test:e2e`. Read [CLAUDE.md](CLAUDE.md) and [BRAND.md](BRAND.md) first.

## Upstream and license

viper fleet started as a fork of [traccar/traccar-web](https://github.com/traccar/traccar-web) by
Anton Tananaev and the Traccar contributors, and keeps its license: Apache License, Version 2.0
(see [LICENSE.txt](LICENSE.txt)). How upstream fixes are followed: [docs/UPSTREAM.md](docs/UPSTREAM.md).

## About this app

This fork is branded as **viper fleet** (SYNC POINT / MIDNIGHT AQUA): midnight navy, aqua, ice,
paper and ink, Sora + Assistant type, the Sync Point logo and app icons (light by default with a dark
mode toggle). It adds a navy navigation rail with a top bar and command palette (Ctrl+K), a settings
hub with grouped sections, data tables, section-card forms, a brand login screen, Hebrew as the
default language and full RTL.

**Brand rules are binding:** read [BRAND.md](BRAND.md) before changing anything visual. The brand book
and every source asset live in [`brand/`](brand/). `npm run lint` blocks raw colors outside the design
tokens in `src/common/theme/tokens.js`. Every push to `main` deploys to staging once it is set up;
production is the "Promote to production" workflow, run by hand (`deploy/STAGING.md`). By hand,
`sh deploy/deploy.sh` builds and uploads `build/` into the Traccar container's web directory on the VPS
(see `deploy/docker-compose.override.example.yml`); the build needs `VITE_FLEET_URL` and
`VITE_FLEET_ANON_KEY`, and `npm start` reads them from `.env.development.local` (see `.env.example`). Database changes go out with `sh deploy/migrate.sh`
and the edge functions kept here (the public API) with `sh deploy/functions.sh`.

A customizable **dashboard** (`/dashboard`, second item in the rail) lets every user build their own
boards from live fleet state, period activity and fleet-database widgets, in any form (KPI, donut,
pie, bars, columns, line, area, table), with a gapless drag-and-resize layout. See the "Dashboard"
section in [FLEET.md](FLEET.md).

Custom UI strings live in `src/resources/l10n/en.json` and `he.json` and are maintained in this repository.
The upstream Transifex workflow was removed because it force-pulled `he.json` and dropped them.

### נתוני דמו לשרת הבדיקות

`deploy/demo-data.mjs` יוצר בשרת Traccar צי דמו ישראלי: 12 רכבים (משאיות, ואנים, טנדר, אופנוע,
אוטובוס ורכבי הנהלה), 4 קבוצות, 8 נהגים ו־6 אזורים גאוגרפיים. הוא ממלא כמה שעות של היסטוריה
(לדוחות ולהפעלה חוזרת של מסלולים) ואז מזיז את הרכבים בזמן אמת על כבישים אמיתיים (מסלולים מ־OSRM).
הסטטוסים מגוונים: רוב הרכבים בנסיעה, אחד חונה, אחד מנותק ואחד שמעולם לא דיווח.

נתוני הדמו הולכים לשרת הבדיקות (staging), לא לייצור: רכבים מזויפים בייצור מעוותים את המדדים בניהול
השירות, את "מכשירים בלי לקוח" ואת ספירת החיוב. הסקריפט מסרב לשרת הייצור אלא אם מוסיפים
`--allow-production` (למשל כדי להריץ `clean` ולמחוק משם נתוני דמו ישנים). ראו `deploy/STAGING.md`.

```shell
export TRACCAR_URL=https://traccar-staging.example.com   # כתובת הממשק של שרת הבדיקות
export TRACCAR_EMAIL=admin@example.com        # משתמש מנהל
export TRACCAR_PASSWORD='...'

node deploy/demo-data.mjs          # יצירה + היסטוריה + סימולציה חיה (Ctrl+C לעצירה)
node deploy/demo-data.mjs simulate # רק להריץ שוב את התנועה (בלי ליצור מחדש)
node deploy/demo-data.mjs clean    # מחיקת כל נתוני הדמו, ורק אותם
```

המיקומים נשלחים בפרוטוקול OsmAnd לפורט 5055 באותו שרת, ולכן הפורט צריך להיות פתוח
(או להריץ את הסקריפט על ה־VPS עצמו עם `--osmand http://localhost:5055`).
אפשרויות נוספות: `--history <שעות>` (ברירת מחדל 3), `--interval <שניות>` (ברירת מחדל 10), `--no-osrm`.
