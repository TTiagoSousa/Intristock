# Architecture

IntriStock is a monorepo with four apps that share one PostgreSQL database. It is self-hosted: each install is one VM with its own admin.

```
┌──────────────────────────── VM (Debian 13) ─────────────────────────────┐
│                                                                         │
│  nginx :80 ──┬── /        → /var/www/intristock  (frontend build)       │
│              └── /api/*   → 127.0.0.1:3000       (backend, systemd)     │
│                                  │                       │              │
│                       PostgreSQL 17 (localhost)    Garage S3 :3900      │
│                                  │                                      │
│     downloader + simulator (Python, systemd) ── ClickHouse :8123        │
└─────────────────────────────────────────────────────────────────────────┘
```

| App | Stack | What it does |
|---|---|---|
| `apps/backend` | NestJS 11, Prisma 7, PostgreSQL | The API: users, companies, personal finances, platforms, currencies, the simulation queue, versions and updates. |
| `apps/frontend` | React 19, Vite, SCSS, i18next | The web app, in European Portuguese and English. |
| `apps/downloader` | Python 3.13 | Takes download requests from the queue and stores one-minute candles from Binance or Coinbase in ClickHouse. |
| `apps/simulator` | Python 3.13, numpy | Runs the trading simulations (one process each) and the live paper tests, and writes the report. |

## Backend

Each module (`apps/backend/src/<module>`) is layered:

```
controller  →  service  →  helper (one function per file)  →  repository (Prisma)
```

- **Controllers** validate the input with DTOs (`class-validator`) and check access: the JWT guard, the admin guard, and `assertCompanyAccess` with the permission a company route needs.
- **Services** wire the helpers to their repositories.
- **Helpers** hold the logic, one exported function each, so they are easy to find and test.
- **Repositories** are the only place that talks to Prisma.

Background work runs inside the backend as Nest services with timers: the market sync every 24 h, the prop firm sync from PropFirmMap, the hourly exchange rates (`CurrencyHourRateService`) and the version watcher that announces new releases.

External APIs (CurrencyBeacon for exchange rates, a countries API, PropFirmMap, CoinGecko for the crypto exchanges) are configured in Settings → APIs. Their keys are stored encrypted in `AppSetting` with the install's `ENCRYPTION_KEY`.

## Database

- PostgreSQL holds everything except the candles. The schema is `apps/backend/prisma/schema.prisma` and the migrations are in `apps/backend/prisma/migrations/`.
- ClickHouse holds the one-minute candles (`market_candles`) and the funding rates, only for the simulations. Its tables are created by the Python apps from `apps/<app>/clickhouse/migrations/*.sql` when they start.
- Garage (S3) stores uploaded documents (invoices, contracts).

## Queues between the apps

The backend and the Python apps talk through PostgreSQL tables and `LISTEN` / `NOTIFY`:

| Table | Producer | Consumer |
|---|---|---|
| `MarketDataDownload` | backend (`NOTIFY market_data_download`) | downloader (`FOR UPDATE SKIP LOCKED`) |
| `SimulationRun` | backend (`NOTIFY`) | simulator, once its candles are downloaded |
| `LiveTest` / `LiveTestEvent` | backend (`NOTIFY live_test`) | simulator's live process; events go back to the browser by SSE |

## Frontend

- Pages live in `src/Pages`, shared pieces in `src/Components`, data hooks in `src/Hooks` and the API endpoints in one place.
- The shell is a rail of modules (Companies, Finances, Portfolio, Trading, Calculators, Versions, Settings) with a side panel per module.
- Colours come only from CSS tokens (`src/Styles/Theme/`), with a light and a dark theme.
- Charts use [OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle): the candlestick chart for the simulator and the line, bar, heatmap, scatter, calendar and gauge families elsewhere.

## Versions and updates

Every release is an annotated tag `vX.Y.Z` whose message is the English notes; `releases/vX.Y.Z/{en,pt-PT}.md` hold the notes per language. An install reads the tags from its git origin, shows the notes under Versions → News and, for the admin, offers the next version under Versions → Update. Updates go one version at a time through `deploy/proxmox/update.sh`. See [deployment](deployment.md).
